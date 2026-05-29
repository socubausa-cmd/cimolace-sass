const getLocalAccounts = () => {
  const raw = import.meta?.env?.VITE_LOCAL_ACCOUNTS_JSON;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((a) => a && typeof a === 'object')
      .map((a) => ({
        email: String(a.email || ''),
        password: String(a.password || ''),
        name: String(a.name || ''),
        role: String(a.role || ''),
      }))
      .filter((a) => a.email && a.password && a.role);
  } catch {
    return [];
  }
};

export const checkOwnerExists = async () => {
  const accounts = getLocalAccounts();
  return accounts.some((a) => a.role === 'owner');
};

export const getOwnerInfo = async () => {
  const accounts = getLocalAccounts();
  const owner = accounts.find((a) => a.role === 'owner');
  if (!owner) return null;

  return {
    full_name: owner.name,
    email: owner.email,
    role: owner.role,
    id: 'local-owner-id',
  };
};

export const setupOwnerAccount = async () => ({ success: true });
export default setupOwnerAccount;
