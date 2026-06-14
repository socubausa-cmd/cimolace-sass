import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const mockCourses = [
  {
    id: 'cycle-disciple',
    title: 'Cycle Disciple',
    description: 'Les fondements essentiels pour structurer sa pensée et son approche.',
    duration: '3 mois',
    level: 'Débutant',
    nextStart: '2025-04-01'
  },
  {
    id: 'cycle-initie',
    title: 'Cycle Initié',
    description: 'Approfondissement des concepts et mise en pratique rigoureuse.',
    duration: '6 mois',
    level: 'Intermédiaire',
    nextStart: '2025-05-01'
  },
  {
    id: 'cycle-maitre',
    title: 'Cycle Maître',
    description: 'Expertise, transmission et maîtrise complète des arts.',
    duration: '12 mois',
    level: 'Avancé',
    nextStart: '2025-09-01'
  }
];

const CoursesPage = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/secretariat-space/dashboard">
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au secrétariat
            </Button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-2">Catalogue des Cours</h1>
          <p className="text-gray-400">Découvrez nos cycles d'apprentissage et programmes.</p>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {mockCourses.map((course) => (
            <Card key={course.id} className="bg-[#192734] border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2 py-1 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] text-xs font-bold rounded-full uppercase tracking-wider">
                    {course.level}
                  </span>
                  <BookOpen className="w-5 h-5 text-[var(--school-accent)]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{course.title}</h3>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">{course.description}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <Clock className="w-4 h-4 mr-2 text-[var(--school-accent)]" />
                    <span>Durée : {course.duration}</span>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <Calendar className="w-4 h-4 mr-2 text-[var(--school-accent)]" />
                    <span>Prochaine session : {new Date(course.nextStart).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                <Button className="w-full mt-6 bg-[var(--school-accent)] hover:bg-yellow-500 text-black font-bold">
                  Voir le programme
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <Card className="bg-[#192734] border-white/10">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-serif font-bold text-white mb-4">Besoin de conseils ?</h2>
            <p className="text-gray-400 mb-6">Notre équipe pédagogique vous accompagne dans le choix de votre parcours.</p>
            <Link to="/secretariat-space/dashboard">
              <Button variant="outline" className="border-white/20 text-white hover:bg-[var(--school-accent)] hover:text-black hover:border-[var(--school-accent)]">
                Contacter le secrétariat
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CoursesPage;
