import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

export function Messages() {
  const [messages] = useState<any[]>([]);
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><MessageCircle size={22} /> Messages</h2>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: 20 }}>
          {messages.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 100 }}>Messagerie securisee avec votre praticien.<br/>Aucun message pour le moment.</p>}
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', padding: 12, display: 'flex', gap: 8 }}>
          <input placeholder="Votre message..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }} />
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}><Send size={16} /> Envoyer</button>
        </div>
      </div>
    </div>
  );
}
