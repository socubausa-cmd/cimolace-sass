export type SecureAppShareState = {
  appName?: string;
  isVisible?: boolean;
  locked?: boolean;
  status?: 'active' | 'paused' | 'stopped' | string;
};

export type SecureAppShareSecurityConfig = {
  lockSource?: boolean;
  hideNotifications?: boolean;
  pauseIfMissing?: boolean;
};

export type SecureAppShareConfig = {
  enabled?: boolean;
  mode?: 'process_capture' | 'window_capture' | string;
  security?: SecureAppShareSecurityConfig;
};

export type SecureAppShareWatcherResult = {
  ok: boolean;
  shouldPause: boolean;
  status: 'ok' | 'disabled' | 'unlocked' | 'missing' | 'inactive';
  notification?: string;
  code?: string;
  details: {
    appName: string | null;
    mode: string;
    lockRequired: boolean;
    pauseIfMissing: boolean;
    hideNotifications: boolean;
  };
};

const DEFAULT_CONFIG: Required<SecureAppShareConfig> = {
  enabled: true,
  mode: 'process_capture',
  security: {
    lockSource: true,
    hideNotifications: true,
    pauseIfMissing: true,
  },
};

function normalizeConfig(config?: SecureAppShareConfig): Required<SecureAppShareConfig> {
  const security = config?.security || {};
  return {
    enabled: config?.enabled ?? DEFAULT_CONFIG.enabled,
    mode: config?.mode || DEFAULT_CONFIG.mode,
    security: {
      lockSource: security.lockSource ?? DEFAULT_CONFIG.security.lockSource,
      hideNotifications: security.hideNotifications ?? DEFAULT_CONFIG.security.hideNotifications,
      pauseIfMissing: security.pauseIfMissing ?? DEFAULT_CONFIG.security.pauseIfMissing,
    },
  };
}

function buildResult(
  partial: Omit<SecureAppShareWatcherResult, 'details'>,
  state: SecureAppShareState,
  config: Required<SecureAppShareConfig>,
): SecureAppShareWatcherResult {
  return {
    ...partial,
    details: {
      appName: state.appName || null,
      mode: config.mode,
      lockRequired: config.security.lockSource,
      pauseIfMissing: config.security.pauseIfMissing,
      hideNotifications: config.security.hideNotifications,
    },
  };
}

export function secureAppShareWatcher(
  state: SecureAppShareState,
  config?: SecureAppShareConfig,
): SecureAppShareWatcherResult {
  const cfg = normalizeConfig(config);

  if (!cfg.enabled) {
    return buildResult(
      {
        ok: true,
        shouldPause: false,
        status: 'disabled',
      },
      state,
      cfg,
    );
  }

  if (String(state.status || '').toLowerCase() === 'paused' || String(state.status || '').toLowerCase() === 'stopped') {
    return buildResult(
      {
        ok: false,
        shouldPause: true,
        status: 'inactive',
        code: 'secure_app_inactive',
        notification: 'Secure App Share inactif. Diffusion à mettre en pause.',
      },
      state,
      cfg,
    );
  }

  if (cfg.security.lockSource && !state.locked) {
    return buildResult(
      {
        ok: false,
        shouldPause: true,
        status: 'unlocked',
        code: 'secure_app_unlocked',
        notification: 'Secure App Share non verrouillé.',
      },
      state,
      cfg,
    );
  }

  if (cfg.security.pauseIfMissing && !state.isVisible) {
    return buildResult(
      {
        ok: false,
        shouldPause: true,
        status: 'missing',
        code: 'secure_app_missing',
        notification: 'Application minimisée ou introuvable. Diffusion à mettre en pause.',
      },
      state,
      cfg,
    );
  }

  return buildResult(
    {
      ok: true,
      shouldPause: false,
      status: 'ok',
    },
    state,
    cfg,
  );
}
