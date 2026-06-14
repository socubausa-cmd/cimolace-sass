import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bell, Check, Trash2, Mail, CreditCard, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/hooks/useAuth';

const NotificationCenter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!user?.id) {
        setNotifications([]);
        return;
      }
      const { data } = await supabase
        .from('notifications')
        .select('id,user_id,title,message,type,is_read,created_at,action_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!alive) return;
      setNotifications(data || []);
    };
    load();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const ch = supabase
      .channel(`notifications-center-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase
            .from('notifications')
            .select('id,user_id,title,message,type,is_read,created_at,action_url')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(200);
          setNotifications(data || []);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const markAsRead = async (id) => {
    if (!id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };
  const markAllAsRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };
  const deleteNotification = async (id) => {
    if (!id) return;
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const uiNotifications = useMemo(
    () =>
      notifications.map((n) => ({
        ...n,
        isRead: n.is_read,
        timestamp: n.created_at,
      })),
    [notifications]
  );

  const getIcon = (type) => {
     switch(type) {
        case 'message': return <Mail className="w-5 h-5 text-blue-400" />;
        case 'payment_received': return <CreditCard className="w-5 h-5 text-green-400" />;
        case 'formation_enrolled': return <BookOpen className="w-5 h-5 text-[var(--school-accent)]" />;
        case 'appointment': return <Bell className="w-5 h-5 text-amber-400" />;
        default: return <Bell className="w-5 h-5 text-gray-400" />;
     }
  };

  const openNotificationTarget = (notif) => {
    const target = notif.action_url;
    if (!target) return;
    if (String(target).startsWith('http')) {
      window.open(target, '_blank', 'noopener,noreferrer');
    } else {
      navigate(String(target));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Centre de Notifications</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllAsRead} className="border-white/10 text-white hover:bg-white/10">
            <Check className="w-4 h-4 mr-2" /> Tout marquer comme lu
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {uiNotifications.length > 0 ? uiNotifications.map(notif => (
          <Card
            key={notif.id}
            role={notif.action_url ? 'button' : undefined}
            tabIndex={notif.action_url ? 0 : undefined}
            onClick={() => {
              if (!notif.action_url) return;
              void markAsRead(notif.id);
              openNotificationTarget(notif);
            }}
            onKeyDown={(e) => {
              if (!notif.action_url) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void markAsRead(notif.id);
                openNotificationTarget(notif);
              }
            }}
            className={`bg-[#192734] border-white/10 p-4 flex items-center gap-4 transition-all ${!notif.isRead ? 'border-l-4 border-l-[var(--school-accent)]' : ''} ${notif.action_url ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
          >
            <div className="p-3 bg-white/5 rounded-full">
              {getIcon(notif.type)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className={`font-medium ${!notif.isRead ? 'text-white' : 'text-gray-400'}`}>{notif.title}</h3>
                <span className="text-sm text-gray-500">{format(new Date(notif.timestamp), 'dd MMM yyyy, HH:mm', { locale: fr })}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">{notif.message}</p>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              {!notif.isRead && (
                <Button size="icon" variant="ghost" onClick={() => markAsRead(notif.id)} title="Marquer comme lu">
                  <Check className="w-4 h-4 text-[var(--school-accent)]" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => deleteNotification(notif.id)} title="Supprimer">
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          </Card>
        )) : (
          <div className="text-center py-20 text-gray-500">
            Aucune notification pour le moment.
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;