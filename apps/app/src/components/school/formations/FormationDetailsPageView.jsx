import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  Layers,
  Clock,
  Users,
  Video,
  FileText,
  Presentation,
  ChevronLeft,
  ExternalLink,
  Edit,
  Sparkles,
} from 'lucide-react';
import FormationStatistics from './FormationStatistics';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const getAccessLabel = (formation) => {
  const mode = formation?.access_mode || formation?.meta?.access_mode || formation?.meta?.access?.mode || 'free';
  if (mode === 'subscription') return 'Abonnement';
  if (mode === 'one_time') return 'Vente module';
  return 'Gratuit';
};

const FormationDetailsPageView = ({ formation, onBack, onEdit, onPreview, isEditLoading, isPreviewLoading }) => {
  if (!formation) return null;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-400 hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Retour aux formations
          </Button>
        </motion.div>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden border bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-amber-500/10 border-white/10 mb-8"
        >
          <div className="absolute inset-0 bg-[#151a21]/90 backdrop-blur-sm" />
          <div className="relative">
            {/* Thumbnail banner */}
            <div className="h-48 md:h-56 bg-gray-800 relative overflow-hidden">
              {formation.thumbnail ? (
                <img src={formation.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#0F1419]">
                  <BookOpen className="w-16 h-16 text-gray-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#151a21] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3"
                >
                  <Sparkles className="w-4 h-4 text-[var(--school-accent)]" />
                  <span className="text-xs text-gray-400">Détails formation</span>
                </motion.div>
                <h1 className="text-2xl md:text-4xl font-serif font-bold text-white">
                  {formation.title}
                </h1>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className="bg-black/50 text-white backdrop-blur border border-white/10">
                    {formation.year}
                  </Badge>
                  <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]">
                    {getAccessLabel(formation)}
                  </Badge>
                  <Badge
                    className={
                      formation.status === 'published'
                        ? 'bg-emerald-500/90 text-black'
                        : formation.status === 'draft'
                          ? 'bg-amber-500/90 text-black'
                          : 'bg-gray-500/90 text-white'
                    }
                  >
                    {formation.status === 'published' ? 'Publié' : formation.status === 'draft' ? 'Brouillon' : 'Archivé'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8">
              <p className="text-gray-400 max-w-3xl line-clamp-2 mb-6">{formation.description}</p>

              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 mb-8">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--school-accent)]" />
                  {formation.modules?.length || 0} Modules
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--school-accent)]" />
                  {formation.duration || '—'}
                </span>
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--school-accent)]" />
                  {formation.enrolledStudents?.length || 0} Étudiants
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    onClick={onPreview}
                    disabled={isPreviewLoading}
                    className="bg-[var(--school-accent)] hover:bg-amber-500 text-black font-bold px-8 py-6 text-base shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] hover:shadow-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all group"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    {isPreviewLoading ? 'Chargement…' : 'Aperçu'}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={onEdit}
                    disabled={isEditLoading}
                    className="border-white/20 text-white hover:bg-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] px-8 py-6 text-base font-medium"
                  >
                    <Edit className="w-5 h-5 mr-2" />
                    {isEditLoading ? 'Chargement…' : 'Éditer'}
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl overflow-hidden border border-white/10 bg-[#151a21]/80 backdrop-blur-xl"
        >
          <div className="p-4 border-b border-white/10">
            <Tabs defaultValue="structure" className="w-full">
              <TabsList className="bg-transparent p-0 gap-2 flex flex-wrap">
                <TabsTrigger
                  value="structure"
                  className="data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black text-gray-400 px-5 py-2.5 rounded-xl transition-all"
                >
                  Structure & Contenu
                </TabsTrigger>
                <TabsTrigger
                  value="students"
                  className="data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black text-gray-400 px-5 py-2.5 rounded-xl transition-all"
                >
                  Étudiants Inscrits
                </TabsTrigger>
                <TabsTrigger
                  value="stats"
                  className="data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black text-gray-400 px-5 py-2.5 rounded-xl transition-all"
                >
                  Statistiques
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[50vh] min-h-[300px]">
                <div className="p-6">
                  <TabsContent value="structure" className="mt-0 space-y-4">
                    <Accordion type="multiple" className="w-full space-y-4">
                      {formation.modules?.map((module, idx) => (
                        <AccordionItem
                          key={module.id}
                          value={module.id}
                          className="border border-white/10 bg-[#151a21]/80 backdrop-blur rounded-xl px-4 shadow-lg"
                        >
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-4 text-left">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] font-bold text-sm">
                                {idx + 1}
                              </span>
                              <div>
                                <h4 className="font-bold text-white text-lg">{module.title}</h4>
                                <p className="text-sm text-gray-400">{module.weeks?.length} semaines</p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="space-y-6 pl-12 border-l border-white/5 ml-4 mt-2">
                              {module.weeks?.map((week) => (
                                <div key={week.id} className="space-y-3">
                                  <h5 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                                    {week.title}
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {week.days?.map((day) => (
                                      <div
                                        key={day.id}
                                        className="bg-black/40 p-4 rounded-xl border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors"
                                      >
                                        <p className="text-sm font-bold text-white mb-3 border-b border-white/10 pb-2">
                                          {day.title}
                                        </p>
                                        <div className="space-y-2">
                                          {day.videos?.map((video) => (
                                            <div
                                              key={video.id}
                                              className="flex items-center gap-2 text-sm text-gray-400"
                                            >
                                              <Video className="w-3 h-3 text-[var(--school-accent)]" />
                                              <span className="truncate flex-1">{video.title}</span>
                                              <span className="text-gray-600">{video.duration}m</span>
                                            </div>
                                          ))}
                                          {day.powerpoint && (
                                            <div className="flex items-center gap-2 text-xs text-blue-400">
                                              <Presentation className="w-3 h-3" />
                                              <span className="truncate">{day.powerpoint.title}</span>
                                            </div>
                                          )}
                                          {day.quiz && (
                                            <div className="flex items-center gap-2 text-xs text-green-400">
                                              <FileText className="w-3 h-3" />
                                              <span>Quiz de validation</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </TabsContent>

                  <TabsContent value="students" className="mt-0">
                    <div className="bg-[#151a21]/80 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-[#0F1419] text-gray-400 border-b border-white/10">
                          <tr>
                            <th className="p-4 font-medium">Étudiant</th>
                            <th className="p-4 font-medium">Date d'inscription</th>
                            <th className="p-4 font-medium">Progression</th>
                            <th className="p-4 font-medium">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {(formation.enrolledStudents || []).map((student) => (
                            <tr key={student.id} className="hover:bg-white/5 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarImage src={student.avatar} />
                                    <AvatarFallback>{student.name?.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-bold text-white">{student.name}</p>
                                    <p className="text-sm text-gray-500">{student.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-gray-400">
                                {student.enrollmentDate
                                  ? format(new Date(student.enrollmentDate), 'dd MMM yyyy', { locale: fr })
                                  : '—'}
                              </td>
                              <td className="p-4 w-48">
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={student.progress}
                                    className="h-2 bg-black/40"
                                    indicatorClassName="bg-[var(--school-accent)]"
                                  />
                                  <span className="text-xs text-white w-8">{student.progress}%</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge
                                  className={
                                    student.status === 'completed'
                                      ? 'bg-green-500/20 text-green-400'
                                      : student.status === 'suspended'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-blue-500/20 text-blue-400'
                                  }
                                >
                                  {student.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  <TabsContent value="stats" className="mt-0">
                    <FormationStatistics formation={formation} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FormationDetailsPageView;
