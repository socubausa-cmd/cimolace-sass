import React from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Video, Users, MessageSquare } from 'lucide-react';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const OwnerAccompanimentTab = () => {
  const { coaches, coachingServices } = useDataSync();
  const [activeTab, setActiveTab] = React.useState('coaches');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Accompagnement & Mentoring</h2>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <PremiumSegmentedSelector
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'coaches', label: 'Coachs & mentors', badge: `${coaches.length}` },
            { value: 'services', label: 'Services', badge: `${coachingServices.length}` },
            { value: 'sessions', label: 'Sessions' },
          ]}
          layoutId="owner-accompaniment-tab-segment-pill"
          className="mb-2"
          compact
          showChevron={false}
        />

        <TabsContent value="coaches" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map(coach => (
              <Card key={coach.id} className="bg-[#192734] border-white/10 hover:border-[#D4AF37]/50 transition-all">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold">
                      {coach.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{coach.name}</h3>
                      <p className="text-sm text-gray-400">{coach.specialty}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{coach.bio}</p>
                  <div className="flex flex-wrap gap-2">
                    {coach.availability.slice(0, 2).map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center text-sm">
                    <span className="text-gray-500">{coach.assignedStudents.length} Étudiants</span>
                    <Button variant="link" className="text-[#D4AF37] p-0 h-auto">Détails</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <Card className="bg-[#192734] border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400">Service</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Description</TableHead>
                  <TableHead className="text-gray-400 text-right">Prix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coachingServices.map(service => (
                  <TableRow key={service.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-medium text-white">{service.name}</TableCell>
                    <TableCell>
                      {service.type === 'video_call' && <Video className="h-4 w-4 text-blue-400" />}
                      {service.type === 'conference' && <Users className="h-4 w-4 text-purple-400" />}
                      {service.type === 'message' && <MessageSquare className="h-4 w-4 text-green-400" />}
                    </TableCell>
                    <TableCell className="text-gray-400">{service.description}</TableCell>
                    <TableCell className="text-right text-[#D4AF37] font-bold">{service.price}€</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
           <div className="text-center py-10 text-gray-500 bg-[#192734] rounded-lg border border-white/10">
              Aucune session active pour le moment.
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerAccompanimentTab;