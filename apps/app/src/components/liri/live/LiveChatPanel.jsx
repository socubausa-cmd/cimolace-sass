/**
 * Chat live — persistant dans live_session_chat + Postgres Realtime
 */
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LiveChatPanel({ liveSessionId, userId, userName }) {
  const [messages, setMessages] = useState([]);
  const [authors, setAuthors] = useState({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!liveSessionId) return;
    supabase
      .from('live_session_chat')
      .select('id, user_id, message, created_at')
      .eq('live_session_id', liveSessionId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          setMessages(data);
          const ids = [...new Set(data.map((m) => m.user_id))];
          if (ids.length) {
            supabase.from('profiles').select('id, name').in('id', ids).then(({ data: profiles }) => {
              setAuthors(Object.fromEntries((profiles || []).map((p) => [p.id, p.name])));
            });
          }
        }
      });

    const sub = supabase
      .channel(`live_chat:${liveSessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_session_chat', filter: `live_session_id=eq.${liveSessionId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        if (payload.new?.user_id && !authors[payload.new.user_id]) {
          supabase.from('profiles').select('id, name').eq('id', payload.new.user_id).single().then(({ data: p }) => {
            if (p) setAuthors((a) => ({ ...a, [p.id]: p.name }));
          });
        }
      })
      .subscribe();

    return () => sub.unsubscribe();
  }, [liveSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const msg = input?.trim();
    if (!msg || !userId || !liveSessionId) return;
    setSending(true);
    try {
      const { error } = await supabase.from('live_session_chat').insert({
        live_session_id: liveSessionId,
        user_id: userId,
        message: msg,
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
    } finally {
      setInput('');
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0F1419] border-l border-white/10 w-80 shrink-0">
      <div className="p-2 border-b border-white/10 text-sm font-medium text-white">Chat</div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className={m.user_id === userId ? 'flex justify-end' : ''}>
              <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', m.user_id === userId ? 'bg-[var(--school-accent)] text-black' : 'bg-[#192734] text-white')}>
                {m.user_id !== userId && <div className="text-xs text-[var(--school-accent)] mb-0.5">{authors[m.user_id] || 'Participant'}</div>}
                <div>{m.message}</div>
                <div className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>
        <div ref={scrollRef} />
      </ScrollArea>
      <form onSubmit={handleSend} className="p-2 border-t border-white/10 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message..."
          className="bg-[#192734] border-white/10 text-white flex-1"
          disabled={sending}
        />
        <Button type="submit" size="icon" className="bg-[var(--school-accent)] text-black shrink-0" disabled={sending || !input?.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
