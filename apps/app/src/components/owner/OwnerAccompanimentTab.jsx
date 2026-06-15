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
      <h2 className="text-2xl font-bold" style={{ color: 'var(--lt-text)' }}>Accompagnement & Mentoring</h2>

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
          railClassName="!bg-[var(--lt-inner-bg)] !border-[var(--lt-border)]"
          optionClassName="!text-zinc-500 [&.text-white]:!text-[var(--lt-text)] hover:!bg-black/[0.03]"
        />

        <TabsContent value="coaches" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map(coach => (
              <Card key={coach.id} className="border-0 transition-all" style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center font-bold" style={{ color: 'var(--lt-gold-ink)' }}>
                      {coach.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold" style={{ color: 'var(--lt-text)' }}>{coach.name}</h3>
                      <p className="text-sm text-zinc-500">{coach.specialty}</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-600 line-clamp-2">{coach.bio}</p>
                  <div className="flex flex-wrap gap-2">
                    {coach.availability.slice(0, 2).map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-[var(--lt-border)] flex justify-between items-center text-sm">
                    <span className="text-zinc-500">{coach.assignedStudents.length} Étudiants</span>
                    <Button variant="link" className="p-0 h-auto" style={{ color: 'var(--lt-gold-ink)' }}>Détails</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <Card className="border-0" style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}>
            <Table>
              <TableHeader className="bg-[var(--lt-inner-bg)]">
                <TableRow className="border-[var(--lt-border)] hover:bg-transparent">
                  <TableHead className="text-zinc-500">Service</TableHead>
                  <TableHead className="text-zinc-500">Type</TableHead>
                  <TableHead className="text-zinc-500">Description</TableHead>
                  <TableHead className="text-zinc-500 text-right">Prix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coachingServices.map(service => (
                  <TableRow key={service.id} className="border-[var(--lt-border)] hover:opacity-80">
                    <TableCell className="font-medium" style={{ color: 'var(--lt-text)' }}>{service.name}</TableCell>
                    <TableCell>
                      {service.type === 'video_call' && <Video className="h-4 w-4 text-blue-500" />}
                      {service.type === 'conference' && <Users className="h-4 w-4 text-violet-500" />}
                      {service.type === 'message' && <MessageSquare className="h-4 w-4 text-emerald-500" />}
                    </TableCell>
                    <TableCell className="text-zinc-500">{service.description}</TableCell>
                    <TableCell className="text-right font-bold" style={{ color: 'var(--lt-gold-ink)' }}>{service.price}€</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
           <div className="text-center py-10 text-zinc-500 rounded-[14px]" style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}>
              Aucune session active pour le moment.
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerAccompanimentTab;