import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

const MOCK_MESSAGES = [
  { id: 1, sender: 'Jean Dupont', avatar: '', message: 'Bonjour tout le monde !', time: '10:02', isMe: false },
  { id: 2, sender: 'Marie Curie', avatar: '', message: 'Prête pour le cours.', time: '10:03', isMe: false },
  { id: 3, sender: 'Moi', avatar: '', message: 'Salut ! Le son est bon ?', time: '10:04', isMe: true },
  { id: 4, sender: 'Professeur', avatar: '', message: 'Bienvenue à tous, nous commençons dans 2 minutes.', time: '10:05', isMe: false, role: 'instructor' },
];

const LiveChatComponent = () => {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msg = {
      id: Date.now(),
      sender: 'Moi',
      avatar: '',
      message: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true
    };

    setMessages([...messages, msg]);
    setNewMessage('');
    
    // Simulate typing response
    setTimeout(() => setIsTyping(true), 1000);
    setTimeout(() => {
       setIsTyping(false);
       setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'Jean Dupont',
          avatar: '',
          message: 'Oui le son est parfait !',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false
       }]);
    }, 2500);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full bg-[#192734] border-l border-white/10">
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <h3 className="font-bold text-white">Chat en direct</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
               <Avatar className="w-8 h-8">
                  <AvatarImage src={msg.avatar} />
                  <AvatarFallback className="text-xs bg-gray-700 text-gray-300">{msg.sender.substring(0,2).toUpperCase()}</AvatarFallback>
               </Avatar>
               <div className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className="flex items-center gap-2 mb-1">
                     <span className={`text-xs font-medium ${msg.role === 'instructor' ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                        {msg.sender}
                     </span>
                     <span className="text-[10px] text-gray-600">{msg.time}</span>
                  </div>
                  <div className={`p-3 rounded-lg text-sm ${
                     msg.isMe 
                        ? 'bg-[#D4AF37] text-black rounded-tr-none' 
                        : msg.role === 'instructor' 
                           ? 'bg-[#1d3344] border border-[#D4AF37]/30 text-white rounded-tl-none'
                           : 'bg-[#0F1419] text-gray-200 rounded-tl-none'
                  }`}>
                     {msg.message}
                  </div>
               </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-400">...</div>
                <div className="bg-[#0F1419] p-3 rounded-lg rounded-tl-none">
                   <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-75"></span>
                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                   </div>
                </div>
             </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-white/10 bg-[#15202B]">
        <form onSubmit={handleSendMessage} className="flex gap-2">
           <Input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrivez un message..."
              className="bg-[#0F1419] border-white/10 text-white focus-visible:ring-[#D4AF37]"
           />
           <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-[#D4AF37]">
              <Smile className="w-5 h-5" />
           </Button>
           <Button type="submit" size="icon" className="bg-[#D4AF37] text-black hover:bg-yellow-500">
              <Send className="w-4 h-4" />
           </Button>
        </form>
      </div>
    </div>
  );
};

export default LiveChatComponent;