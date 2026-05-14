import React, { useState } from 'react';
import { Search, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const MOCK_PARTICIPANTS = [
  { id: 1, name: 'Dr. Sarah Connor', role: 'instructor', status: 'online', isMuted: false, isVideoOff: false, avatar: 'https://i.pravatar.cc/150?u=sarah' },
  { id: 2, name: 'Jean Dupont', role: 'student', status: 'online', isMuted: true, isVideoOff: true, avatar: '' },
  { id: 3, name: 'Marie Curie', role: 'student', status: 'online', isMuted: true, isVideoOff: false, avatar: 'https://i.pravatar.cc/150?u=marie' },
  { id: 4, name: 'Albert Einstein', role: 'student', status: 'away', isMuted: true, isVideoOff: true, avatar: 'https://i.pravatar.cc/150?u=albert' },
  { id: 5, name: 'Isaac Newton', role: 'student', status: 'online', isMuted: false, isVideoOff: false, avatar: '' },
  { id: 6, name: 'Niels Bohr', role: 'student', status: 'online', isMuted: true, isVideoOff: true, avatar: '' },
];

const ParticipantsPanel = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredParticipants = MOCK_PARTICIPANTS.filter(p => 
     p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#192734] border-l border-white/10">
       <div className="p-4 border-b border-white/10 space-y-4">
          <div className="flex justify-between items-center">
             <h3 className="font-bold text-white">Participants</h3>
             <Badge variant="outline" className="text-[#D4AF37] border-[#D4AF37]">{MOCK_PARTICIPANTS.length}</Badge>
          </div>
          <div className="relative">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
             <Input 
                placeholder="Rechercher..." 
                className="pl-9 bg-[#0F1419] border-white/10 text-white h-9 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
       </div>

       <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
             {filteredParticipants.map(participant => (
                <div key={participant.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 group">
                   <div className="flex items-center gap-3">
                      <div className="relative">
                         <Avatar className="w-9 h-9 border border-white/10">
                            <AvatarImage src={participant.avatar} />
                            <AvatarFallback className="bg-gray-700 text-gray-300">{participant.name.substring(0,2).toUpperCase()}</AvatarFallback>
                         </Avatar>
                         <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#192734] ${
                            participant.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'
                         }`}></span>
                      </div>
                      <div>
                         <p className="text-sm font-medium text-white flex items-center gap-2">
                            {participant.name}
                            {participant.role === 'instructor' && <Badge className="h-4 px-1 text-[9px] bg-[#D4AF37] text-black hover:bg-[#D4AF37]">Hôte</Badge>}
                         </p>
                         <p className="text-[10px] text-gray-500 capitalize">{participant.status}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-1 text-gray-400">
                      {participant.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5" />}
                      {participant.isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-red-400" /> : <Video className="w-3.5 h-3.5" />}
                   </div>
                </div>
             ))}
          </div>
       </ScrollArea>
    </div>
  );
};

export default ParticipantsPanel;