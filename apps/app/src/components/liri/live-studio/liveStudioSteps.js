/**
 * Étapes du Studio de création live — icônes Lucide + libellés stepper (maquette).
 */
import {
  FileText,
  Image,
  CalendarDays,
  Shield,
  UserPlus,
  Monitor,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export const LIVE_STUDIO_STEPS = [
  { id: 1, key: 'informations', label: 'Informations', progressLabel: 'INFORMATIONS', icon: FileText },
  { id: 2, key: 'couverture', label: 'Couverture', progressLabel: 'COUVERTURE', icon: Image },
  { id: 3, key: 'date', label: 'Date & horaire', progressLabel: 'DATE & HORAIRE', icon: CalendarDays },
  { id: 4, key: 'securite', label: 'Sécurité', progressLabel: 'SÉCURITÉ', icon: Shield },
  { id: 5, key: 'inviter', label: 'Inviter', progressLabel: 'INVITER', icon: UserPlus },
  { id: 6, key: 'salle', label: 'Salle virtuelle', progressLabel: 'SALLE VIRTUELLE', icon: Monitor },
  { id: 7, key: 'interactions', label: 'Interactions & IA', progressLabel: 'INTERACTIONS & IA', icon: Sparkles },
  { id: 8, key: 'validation', label: 'Validation', progressLabel: 'VALIDATION', icon: CheckCircle2 },
];
