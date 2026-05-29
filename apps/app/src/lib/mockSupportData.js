import { subDays } from 'date-fns';

export const generateProblems = () => {
  const categories = ['Technical', 'Payment', 'Formation', 'Other'];
  const priorities = ['Low', 'Medium', 'High', 'Critical'];
  const statuses = ['open', 'in_progress', 'closed'];

  return Array.from({ length: 20 }).map((_, i) => ({
    id: `ticket-${i + 1}`,
    title: `Problème ${i + 1}`,
    description: 'Description détaillée du problème rencontré par l\'utilisateur.',
    category: categories[Math.floor(Math.random() * categories.length)],
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    creatorId: `user-${Math.floor(Math.random() * 5)}`,
    creatorName: `User ${Math.floor(Math.random() * 5)}`,
    assignedTo: Math.random() > 0.5 ? 'admin-1' : null,
    createdAt: subDays(new Date(), Math.floor(Math.random() * 20)).toISOString(),
    comments: []
  }));
};