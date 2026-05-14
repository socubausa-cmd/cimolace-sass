import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/customSupabaseClient';
import { createLiveRoom } from '@/services/livekitApi';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, Hand,
  MessageSquare, Users, FileText, Settings, BarChart2, MoreHorizontal,
  Send, Smile
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ParticipantsPanel from '@/components/classroom/ParticipantsPanel';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const LiveChat = () => {
   const [messages, setMessages] = useState([
      { id: 1, sender: 'Jean Dupont', message: 'Bonjour !', time: '10:00' },
      { id: 2, sender: 'Marie Curie', message: 'Prête.', time: '10:01' }
   ]);
   const [input, setInput] = useState('');

   const sendMessage = (e) => {
      e.preventDefault();
      if(!input.trim()) return;
      setMessages([...messages, { id: Date.now(), sender: 'Moi', message: input, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isMe: true }]);
      setInput('');
   }

   return (
      <div className="flex flex-col h-full">
         <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
               {messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400">{msg.sender}</span>
                        <span className="text-[10px] text-gray-600">{msg.time}</span>
                     </div>
                     <div className={`p-2 rounded-lg text-sm max-w-[85%] ${msg.isMe ? 'bg-[#D4AF37] text-black' : 'bg-[#1F2937] text-white'}`}>
                        {msg.message}
                     </div>
                  </div>
               ))}
            </div>
         </ScrollArea>
         <div className="p-3 border-t border-white/10 bg-[#15202B]">
            <form onSubmit={sendMessage} className="flex gap-2">
               <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Message..." className="bg-transparent border-white/20 text-white" />
               <Button size="icon" type="submit" className="bg-[#D4AF37] text-black hover:bg-yellow-500"><Send className="w-4 h-4" /></Button>
            </form>
         </div>
      </div>
   )
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LiveClassroomPage = () => {
  const { classId, sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const liveSessionId = sessionId || (UUID_REGEX.test(classId) ? classId : null);
  const [session, setSession] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [starting, setStarting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('chat');

  useEffect(() => {
    if (!liveSessionId) return;
    supabase
      .from('live_sessions')
      .select('id, title, teacher_id, status, visibility_mode')
      .eq('id', liveSessionId)
      .maybeSingle()
      .then(({ data }) => {
        setSession(data);
        setIsTeacher(data?.teacher_id === user?.id);
      });
  }, [liveSessionId, user?.id]);

  const handleStartSession = async () => {
    if (!liveSessionId) return;
    setStarting(true);
    try {
      await createLiveRoom(liveSessionId);
      setSession((s) => (s ? { ...s, status: 'live' } : s));
    } catch (err) {
      alert(err?.message || 'Erreur');
    } finally {
      setStarting(false);
    }
  };

  const handleLeave = () => {
    if (window.confirm("Voulez-vous vraiment quitter la classe ?")) {
      navigate(liveSessionId ? '/student-school-life/agenda' : '/classroom/live');
    }
  };

  if (liveSessionId && session) {
    if (session.status !== 'live') {
      if (isTeacher) {
        return (
          <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <h1 className="text-xl font-bold text-white mb-2">{session.title}</h1>
              <p className="text-gray-400 mb-6">La session n&apos;est pas encore ouverte.</p>
              <button
                onClick={handleStartSession}
                disabled={starting}
                className="px-6 py-3 bg-[#D4AF37] text-black font-bold rounded-lg hover:bg-amber-500 disabled:opacity-50"
              >
                {starting ? 'Ouverture...' : 'Démarrer la session'}
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-gray-400">La session n&apos;est pas encore ouverte. Revenez plus tard.</p>
          </div>
        </div>
      );
    }

    // Même expérience que l’hôte : salle LIRI complète (SmartBoard, LiveControlsBar, etc.)
    return <Navigate to={`/live/${liveSessionId}`} replace />;
  }

  if (liveSessionId && !session) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#000] text-white flex flex-col overflow-hidden">
       {/* Header */}
       <header className="h-14 bg-[#192734] border-b border-white/10 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <Badge className="bg-red-600 animate-pulse text-[10px] px-2">EN DIRECT</Badge>
                <h1 className="font-bold text-sm md:text-base">Introduction à la Cosmologie</h1>
             </div>
             <span className="text-sm text-gray-400 hidden md:inline">| Dr. Sarah Connor</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 text-xs font-mono text-gray-300 bg-white/5 px-2 py-1 rounded">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                42 participants
             </div>
             <Button onClick={handleLeave} variant="destructive" size="sm" className="font-bold">
                Quitter
             </Button>
          </div>
       </header>

       {/* Main Layout */}
       <div className="flex-1 flex overflow-hidden">
          
          {/* Main Video Area (70%) */}
          <div className="flex-1 flex flex-col relative bg-[#0F1419]">
             {/* Simulated Video Feed */}
             <div className="flex-1 relative flex items-center justify-center bg-gray-900">
                <img 
                   src="https://source.unsplash.com/random/1920x1080?professor,teaching" 
                   alt="Instructor Feed" 
                   className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                   Dr. Sarah Connor
                </div>
                
                {/* Participant Grid Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar px-2">
                   {[1,2,3,4].map(i => (
                      <div key={i} className="w-32 h-24 bg-gray-800 rounded-lg shrink-0 border border-white/10 relative overflow-hidden shadow-lg">
                         <img src={`https://i.pravatar.cc/150?u=${i+10}`} alt="" className="w-full h-full object-cover" />
                         <div className="absolute bottom-1 left-1 text-[10px] bg-black/50 px-1 rounded truncate max-w-[90%] text-white">Étudiant {i}</div>
                      </div>
                   ))}
                </div>
             </div>

             {/* Controls Bar */}
             <div className="h-16 bg-[#192734] border-t border-white/10 flex items-center justify-center gap-4 px-4 shrink-0 z-20">
                <TooltipProvider>
                   <Tooltip>
                      <TooltipTrigger asChild>
                         <Button 
                            variant="secondary" 
                            size="icon" 
                            className={`rounded-full h-10 w-10 ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                            onClick={() => setIsMuted(!isMuted)}
                         >
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                         </Button>
                      </TooltipTrigger>
                      <TooltipContent>Microphone</TooltipContent>
                   </Tooltip>

                   <Tooltip>
                      <TooltipTrigger asChild>
                         <Button 
                            variant="secondary" 
                            size="icon" 
                            className={`rounded-full h-10 w-10 ${isVideoOff ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                            onClick={() => setIsVideoOff(!isVideoOff)}
                         >
                            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                         </Button>
                      </TooltipTrigger>
                      <TooltipContent>Caméra</TooltipContent>
                   </Tooltip>
                   
                   <div className="w-px h-8 bg-white/10 mx-2"></div>

                   <Button variant="ghost" size="icon" className="text-gray-400 hover:text-[#D4AF37] rounded-full">
                      <Monitor className="w-5 h-5" />
                   </Button>
                   <Button variant="ghost" size="icon" className="text-gray-400 hover:text-[#D4AF37] rounded-full">
                      <Hand className="w-5 h-5" />
                   </Button>
                   <div className="w-px h-8 bg-white/10 mx-2"></div>
                   <div className="flex lg:hidden gap-2">
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-[#D4AF37] rounded-full" onClick={() => setActiveSidebarTab('chat')}>
                         <MessageSquare className="w-5 h-5" />
                      </Button>
                   </div>
                </TooltipProvider>
             </div>
          </div>

          {/* Sidebar (30%) */}
          <div className={`hidden lg:flex w-96 flex-col bg-[#192734] border-l border-white/10`}>
             <Tabs value={activeSidebarTab} onValueChange={setActiveSidebarTab} className="flex-1 flex flex-col">
                <div className="p-2 border-b border-white/10 bg-[#0F1419]">
                  <PremiumSegmentedSelector
                    value={activeSidebarTab}
                    onChange={setActiveSidebarTab}
                    layoutId="live-classroom-sidebar-segment-pill"
                    compact
                    showChevron={false}
                    options={[
                      { value: 'chat', label: 'Chat', badge: 'Direct', icon: MessageSquare },
                      { value: 'participants', label: 'Participants', badge: 'Présents', icon: Users },
                      { value: 'resources', label: 'Notes', badge: 'Personnel', icon: FileText },
                    ]}
                  />
                </div>
                
                <TabsContent value="chat" className="flex-1 m-0 h-full overflow-hidden">
                   <LiveChat />
                </TabsContent>
                <TabsContent value="participants" className="flex-1 m-0 h-full overflow-hidden">
                   <ParticipantsPanel />
                </TabsContent>
                <TabsContent value="resources" className="flex-1 m-0 p-4">
                   <textarea className="w-full h-full bg-[#0F1419] rounded-lg border border-white/10 p-4 text-white resize-none focus:outline-none focus:border-[#D4AF37]" placeholder="Vos notes personnelles..." />
                </TabsContent>
             </Tabs>
          </div>
       </div>
    </div>
  );
};

export default LiveClassroomPage;