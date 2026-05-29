/**
 * AIChatPanel — Coach LIRI temps réel.
 * Connecte useAIStore + appelle aiRouter pour coach_slide.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Bot, User, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/stores/ai.store';
import { aiRouter } from '@/engines/ai-router';
import { useSmartboardStore } from '@/stores/smartboard.store';

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]',
        isUser ? 'bg-white/10' : 'bg-[#D4AF37]/20',
      )}>
        {isUser ? <User className="h-3 w-3 text-white/60" /> : <Bot className="h-3 w-3 text-[#D4AF37]" />}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-xl px-3 py-2 text-[12px] leading-relaxed',
        isUser ? 'bg-white/8 text-white/80' : 'bg-[#D4AF37]/10 text-white/85',
      )}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AIChatPanel({ className }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const coachMessages = useAIStore((s) => s.coachMessages);
  const coachFeedback = useAIStore((s) => s.coachFeedback);
  const coachBusy = useAIStore((s) => s.coachBusy);
  const addCoachMessage = useAIStore((s) => s.addCoachMessage);
  const setCoachBusy = useAIStore((s) => s.setCoachBusy);
  const setCoachFeedback = useAIStore((s) => s.setCoachFeedback);
  const clearCoachMessages = useAIStore((s) => s.clearCoachMessages);

  const activeSlide = useSmartboardStore((s) => s.slides.find((sl) => sl.id === s.activeSlideId));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coachMessages]);

  const runCoachEval = async (userMsg) => {
    setCoachBusy(true);
    addCoachMessage('user', userMsg, 'coach_slide');
    try {
      const payload = {
        message: userMsg,
        slide: activeSlide
          ? { title: activeSlide.title, elementCount: activeSlide.initialState?.elements?.length ?? 0, sections: activeSlide.sections }
          : null,
      };
      const result = await aiRouter.route({ taskType: 'coach_slide', payload });
      const feedback = result?.feedback ?? result;
      addCoachMessage('assistant', typeof result === 'string' ? result : (result?.message ?? 'Analyse terminee.'), 'coach_slide');
      if (feedback?.score != null) setCoachFeedback(feedback);
    } catch {
      addCoachMessage('assistant', 'Une erreur est survenue. Reessayez.', 'coach_slide');
    } finally {
      setCoachBusy(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || coachBusy) return;
    runCoachEval(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleAutoEval = () => {
    runCoachEval('Evalue ce slide : structure, lisibilite, densite, alignement pedagogique. Donne un score et des suggestions.');
  };

  return (
    <div className={cn('flex flex-col bg-[#07090f]', className)}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 py-2">
        <Bot className="h-4 w-4 text-[#D4AF37]" />
        <span className="text-[12px] font-semibold text-white">Coach LIRI</span>
        {coachFeedback && (
          <span className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold',
            coachFeedback.score >= 80 ? 'bg-emerald-500/20 text-emerald-400'
              : coachFeedback.score >= 60 ? 'bg-blue-500/20 text-blue-400'
              : coachFeedback.score >= 40 ? 'bg-amber-500/20 text-amber-400'
              : 'bg-red-500/20 text-red-400',
          )}>
            {coachFeedback.score}/100
          </span>
        )}
        <button onClick={clearCoachMessages} className="rounded p-0.5 text-white/25 hover:text-white/50">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {coachMessages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Sparkles className="h-8 w-8 text-[#D4AF37]/30" />
            <p className="text-[11px] text-white/30">Coach LIRI observe ton slide et te donne des retours pedagogiques en temps reel.</p>
            <button
              onClick={handleAutoEval}
              disabled={coachBusy || !activeSlide}
              className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/30 px-3 py-1.5 text-[11px] text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-40"
            >
              <Sparkles className="h-3 w-3" />
              Analyser le slide
            </button>
          </div>
        ) : (
          coachMessages.map((msg) => <Message key={msg.id} msg={msg} />)
        )}
        {coachBusy && (
          <div className="flex items-center gap-2 text-[11px] text-[#D4AF37]/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Coach analyse...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex shrink-0 gap-2 border-t border-white/8 p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Demande au Coach..."
          rows={2}
          className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/80 placeholder-white/25 outline-none focus:border-[#D4AF37]/30"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || coachBusy}
          className="flex h-full w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] transition-colors hover:bg-[#D4AF37]/30 disabled:opacity-40"
        >
          {coachBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
