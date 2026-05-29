import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, User, CheckCheck, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

const AnnouncementCard = ({ announcement, onToggleRead }) => (
  <Card className={cn("mb-4 transition-all hover:shadow-md border-white/10 bg-[#192734]", announcement.isRead ? "opacity-75" : "border-l-4 border-l-[#D4AF37]")}>
    <CardContent className="p-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={announcement.type === 'official' ? "default" : "secondary"} 
                   className={cn(announcement.type === 'official' ? "bg-blue-600" : "bg-purple-600")}>
              {announcement.type === 'official' ? 'Officiel' : 'Personnel'}
            </Badge>
            <span className="text-sm text-gray-400">
              {format(new Date(announcement.date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </span>
            <Badge variant="outline" className="text-xs border-white/20 text-gray-300">
              {announcement.category}
            </Badge>
          </div>
          <h3 className={cn("text-lg font-bold mb-1 text-white", announcement.isRead && "font-normal")}>
            {announcement.title}
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            {announcement.description}
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onToggleRead(announcement.id)}
          title={announcement.isRead ? "Marquer comme non-lu" : "Marquer comme lu"}
          className="text-gray-400 hover:text-[#D4AF37]"
        >
          {announcement.isRead ? <CheckCheck className="w-5 h-5 text-green-500" /> : <Eye className="w-5 h-5" />}
        </Button>
      </div>
    </CardContent>
  </Card>
);

const AnnouncementsSection = ({ data, onUpdate }) => {
  const [filter, setFilter] = useState('all'); // all, official, personal

  const handleToggleRead = (id) => {
    const updated = data.map(a => a.id === id ? { ...a, isRead: !a.isRead } : a);
    onUpdate(updated);
  };

  const filteredData = data.filter(a => {
    if (filter === 'all') return true;
    return a.type === filter;
  });

  const unreadCount = data.filter(a => !a.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <Bell className="w-6 h-6 text-[#D4AF37]" />
             Annonces
           </h2>
           <p className="text-gray-400">Restez informé des dernières nouvelles.</p>
        </div>
        <div className="flex items-center gap-4">
           {unreadCount > 0 && (
             <Badge variant="destructive" className="animate-pulse">
               {unreadCount} non lues
             </Badge>
           )}
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setFilter}>
        <TabsList className="bg-[#192734] border border-white/10">
          <TabsTrigger value="all">Tout</TabsTrigger>
          <TabsTrigger value="official" className="flex gap-2"><Bell className="w-3 h-3"/> Officielles</TabsTrigger>
          <TabsTrigger value="personal" className="flex gap-2"><User className="w-3 h-3"/> Personnelles</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {filteredData.length > 0 ? (
          filteredData.map(ann => (
            <AnnouncementCard key={ann.id} announcement={ann} onToggleRead={handleToggleRead} />
          ))
        ) : (
          <div className="text-center py-12 bg-[#192734]/50 rounded-xl border border-white/5 border-dashed">
            <p className="text-gray-500">Aucune annonce à afficher.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsSection;