export type AudienceMetric = {
  engagementScore: number;
  viewerCount?: number;
  timestampMs?: number;
};

export function analyzeAudience(metrics: AudienceMetric[], _roomContext: Record<string, unknown>) {
  const signals: Array<Record<string, unknown>> = [];
  if (!metrics.length) return signals;

  const last = metrics[metrics.length - 1];
  if (last.engagementScore < 40) {
    signals.push({
      type: 'audience',
      code: 'engagement_drop_detected',
      title: 'Attention en baisse',
      message: 'Le score d’engagement est faible.',
    });
  } else if (last.engagementScore > 80) {
    signals.push({
      type: 'audience',
      code: 'engagement_peak_detected',
      title: 'Pic d’engagement',
      message: 'Le passage actuel suscite un fort intérêt.',
    });
  }
  return signals;
}
