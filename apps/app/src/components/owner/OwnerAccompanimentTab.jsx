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
      <h2 className="text-2xl font-bold" style={{ color: '#18181B' }}>Accompagnement & Mentoring</h2>

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
          railClassName="!bg-[#F4F5F7] !border-black/5"
          optionClassName="!text-zinc-500 [&.text-white]:!text-zinc-900 hover:!bg-black/[0.03]"
        />

        <TabsContent value="coaches" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map(coach => (
              <Card key={coach.id} className="border-0 transition-all" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center font-bold" style={{ color: '#8A6D1A' }}>
                      {coach.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold" style={{ color: '#18181B' }}>{coach.name}</h3>
                      <p className="text-sm text-zinc-500">{coach.specialty}</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-600 line-clamp-2">{coach.bio}</p>
                  <div className="flex flex-wrap gap-2">
                    {coach.availability.slice(0, 2).map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-black/[0.06] flex justify-between items-center text-sm">
                    <span className="text-zinc-500">{coach.assignedStudents.length} Étudiants</span>
                    <Button variant="link" className="p-0 h-auto" style={{ color: '#8A6D1A' }}>Détails</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <Card className="border-0" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Table>
              <TableHeader className="bg-[#F8F8FA]">
                <TableRow className="border-black/[0.06] hover:bg-transparent">
                  <TableHead className="text-zinc-500">Service</TableHead>
                  <TableHead className="text-zinc-500">Type</TableHead>
                  <TableHead className="text-zinc-500">Description</TableHead>
                  <TableHead className="text-zinc-500 text-right">Prix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coachingServices.map(service => (
                  <TableRow key={service.id} className="border-black/[0.06] hover:bg-zinc-50">
                    <TableCell className="font-medium" style={{ color: '#18181B' }}>{service.name}</TableCell>
                    <TableCell>
                      {service.type === 'video_call' && <Video className="h-4 w-4 text-blue-500" />}
                      {service.type === 'conference' && <Users className="h-4 w-4 text-violet-500" />}
                      {service.type === 'message' && <MessageSquare className="h-4 w-4 text-emerald-500" />}
                    </TableCell>
                    <TableCell className="text-zinc-500">{service.description}</TableCell>
                    <TableCell className="text-right font-bold" style={{ color: '#8A6D1A' }}>{service.price}€</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
           <div className="text-center py-10 text-zinc-500 rounded-[14px]" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              Aucune session active pour le moment.
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerAccompanimentTab;