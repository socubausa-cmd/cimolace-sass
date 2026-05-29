import React, { useState } from 'react';
import { useConversations, useMessaging } from '@/hooks/useMessaging';
import { Search, Pin, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import OnlineStatusIndicator from './OnlineStatusIndicator';

const ConversationItem = ({ conversation, isActive, onClick, currentUser, users }) => {
  // Logic to determine display name/avatar
  let displayName = conversation.name;
  let displayAvatar = conversation.image;
  let status = 'offline';

  if (conversation.type === 'private') {
    const otherId = conversation.participants.find(id => id !== currentUser.id);
    const otherUser = users.find(u => u.id === otherId);
    if (otherUser) {
      displayName = otherUser.name;
      displayAvatar = otherUser.avatar;
      status = otherUser.status;
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Hier';
    return format(date, 'dd/MM/yy');
  };

  return (
    <div 
      onClick={onClick}
      className={`p-3 cursor-pointer flex items-center gap-3 transition-colors ${
        isActive 
          ? 'bg-[#D4AF37]/10 border-r-2 border-[#D4AF37]' 
          : 'hover:bg-white/5 border-r-2 border-transparent'
      }`}
    >
      <div className="relative">
        <Avatar className="h-10 w-10 border border-white/10">
          <AvatarImage src={displayAvatar} />
          <AvatarFallback className="bg-gray-800 text-gray-400 font-bold">
            {displayName?.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {conversation.type === 'private' && (
          <div className="absolute -bottom-0.5 -right-0.5">
             <OnlineStatusIndicator status={status} size="sm" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-start">
          <h4 className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-200'}`}>
            {displayName}
          </h4>
          <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
            {formatTime(conversation.lastMessage?.timestamp)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className="text-sm text-gray-400 truncate pr-2">
            {conversation.lastMessage?.senderId === currentUser.id && 'Vous: '}
            {conversation.lastMessage?.content}
          </p>
          <div className="flex items-center gap-1">
            {conversation.pinned && <Pin className="w-3 h-3 text-gray-500" />}
            {conversation.unreadCount > 0 && (
              <Badge className="h-4 min-w-[16px] p-0 px-1 flex items-center justify-center text-[9px] bg-[#D4AF37] text-black">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConversationList = ({ onSelect }) => {
  const { conversations, activeId, selectConversation } = useConversations();
  const { currentUser, users } = useMessaging();
  const [filter, setFilter] = useState('all'); // all, unread, groups
  const [search, setSearch] = useState('');

  const filteredConversations = conversations.filter(c => {
    // Search
    let nameMatch = c.name?.toLowerCase().includes(search.toLowerCase());
    if (c.type === 'private') {
       const otherId = c.participants.find(id => id !== currentUser?.id);
       const otherUser = users.find(u => u.id === otherId);
       if (otherUser?.name.toLowerCase().includes(search.toLowerCase())) nameMatch = true;
    }
    if (!nameMatch) return false;

    // Filter
    if (filter === 'unread') return (c.unreadCount || 0) > 0;
    if (filter === 'groups') return c.type !== 'private';
    if (filter === 'private') return c.type === 'private';
    
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#0F1419] border-r border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <h2 className="text-xl font-bold text-white">Messages</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#192734] border-white/10 text-sm h-9" 
            placeholder="Rechercher..." 
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['All', 'Unread', 'Groups', 'Private'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.toLowerCase() 
                  ? 'bg-[#D4AF37] text-black' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length > 0 ? (
          filteredConversations.map(conv => (
            <ConversationItem 
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onClick={() => {
                 selectConversation(conv.id);
                 if (onSelect) onSelect(); // For mobile layout handling
              }}
              currentUser={currentUser}
              users={users}
            />
          ))
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm">
            Aucune conversation trouvée.
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;