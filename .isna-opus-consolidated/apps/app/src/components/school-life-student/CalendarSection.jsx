import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Video, Calendar as CalIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CalendarSection = ({ data }) => {
  const { calendar = [] } = data;
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Grid logic: pad start
  const startDayOfWeek = monthStart.getDay(); // 0 is Sunday
  const paddingDays = Array.from({ length: (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1) }); // Adjust for Mon start

  const getEventsForDay = (date) => calendar.filter(ev => isSameDay(new Date(ev.date), date));

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center bg-[#192734] p-4 rounded-xl border border-white/10">
          <h3 className="text-xl font-bold text-white capitalize">{format(currentDate, 'MMMM yyyy', {locale: fr})}</h3>
          <div className="flex gap-2">
             <Button size="icon" variant="ghost" onClick={prevMonth} className="text-white hover:bg-white/10"><ChevronLeft className="w-5 h-5"/></Button>
             <Button size="icon" variant="ghost" onClick={nextMonth} className="text-white hover:bg-white/10"><ChevronRight className="w-5 h-5"/></Button>
          </div>
       </div>

       <div className="grid grid-cols-7 gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
             <div key={day} className="bg-[#15202B] p-3 text-center text-sm font-bold text-gray-400">{day}</div>
          ))}
          
          {paddingDays.map((_, i) => <div key={`pad-${i}`} className="bg-[#15202B] min-h-[100px] opacity-50"></div>)}
          
          {daysInMonth.map(day => {
             const events = getEventsForDay(day);
             const isTodayDate = isToday(day);
             return (
                <div key={day.toISOString()} className={`bg-[#192734] min-h-[100px] p-2 hover:bg-white/5 transition-colors ${isTodayDate ? 'bg-[#D4AF37]/5' : ''}`}>
                   <div className={`text-right text-sm font-bold mb-2 ${isTodayDate ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                      {format(day, 'd')}
                   </div>
                   <div className="space-y-1">
                      {events.map(ev => (
                         <div key={ev.id} className="text-xs p-1 rounded bg-black/40 border border-white/5 truncate flex items-center gap-1" title={ev.title}>
                            <div className={`w-1.5 h-1.5 rounded-full ${ev.type === 'coaching' ? 'bg-blue-400' : ev.type === 'live' ? 'bg-red-400' : 'bg-green-400'}`}></div>
                            <span className="text-gray-300">{ev.title}</span>
                         </div>
                      ))}
                   </div>
                </div>
             );
          })}
       </div>

       <div className="flex gap-4 text-sm text-gray-400 justify-center">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Coaching</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Live</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400"></div> Atelier</span>
       </div>
    </div>
  );
};

export default CalendarSection;