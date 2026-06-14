import React, { useRef, useEffect } from 'react';
import { useMessaging } from '@/contexts/MessagingContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import TypingIndicator from './TypingIndicator';

const MessageBubble = ({ message, isMe, showAvatar }) => {
  return (
    <div className={`flex gap-3 mb-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}>
       {/* Avatar only if not me */}
       {!isMe && (
         <div className="w-8 flex-shrink-0 flex flex-col justify-end">
           {showAvatar ? (
             <Avatar className="h-8 w-8 border border-white/10">
               <AvatarImage src={message.senderAvatar} />
               <AvatarFallback className="text-[10px] bg-gray-700 text-gray-300">
                  {message.senderName?.substring(0,2).toUpperCase()}
               </AvatarFallback>
             </Avatar>
           ) : <div className="w-8" />}
         </div>
       )}
       
       <div className={`max-w-[70%] sm:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
          {/* Sender Name if Group & not me & showAvatar */}
          {!isMe && showAvatar && (
            <span className="text-[10px] text-gray-400 ml-1 mb-1">{message.senderName}</span>
          )}

          <div 
            className={`px-4 py-2 rounded-2xl text-sm relative shadow-sm ${
              isMe 
                ? 'bg-[var(--school-accent)] text-black rounded-br-none' 
                : 'bg-[#192734] text-gray-100 border border-white/10 rounded-bl-none'
            }`}
          >
            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            <span className={`text-[9px] block text-right mt-1 opacity-70 ${isMe ? 'text-black/60' : 'text-gray-400'}`}>
              {format(new Date(message.timestamp), 'HH:mm')}
            </span>
          </div>

          {/* Reactions (Simple Placeholder) */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
             <div className={`flex gap-1 mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                {Object.keys(message.reactions).map(emoji => (
                   <span key={emoji} className="text-xs bg-[#0F1419] border border-white/10 px-1.5 py-0.5 rounded-full text-gray-300">
                      {emoji} <span className="text-[9px]">{message.reactions[emoji].length}</span>
                   </span>
                ))}
             </div>
          )}
       </div>
    </div>
  );
};

const MessagesArea = ({ messages, currentUser }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group messages by Date
  const groupedMessages = messages.reduce((acc, msg) => {
     const date = format(new Date(msg.timestamp), 'yyyy-MM-dd');
     if (!acc[date]) acc[date] = [];
     acc[date].push(msg);
     return acc;
  }, {});

  const renderDateHeader = (dateStr) => {
     const date = new Date(dateStr);
     let label = format(date, 'd MMMM yyyy', { locale: fr });
     if (isToday(date)) label = "Aujourd'hui";
     if (isYesterday(date)) label = "Hier";

     return (
        <div className="flex justify-center my-6 sticky top-2 z-10">
           <span className="bg-[#192734]/80 backdrop-blur border border-white/10 text-gray-400 text-xs px-3 py-1 rounded-full shadow-sm">
             {label}
           </span>
        </div>
     );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0B0E11] relative">
      {Object.keys(groupedMessages).map(date => (
        <React.Fragment key={date}>
           {renderDateHeader(date)}
           {groupedMessages[date].map((msg, idx, arr) => {
              const isMe = msg.senderId === currentUser?.id;
              // Show avatar if first in sequence from same sender
              const prevMsg = arr[idx-1];
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
              
              return (
                 <MessageBubble 
                   key={msg.id} 
                   message={msg} 
                   isMe={isMe} 
                   showAvatar={showAvatar} 
                 />
              );
           })}
        </React.Fragment>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessagesArea;