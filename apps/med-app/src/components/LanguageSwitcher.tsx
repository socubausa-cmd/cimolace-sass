import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';

const BASE: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  padding: '6px 9px',
  border: '1px solid var(--zw-border)',
  background: '#fff',
  color: 'var(--zw-text-muted)',
  cursor: 'pointer',
  letterSpacing: 0.4,
};

const ACTIVE: React.CSSProperties = {
  background: 'var(--brand-primary)',
  color: '#fff',
  borderColor: 'var(--brand-primary)',
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.language || 'fr').slice(0, 2) as 'fr' | 'en';

  const onPick = (lng: 'fr' | 'en') => {
    if (lng === current) return;
    void setLanguage(lng);
  };

  return (
    <div
      role="group"
      aria-label="Language"
      style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden' }}
    >
      <button
        type="button"
        onClick={() => onPick('fr')}
        aria-pressed={current === 'fr'}
        style={{
          ...BASE,
          ...(current === 'fr' ? ACTIVE : {}),
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
          borderRight: 'none',
        }}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => onPick('en')}
        aria-pressed={current === 'en'}
        style={{
          ...BASE,
          ...(current === 'en' ? ACTIVE : {}),
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
        }}
      >
        EN
      </button>
    </div>
  );
}

export default LanguageSwitcher;
