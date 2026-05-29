import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';
import { useDataSync } from '@/contexts/DataSyncContext';

const ZoomMeetingCreator = ({ onMeetingCreated }) => {
   const { addZoomMeeting } = useDataSync();
   const [generatedLink, setGeneratedLink] = useState(null);

   const handleCreate = () => {
      const link = `https://zoom.us/j/${Math.floor(Math.random() * 1000000000)}?pwd=mock`;
      const meeting = {
         id: `zoom-${Date.now()}`,
         joinUrl: link,
         topic: "Session de Coaching",
         startTime: new Date().toISOString()
      };
      
      addZoomMeeting(meeting);
      setGeneratedLink(link);
      if (onMeetingCreated) onMeetingCreated(link);
   };

   if (generatedLink) {
      return (
         <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-blue-400 text-sm break-all">
            {generatedLink}
         </div>
      );
   }

   return (
      <Button onClick={handleCreate} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white w-full">
         <Video className="w-4 h-4 mr-2" /> Créer Lien Zoom
      </Button>
   );
};

export default ZoomMeetingCreator;