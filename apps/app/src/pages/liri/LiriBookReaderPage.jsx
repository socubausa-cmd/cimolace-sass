import { lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import LiriSchoolShell from '@/pages/liri/LiriSchoolShell';

/**
 * LiriBookReaderPage — lecteur de livre de la bibliothèque DANS le portail LIRI
 * (`/liri/bibliotheque/:bookId`). Home /liri de l'ancienne sous-route
 * `/student-school-life/bibliotheque/:bookId` (orpheline). Même mapping de lecteurs.
 */
const BOOK_READERS = {
  'fond-de-tout': lazy(() => import('@/pages/FondDeToutPage')),
  'dialogue-physique': lazy(() => import('@/pages/DialoguePhysiquePage')),
  'ontodynamique': lazy(() => import('@/pages/OntodynamiquePage')),
  'manuel-initiatique-bris-de-sort': lazy(() => import('@/pages/ManuelInitiatiqueBrisDeSortPage')),
};

export default function LiriBookReaderPage() {
  const { bookId } = useParams();
  const Reader = BOOK_READERS[bookId];
  if (!Reader) return <Navigate to="/liri/bibliotheque" replace />;
  return (
    <LiriSchoolShell active="biblio-eleve">
      <div className="liri-book-reader">
        {/* Le lecteur a un fond sombre propre → transparent pour s'emboîter dans la coque chaude. */}
        <style>{`.liri-book-reader > div { background-color: transparent !important; min-height: auto !important; }`}</style>
        <Suspense fallback={null}><Reader /></Suspense>
      </div>
    </LiriSchoolShell>
  );
}
