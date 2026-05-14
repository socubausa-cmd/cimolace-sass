import { subMinutes, subHours, subDays, format } from 'date-fns';

// Helper to generate IDs
const generateId = (prefix) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

// Mock Users
export const users = [
  { id: 'user-1', name: 'Jean Admin', avatar: null, role: 'owner', status: 'online' },
  { id: 'user-2', name: 'Dr. Sarah Connor', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', role: 'teacher', status: 'online' },
  { id: 'user-3', name: 'John Smith', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', role: 'teacher', status: 'away' },
  { id: 'user-4', name: 'Emily Chen', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', role: 'student', status: 'offline' },
  { id: 'user-5', name: 'Michael Brown', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', role: 'student', status: 'online' },
  { id: 'user-6', name: 'Sophie Martin', avatar: null, role: 'student', status: 'dnd' },
  { id: 'user-7', name: 'Lucas Dubreuil', avatar: null, role: 'student', status: 'online' },
  { id: 'user-8', name: 'Emma Wilson', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', role: 'student', status: 'offline' },
];

const currentUser = users[0]; // Simulating logged in as Owner/Admin for now

// Mock Conversations
export const generateConversations = () => [
  {
    id: 'conv-1',
    type: 'private',
    participants: ['user-1', 'user-2'],
    updatedAt: new Date().toISOString(),
    unreadCount: 2,
    pinned: true,
    lastMessage: { content: 'Le planning est prêt pour demain.', senderId: 'user-2', type: 'text', timestamp: subMinutes(new Date(), 5).toISOString() }
  },
  {
    id: 'conv-2',
    type: 'formation_group',
    name: 'Cycle Initié - Groupe A',
    image: null,
    participants: ['user-1', 'user-2', 'user-4', 'user-5', 'user-6'],
    updatedAt: subHours(new Date(), 1).toISOString(),
    unreadCount: 0,
    pinned: true,
    lastMessage: { content: 'Noubliez pas de rendre le devoir.', senderId: 'user-2', type: 'text', timestamp: subHours(new Date(), 1).toISOString() }
  },
  {
    id: 'conv-3',
    type: 'private',
    participants: ['user-1', 'user-3'],
    updatedAt: subHours(new Date(), 4).toISOString(),
    unreadCount: 0,
    pinned: false,
    lastMessage: { content: 'Je serai absent vendredi.', senderId: 'user-3', type: 'text', timestamp: subHours(new Date(), 4).toISOString() }
  },
  {
    id: 'conv-4',
    type: 'support_group',
    name: 'Support Technique',
    image: null,
    participants: ['user-1', 'user-4', 'user-7'],
    updatedAt: subDays(new Date(), 1).toISOString(),
    unreadCount: 5,
    pinned: false,
    lastMessage: { content: 'Mon accès est bloqué.', senderId: 'user-4', type: 'text', timestamp: subDays(new Date(), 1).toISOString() }
  },
  {
    id: 'conv-5',
    type: 'coaching_group',
    name: 'Coaching Individuel - Sophie',
    image: null,
    participants: ['user-1', 'user-6'],
    updatedAt: subDays(new Date(), 2).toISOString(),
    unreadCount: 0,
    pinned: false,
    lastMessage: { content: 'Merci pour la séance !', senderId: 'user-6', type: 'text', timestamp: subDays(new Date(), 2).toISOString() }
  }
];

// Mock Messages Generator
export const generateMessages = (conversationId) => {
  const count = 15;
  const msgs = [];
  for (let i = 0; i < count; i++) {
    const isMe = Math.random() > 0.5;
    const sender = isMe ? currentUser : users[Math.floor(Math.random() * users.length)];
    
    msgs.push({
      id: `msg-${conversationId}-${i}`,
      conversationId,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      content: [
        "Bonjour, comment allez-vous ?",
        "Avez-vous vu le dernier module ?",
        "Je suis disponible pour un appel.",
        "Voici le document demandé.",
        "Merci beaucoup !",
        "C'est noté.",
        "On se voit demain à 14h.",
        "Pouvez-vous confirmer ?",
        "J'ai une question sur le chapitre 3.",
        "Excellent travail !"
      ][Math.floor(Math.random() * 10)],
      type: 'text',
      timestamp: subMinutes(new Date(), i * 45).toISOString(),
      isRead: true,
      reactions: Math.random() > 0.8 ? { '👍': ['user-2'] } : {},
      status: 'read'
    });
  }
  return msgs.reverse();
};

export const getInitialData = () => {
  const conversations = generateConversations();
  const messages = {};
  conversations.forEach(c => {
    messages[c.id] = generateMessages(c.id);
  });
  return { conversations, messages, users, currentUser };
};