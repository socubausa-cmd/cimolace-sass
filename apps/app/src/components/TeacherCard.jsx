import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TeacherCard = ({ teacher, onContact }) => {
  const [avatarError, setAvatarError] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:shadow-xl hover:border-yellow-500/30 group"
    >
      <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden border-2 border-yellow-500/50 group-hover:border-yellow-500 transition-colors">
        {teacher.avatar && !avatarError ? (
          <img
            src={teacher.avatar}
            alt={teacher.name}
            className="w-full h-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <User className="w-10 h-10 text-gray-400" />
          </div>
        )}
      </div>
      
      <h3 className="text-xl font-serif font-bold text-white mb-1">{teacher.name}</h3>
      <p className="text-sm text-yellow-500 mb-4 uppercase tracking-wider">{teacher.role}</p>
      
      <Button 
        onClick={() => onContact(teacher)}
        variant="outline" 
        className="w-full border-white/20 text-gray-300 hover:text-white hover:bg-white/10 hover:border-yellow-500/50"
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        Poser une question
      </Button>
    </motion.div>
  );
};

export default TeacherCard;