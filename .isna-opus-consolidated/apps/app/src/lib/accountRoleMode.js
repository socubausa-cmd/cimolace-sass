/** Comptes autorisés à basculer le rôle effectif (UI / routes) sans changer le profil en base. */
const MULTI_ROLE_EMAILS = [
  'socubausa@gmail.com',
  'davidbadika@gmail.com',
];
const ROLE_STORAGE_KEY = 'isna_selected_account_role';
const ALLOWED_MULTI_ROLES = ['student', 'secretariat', 'owner', 'teacher', 'admin'];

export function hasMultiRoleAccess(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  return MULTI_ROLE_EMAILS.includes(email);
}

export function getSelectedAccountRole() {
  try {
    const role = String(window.localStorage.getItem(ROLE_STORAGE_KEY) || '').toLowerCase();
    return ALLOWED_MULTI_ROLES.includes(role) ? role : null;
  } catch {
    return null;
  }
}

export function setSelectedAccountRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (!ALLOWED_MULTI_ROLES.includes(normalized)) return;
  try {
    window.localStorage.setItem(ROLE_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
}

export function clearSelectedAccountRole() {
  try {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getEffectiveRole(user) {
  const fallbackRole = String(user?.role || '').toLowerCase();
  if (!hasMultiRoleAccess(user)) return fallbackRole;
  return getSelectedAccountRole() || fallbackRole;
}

export function listAvailableAccountRoles(user) {
  if (!hasMultiRoleAccess(user)) return [];
  return [...ALLOWED_MULTI_ROLES];
}
