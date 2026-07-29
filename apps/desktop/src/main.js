'use strict';
const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('node:path');

/**
 * LIRI pour macOS et Windows.
 *
 * La coque charge le PORTAIL DÉPLOYÉ plutôt qu'une copie figée de `apps/app/dist`.
 * C'est ce qui la rend fidèle au web *en permanence* : chaque déploiement front
 * profite immédiatement à l'application de bureau, sans nouvelle release. Un
 * paquet embarquant les fichiers serait périmé dès le déploiement suivant — et
 * de toute façon inutilisable hors ligne, puisque toutes les données viennent
 * de l'API.
 *
 * Ce que la coque APPORTE par rapport à un onglet de navigateur : présence dans
 * le dock et la barre des tâches, fenêtre sans chrome de navigateur, instance
 * unique, menus natifs en français, taille et position mémorisées, et
 * ouverture des liens externes dans le navigateur du système.
 */

const PORTAL_URL = process.env.LIRI_PORTAL_URL || 'https://app.prorascience.org';
const PORTAL_ORIGIN = new URL(PORTAL_URL).origin;

/** Domaines vers lesquels la navigation INTERNE est autorisée. Tout le reste
 *  part dans le navigateur du système : une coque applicative ne doit pas
 *  devenir un navigateur généraliste. */
const ALLOWED_ORIGINS = new Set([
  PORTAL_ORIGIN,
  'https://accounts.google.com', // connexion Google du portail
]);

let mainWindow = null;

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const fs = require('node:fs');
    const s = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    if (Number.isFinite(s.width) && Number.isFinite(s.height)) return s;
  } catch {
    /* première ouverture */
  }
  return { width: 1280, height: 860 };
}

function saveWindowState(win) {
  try {
    const fs = require('node:fs');
    const b = win.getNormalBounds();
    fs.writeFileSync(windowStatePath(), JSON.stringify(b));
  } catch {
    /* sans conséquence */
  }
}

function createWindow() {
  const state = loadWindowState();
  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 960,
    minHeight: 640,
    title: 'LIRI',
    backgroundColor: '#262624', // fond du portail : évite le flash blanc au lancement
    autoHideMenuBar: process.platform !== 'darwin',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      // Aucune passerelle vers Node depuis la page : la coque n'expose rien.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => { mainWindow = null; });

  // Liens externes → navigateur du système, jamais une fenêtre Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Navigation interne restreinte aux origines connues.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let origin;
    try { origin = new URL(url).origin; } catch { origin = ''; }
    if (!ALLOWED_ORIGINS.has(origin)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  // Réseau coupé ou portail injoignable : on le DIT, plutôt que d'afficher une
  // page d'erreur de navigateur incompréhensible.
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* abandon volontaire */) return;
    const file = path.join(__dirname, 'offline.html');
    void mainWindow.loadFile(file, { query: { desc: desc || String(code) } });
  });

  void mainWindow.loadURL(PORTAL_URL);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const reload = () => mainWindow && mainWindow.loadURL(PORTAL_URL);
  const template = [
    ...(isMac ? [{
      label: 'LIRI',
      submenu: [
        { role: 'about', label: 'À propos de LIRI' },
        { type: 'separator' },
        { role: 'services', label: 'Services' },
        { type: 'separator' },
        { role: 'hide', label: 'Masquer LIRI' },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Tout afficher' },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter LIRI' },
      ],
    }] : []),
    {
      label: 'Fichier',
      submenu: [
        { label: 'Retour à l’accueil', accelerator: 'CmdOrCtrl+Shift+H', click: reload },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Fermer la fenêtre' } : { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Actualiser' },
        { role: 'forceReload', label: 'Actualiser sans le cache' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Taille réelle' },
        { role: 'zoomIn', label: 'Agrandir' },
        { role: 'zoomOut', label: 'Réduire' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Ouvrir le portail dans le navigateur',
          click: () => shell.openExternal(PORTAL_URL),
        },
        {
          label: 'À propos',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'LIRI',
            message: `LIRI ${app.getVersion()}`,
            detail: `Portail : ${PORTAL_URL}\nCimolace`,
            buttons: ['Fermer'],
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Instance unique : un second lancement réveille la fenêtre existante au lieu
// d'ouvrir un doublon.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
