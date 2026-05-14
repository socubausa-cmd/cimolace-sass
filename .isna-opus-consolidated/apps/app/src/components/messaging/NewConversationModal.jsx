import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Placeholder for now as this requires extensive UI for user selection
const NewConversationModal = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#192734] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Nouvelle Conversation</DialogTitle>
        </DialogHeader>
        <div className="py-8 text-center text-gray-400">
          Fonctionnalité en cours de développement...
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationModal;