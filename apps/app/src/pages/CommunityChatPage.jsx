import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCommunityMessages } from '@/hooks/useCommunities';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CommunityChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, loading, error, sendMessage } = useCommunityMessages(id);
  const [community, setCommunity] = useState(undefined);
  const [canSend, setCanSend] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!id || !user?.id) return;
    const load = async () => {
      const { data: comm } = await supabase
        .from('communities')
        .select('id, name, description')
        .eq('id', id)
        .single();
      if (!comm) {
        setCommunity(null);
        setCanSend(false);
        return;
      }
      const { data: member } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (member) {
        setCommunity(comm);
        setCanSend(true);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const isAdmin = ['owner', 'admin'].includes(String(profile?.role || '').toLowerCase());
      if (isAdmin) {
        const { error: insErr } = await supabase.from('community_members').insert({
          community_id: id,
          user_id: user.id,
          role: 'member',
        });
        setCommunity(comm);
        setCanSend(!insErr);
      } else {
        setCommunity(null);
        setCanSend(false);
      }
    };
    load();
  }, [id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const { error: err } = await sendMessage(input);
    setSending(false);
    if (!err) setInput('');
  };

  if (!id) return null;

  if (community === null) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Vous n'êtes pas membre de cette communauté.</p>
          <Button onClick={() => navigate('/community')} className="bg-[var(--school-accent)] text-black">
            Retour aux communautés
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white flex flex-col">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0F1419]/95 backdrop-blur-xl px-4 py-3 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/community')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-white">{community?.name || 'Communauté'}</h1>
          <p className="text-xs text-gray-400">{community?.description || '—'}</p>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--school-accent)]" />
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((m, i) => {
              const isOwn = m.author_id === user?.id;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-[var(--school-accent)] text-black'
                        : 'bg-[#151a21] border border-white/10'
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-xs font-medium text-[var(--school-accent)] mb-0.5">
                        {m.author?.name || 'Inconnu'}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-black/70' : 'text-gray-500'}`}>
                      {new Date(m.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {canSend && (
        <div className="sticky bottom-0 border-t border-white/10 bg-[#0F1419]/95 backdrop-blur-xl p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Écrire un message..."
              className="flex-1 bg-[#151a21] border-white/10 text-white placeholder:text-gray-500"
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="bg-[var(--school-accent)] text-black hover:bg-amber-500 px-6"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityChatPage;
