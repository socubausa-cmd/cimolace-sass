import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, Plus, X, FileText, CheckCircle2, Search } from 'lucide-react';
import { FormRenderer, type FormShape } from '../forms/FormRenderer';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Form = FormShape & {
  id: string;
  category?: string;
  is_template?: boolean;
  send_before_days?: number | null;
  created_at?: string;
};

const CATEGORIES: Record<string, string> = {
  intake: 'Anamnèse', consent: 'Consentement', followup: 'Suivi',
  symptom: 'Symptômes', satisfaction: 'Satisfaction', custom: 'Personnalisé',
};

function authHeaders(): HeadersInit {
  return {
    Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

export function FormsList() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { created?: boolean } };
  const [forms, setForms] = useState<Form[]>([]);
  const [preview, setPreview] = useState<Form | null>(null);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState(false);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch(API + '/med/forms', { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setForms(d.data || d || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  useEffect(() => {
    if (location.state?.created) {
      setToast(true);
      navigate('.', { replace: true, state: {} });
      const t = setTimeout(() => setToast(false), 3200);
      return () => clearTimeout(t);
    }
  }, [location.state, navigate]);

  const visible = forms.filter((f) =>
    !query.trim() || (f.title || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      {toast && (
        <div className="fl-toast"><CheckCircle2 size={16} /> Formulaire créé avec succès</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 9, margin: 0, color: 'var(--zw-text)' }}>
          <ClipboardList size={22} color="var(--brand-primary)" /> Formulaires médicaux
        </h2>
        <button onClick={() => navigate('/forms/new')} className="fl-new">
          <Plus size={16} /> Nouveau formulaire
        </button>
      </div>

      {forms.length > 4 && (
        <div className="fl-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un formulaire…" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {/* Carte “créer” */}
        <button onClick={() => navigate('/forms/new')} className="fl-create-card">
          <span className="fl-create-plus"><Plus size={22} /></span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Créer un formulaire</span>
          <span style={{ fontSize: 12, color: 'var(--zw-text-muted)' }}>Anamnèse, consentement, suivi…</span>
        </button>

        {visible.map((f) => (
          <button key={f.id} onClick={() => setPreview(f)} className="fl-card">
            <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: 0, color: 'var(--zw-text)' }}>{f.title}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--zw-text-muted)', margin: '5px 0 0', minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {f.description || 'Formulaire médical'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span className="fl-badge">{CATEGORIES[f.category || ''] || f.category || 'Personnalisé'}</span>
              <span style={{ fontSize: 11.5, color: 'var(--zw-text-faint)', fontWeight: 600 }}>
                {(f.fields || []).length} champ{(f.fields || []).length > 1 ? 's' : ''}
              </span>
            </div>
            {f.is_template && <span className="fl-tpl">MODÈLE</span>}
          </button>
        ))}

        {forms.length === 0 && (
          <p style={{ color: 'var(--zw-text-faint)', gridColumn: '1/-1', fontSize: 13 }}>
            Aucun formulaire pour l’instant — créez le premier.
          </p>
        )}
      </div>

      {/* Aperçu (rendu fidèle, lecture seule) */}
      {preview && (
        <div className="fl-overlay" onClick={() => setPreview(null)}>
          <div className="fl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fl-modal-head">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--zw-text-soft)' }}>
                <FileText size={15} /> Aperçu du formulaire
              </span>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--zw-text-muted)' }}><X size={18} /></button>
            </div>
            <div className="fl-modal-body">
              <FormRenderer form={preview} interactive={false} />
            </div>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.fl-new { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; background:var(--brand-primary, #7c3aed); color:#fff; border:none; border-radius:10px; font-size:13.5px; font-weight:700; cursor:pointer; transition:transform .14s, box-shadow .2s; box-shadow:0 8px 18px -8px color-mix(in srgb, var(--brand-primary, #7c3aed) 70%, transparent); }
.fl-new:hover { transform:translateY(-1px); }
.fl-search { display:flex; align-items:center; gap:8px; background:#fff; border:1px solid var(--zw-border); border-radius:10px; padding:0 12px; margin-bottom:16px; max-width:340px; color:var(--zw-text-faint); }
.fl-search input { flex:1; border:none; outline:none; padding:9px 0; font-size:13.5px; background:transparent; color:var(--zw-text); }
.fl-create-card { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; text-align:center; min-height:138px; background:color-mix(in srgb, var(--brand-primary, #7c3aed) 5%, #fff); border:1.5px dashed color-mix(in srgb, var(--brand-primary, #7c3aed) 40%, var(--zw-border)); border-radius:14px; cursor:pointer; font-family:inherit; color:var(--zw-text); transition:all .16s; }
.fl-create-card:hover { border-color:var(--brand-primary, #7c3aed); transform:translateY(-2px); }
.fl-create-plus { width:42px; height:42px; border-radius:12px; background:var(--brand-primary, #7c3aed); color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 16px -6px color-mix(in srgb, var(--brand-primary, #7c3aed) 70%, transparent); }
.fl-card { position:relative; background:#fff; border-radius:14px; border:1px solid var(--zw-border); padding:18px; text-align:left; cursor:pointer; font-family:inherit; transition:transform .16s, box-shadow .2s, border-color .16s; }
.fl-card:hover { transform:translateY(-2px); box-shadow:0 14px 30px -16px rgba(15,23,42,0.3); border-color:color-mix(in srgb, var(--brand-primary, #7c3aed) 30%, var(--zw-border)); }
.fl-badge { display:inline-block; font-size:10.5px; font-weight:700; padding:3px 9px; border-radius:999px; background:color-mix(in srgb, var(--brand-primary, #7c3aed) 12%, #fff); color:var(--brand-primary, #7c3aed); }
.fl-tpl { position:absolute; top:14px; right:14px; font-size:9px; padding:2px 6px; background:#fef3c7; color:#92400e; border-radius:5px; font-weight:800; letter-spacing:.03em; }
.fl-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; animation:flFade .18s ease; }
@keyframes flFade { from { opacity:0; } to { opacity:1; } }
.fl-modal { background:var(--zw-bg, #f6efe6); border-radius:18px; width:min(540px,100%); max-height:88vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 30px 60px -20px rgba(0,0,0,0.45); animation:flPop .22s cubic-bezier(.2,.7,.3,1); }
@keyframes flPop { from { opacity:0; transform:translateY(10px) scale(.98); } to { opacity:1; transform:none; } }
.fl-modal-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#fff; border-bottom:1px solid var(--zw-border); }
.fl-modal-body { padding:18px; overflow-y:auto; }
.fl-toast { position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:2000; display:inline-flex; align-items:center; gap:8px; background:#16a34a; color:#fff; padding:11px 18px; border-radius:11px; font-size:13.5px; font-weight:600; box-shadow:0 14px 30px -10px rgba(22,163,74,0.6); animation:flToast .3s cubic-bezier(.2,.7,.3,1); }
@keyframes flToast { from { opacity:0; transform:translateX(-50%) translateY(-12px); } to { opacity:1; transform:translateX(-50%); } }
`;
