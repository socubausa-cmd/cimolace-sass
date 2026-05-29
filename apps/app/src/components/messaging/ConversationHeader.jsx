import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreVertical, Phone, Video, Info } from 'lucide-react';
import OnlineStatusIndicator from './OnlineStatusIndicator';

const ConversationHeader = ({ conversation }) => {
  if (!conversation) return null;

  // Determine online status for display
  const isOnline = conversation.type === 'private' && 
    conversation.participantsData?.find(p => p.id !== 'current')?.status === 'online';

  return (
    <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 bg-[#0F1419]/95 backdrop-blur z-10">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-10 w-10 border border-white/10">
            <AvatarImage src={conversation.image} />
            <AvatarFallback className="bg-gray-800 text-[#D4AF37]">
              {conversation.name?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {conversation.type === 'private' && (
             <div className="absolute -bottom-0.5 -right-0.5">
               <OnlineStatusIndicator status={isOnline ? 'online' : 'offline'} size="sm" />
             </div>
          )}
        </div>
        <div>
          <h3 className="font-bold text-white text-sm md:text-base leading-tight">
            {conversation.name}
          </h3>
          {conversation.type === 'private' ? (
            <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </span>
          ) : (
            <span className="text-sm text-gray-500">
              {conversation.participants.length} participants
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hidden sm:flex">
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hidden sm:flex">
          <Video className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <Info className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ConversationHeader;