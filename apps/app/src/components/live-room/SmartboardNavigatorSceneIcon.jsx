/**
 * Icônes vectorielles pour le navigateur de scènes SmartBoard — jeu distinct et lisible.
 */
import {
  Sparkles,
  FileStack,
  Cast,
  Globe,
  Frame,
  ClipboardList,
  PenTool,
  Image,
  Video,
  Store,
  Smartphone,
  LayoutGrid,
} from 'lucide-react';

const BY_ID = {
  smartboard: Sparkles,
  diapo: FileStack,
  screen: Cast,
  browser: Globe,
  embed: Frame,
  quiz: ClipboardList,
  secure_app_share: Smartphone,
  board: PenTool,
  image: Image,
  camera2: Video,
  shop: Store,
};

export function SmartboardNavigatorSceneIcon({
  sceneId,
  className,
  strokeWidth = 1.5,
}) {
  const Icon = BY_ID[sceneId] || LayoutGrid;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
