/**
 * Sidebar des étapes — StudioBuilder (mode Formation).
 * Rendu unifié avec le mode Live : on délègue à la timeline verticale progressive
 * (LiveStudioSidebar) pour un stepper identique dans tout le Studio de création.
 */
import React from 'react';
import { LiveStudioSidebar } from '@/components/liri/live-studio/LiveStudioSidebar';

export function StudioSidebar(props) {
  return <LiveStudioSidebar {...props} />;
}
