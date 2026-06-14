import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Smile, Mic, Image as ImageIcon } from 'lucide-react';
import { useMessaging } from '@/contexts/MessagingContext';

const MessageInput = ({ onSend }) => {
  const [content, setContent] = useState('');

  const handleSend = () => {
    if (!content.trim()) return;
    onSend(content);
    setContent('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-white/10 bg-[#0F1419]">
      <div className="flex items-end gap-2 bg-[#192734] p-2 rounded-xl border border-white/10 focus-within:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors">
        <div className="flex pb-2 gap-1">
           <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-[var(--school-accent)] rounded-full">
             <Paperclip className="w-4 h-4" />
           </Button>
           <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-[var(--school-accent)] rounded-full hidden sm:flex">
             <ImageIcon className="w-4 h-4" />
           </Button>
        </div>
        
        <Textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrivez votre message..." 
          className="min-h-[40px] max-h-[120px] bg-transparent border-none resize-none focus-visible:ring-0 text-sm py-3 text-white placeholder:text-gray-500"
          rows={1}
        />

        <div className="flex pb-2 gap-1">
           <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-[var(--school-accent)] rounded-full">
             <Smile className="w-4 h-4" />
           </Button>
           {content.trim() ? (
             <Button onClick={handleSend} size="icon" className="h-8 w-8 bg-[var(--school-accent)] text-black hover:bg-yellow-500 rounded-full transition-all">
               <Send className="w-4 h-4 ml-0.5" />
             </Button>
           ) : (
             <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white rounded-full">
               <Mic className="w-4 h-4" />
             </Button>
           )}
        </div>
      </div>
    </div>
  );
};

export default MessageInput;