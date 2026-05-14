import { subMinutes, subHours, subDays } from 'date-fns';

export const generateNotifications = () => {
  const types = [
    'message', 'payment_received', 'payment_overdue', 'formation_enrolled',
    'coaching_scheduled', 'problem_created', 'problem_resolved', 'quiz_completed'
  ];

  return Array.from({ length: 25 }).map((_, i) => ({
    id: `notif-${i + 1}`,
    type: types[Math.floor(Math.random() * types.length)],
    title: `Notification ${i + 1}`,
    message: 'Ceci est un message de notification automatique pour tester le système.',
    timestamp: subMinutes(new Date(), Math.floor(Math.random() * 10000)).toISOString(),
    isRead: Math.random() > 0.3,
    link: '/dashboard'
  })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};