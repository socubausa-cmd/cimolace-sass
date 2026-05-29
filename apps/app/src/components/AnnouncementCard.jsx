import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight } from 'lucide-react';

const AnnouncementCard = ({ announcement }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white/5 backdrop-blur-md border border-l-4 border-white/10 border-l-yellow-500 rounded-r-xl p-5 hover:bg-white/10 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="flex items-center text-xs text-yellow-500 font-medium">
          <Calendar className="w-3 h-3 mr-1" />
          {announcement.date}
        </span>
        <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-yellow-500 transition-colors transform group-hover:translate-x-1" />
      </div>
      <h4 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-100">{announcement.title}</h4>
      <p className="text-sm text-gray-400 line-clamp-2">{announcement.description}</p>
    </motion.div>
  );
};

export default AnnouncementCard;