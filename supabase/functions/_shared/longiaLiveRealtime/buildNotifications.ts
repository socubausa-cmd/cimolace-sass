type Signal = Record<string, unknown>;

function stableNotificationId(type: string, code: string, seed: string): string {
  let h = 0;
  const s = `${type}|${code}|${seed}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `longia_rt_${h.toString(16)}`;
}

function toNotification(signal: Signal) {
  const type = String(signal.type || 'system');
  const code = String(signal.code || 'signal');
  const title = String(signal.title || 'Signal LONGIA');
  const message = String(signal.message || '');
  const seed =
    typeof signal.question === 'string'
      ? signal.question
      : typeof signal.excerpt === 'string'
        ? signal.excerpt
        : message;

  const actions =
    type === 'pedagogical'
      ? [
          { id: `${code}_1`, label: 'Générer un exemple', action: 'generate_live_example', variant: 'primary' },
          { id: `${code}_2`, label: 'Créer un slide', action: 'create_example_slide', variant: 'secondary' },
        ]
      : type === 'chat'
        ? [
            { id: `${code}_1`, label: 'Répondre maintenant', action: 'answer_cluster_now', variant: 'primary' },
            { id: `${code}_2`, label: 'Préparer une réponse', action: 'draft_answer_for_teacher', variant: 'secondary' },
          ]
        : type === 'audience'
          ? [{ id: `${code}_1`, label: 'Lancer une question', action: 'launch_interactive_prompt', variant: 'primary' }]
          : [{ id: `${code}_1`, label: 'Afficher sur le smartboard', action: 'push_point_to_smartboard', variant: 'secondary' }];

  const tier = signal.tier === 'partial' ? 'partial' : 'final';
  const strength = signal.strength === 'light' ? 'light' : 'normal';
  let priority: 'high' | 'medium' | 'low' =
    type === 'pedagogical' || type === 'chat' ? 'high' : 'medium';
  if (strength === 'light' || tier === 'partial') priority = 'low';

  return {
    id: stableNotificationId(type, code, seed),
    type,
    priority,
    title,
    message,
    actions,
    tier,
    strength,
    source: { agent: 'longia_live_orchestrator', module: 'buildNotifications' },
  };
}

export function buildNotifications(input: {
  transcriptSignals: Signal[];
  chatSignals: Signal[];
  audienceSignals: Signal[];
  secureAppSignals?: Signal[];
  roomContext: Record<string, unknown>;
}) {
  const allSignals = [
    ...input.transcriptSignals,
    ...input.chatSignals,
    ...input.audienceSignals,
    ...(Array.isArray(input.secureAppSignals) ? input.secureAppSignals : []),
  ];
  return allSignals.map(toNotification);
}
