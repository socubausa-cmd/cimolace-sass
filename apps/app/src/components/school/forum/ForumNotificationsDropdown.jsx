import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  MessageSquare,
  Heart,
  CheckCircle2,
  AtSign,
  X,
  Loader2,
} from 'lucide-react';
import { useForumNotifications } from '@/hooks/useForumNotifications';
import { cn } from '@/lib/utils';

const iconByType = {
  new_reply: MessageSquare,
  reply_to_reply: MessageSquare,
  vote: Heart,
  solution: CheckCircle2,
  mention: AtSign,
  subscription: Bell,
  moderation: Bell,
};

const labelByType = {
  new_reply: 'Nouvelle réponse',
  reply_to_reply: 'Réponse à votre commentaire',
  vote: 'Nouveau vote',
  solution: 'Solution acceptée',
  mention: 'Vous avez été mentionné',
  subscription: 'Nouveau suivi',
  moderation: 'Modération',
};

export default function ForumNotificationsDropdown({ userId }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);
  
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useForumNotifications(userId);

  // Fermer au clic extérieur
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          isOpen ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-600'
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucune notification</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notif) => {
                    const Icon = iconByType[notif.type] || Bell;
                    return (
                      <Link
                        key={notif.id}
                        to={notif.question_id 
                          ? `/student-school-life/forum/thread/${notif.question_id}`
                          : '/student-school-life/forum'
                        }
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          'flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors',
                          !notif.is_read && 'bg-indigo-50/30'
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          notif.is_read ? 'bg-gray-100' : 'bg-indigo-100'
                        )}>
                          <Icon className={cn(
                            'w-4 h-4',
                            notif.is_read ? 'text-gray-500' : 'text-indigo-600'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm',
                            notif.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'
                          )}>
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {labelByType[notif.type]}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-2">
              <Link
                to="/student-school-life/forum"
                onClick={() => setIsOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Voir toutes les notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
