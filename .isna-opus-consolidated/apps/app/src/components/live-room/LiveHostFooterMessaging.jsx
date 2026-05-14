import React from 'react';
import { MessageCircle } from 'lucide-react';

/**
 * Déclencheur footer : ouvre le panneau latéral messagerie (même principe que Paramètres).
 */
export default function LiveHostFooterMessaging({
  onOpenPanel,
  disabled = false,
  title = 'Ouvrir la messagerie — fil de session et messages privés',
}) {
  return (
    <button
      type="button"
      data-testid="live-host-open-messaging"
      title={title}
      onClick={() => onOpenPanel?.()}
      disabled={disabled || typeof onOpenPanel !== 'function'}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10 text-cyan-100/90 transition-colors hover:border-cyan-400/45 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <MessageCircle className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
