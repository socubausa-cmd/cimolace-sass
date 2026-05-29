import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Megaphone, Calendar, Target, Trash, Edit, Plus, Sparkles, Loader2, Link2, Image as ImageIcon, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  audienceToTargetRole,
  categoryToPriority,
  cleanExtrasJson,
} from '@/lib/schoolAnnouncementUtils';

const emptyForm = () => ({
  title: '',
  content: '',
  summary: '',
  category: 'info',
  audience: 'students_all',
  extras_json: { link_url: '', phone: '', product_id: '', module_id: '', image_url: '' },
  status: 'draft',
});

const AUDIENCE_OPTIONS = [
  { value: 'everyone', label: 'Public (tous les profils)' },
  { value: 'students_all', label: 'Tous les élèves' },
  { value: 'teachers_staff', label: 'Enseignants & équipe' },
  { value: 'cycle_disciple', label: 'Cycle Disciple (élèves)' },
  { value: 'cycle_initie', label: 'Cycle Initié (élèves)' },
  { value: 'cycle_maitre', label: 'Cycle Maître (élèves)' },
  { value: 'year_first', label: '1ère année (élèves)' },
  { value: 'year_second', label: '2e année (élèves)' },
  { value: 'year_third', label: '3e année (élèves)' },
];

const CATEGORY_OPTIONS = [
  { value: 'info', label: 'Information' },
  { value: 'event', label: 'Événement' },
  { value: 'activity', label: 'Activité' },
  { value: 'alert', label: 'Alerte' },
];

function extrasFromRow(row) {
  const ex = row?.extras_json && typeof row.extras_json === 'object' ? row.extras_json : {};
  return {
    link_url: ex.link_url || '',
    phone: ex.phone || '',
    product_id: ex.product_id || '',
    module_id: ex.module_id || '',
    image_url: ex.image_url || '',
  };
}

const AnnouncementManager = () => {
  const { user, session, supabase } = useAuth();
  const { toast } = useToast();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('published_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: 'Chargement impossible', description: error.message, variant: 'destructive' });
      return;
    }
    setList(data || []);
  }, [supabase, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        title: item.title || '',
        content: item.content || '',
        summary: item.summary || '',
        category: item.category || 'info',
        audience: item.audience || 'students_all',
        extras_json: extrasFromRow(item),
        status: item.status || 'draft',
      });
    } else {
      setEditingId(null);
      setFormData(emptyForm());
    }
    setIsModalOpen(true);
  };

  const runAiPolish = async (mode = 'fix') => {
    const raw = String(formData.content || '').trim();
    if (!raw) {
      toast({ title: 'Texte vide', description: "Écrivez un message avant d'utiliser l'IA.", variant: 'destructive' });
      return;
    }
    const token = session?.access_token;
    if (!token) {
      toast({ title: 'Session', description: "Reconnectez-vous pour utiliser l'IA.", variant: 'destructive' });
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/.netlify/functions/school-announcement-ai-polish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: raw, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur IA');
      if (data?.text) {
        setFormData((prev) => ({ ...prev, content: data.text }));
        toast({
          title: mode === 'shorten' ? 'Texte raccourci' : 'Texte reformulé',
          description: data.fallback ? 'Mode hors ligne (correction basique).' : 'Prêt à relire avant publication.',
        });
      }
    } catch (e) {
      toast({ title: 'IA indisponible', description: e?.message || 'Réessayez plus tard.', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const broadcastIfNeeded = async (announcementId) => {
    const token = session?.access_token;
    if (!token) return;
    try {
      const res = await fetch('/.netlify/functions/school-announcement-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ announcementId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Notification non envoyée');
      if (data?.skipped) {
        toast({ title: 'Notifications', description: 'Déjà envoyées pour cette annonce.' });
      } else {
        toast({
          title: 'Notifications envoyées',
          description: `${data?.notified ?? 0} destinataires notifiés.`,
        });
      }
    } catch (e) {
      toast({
        title: 'Notifications partielles',
        description: e?.message || "L'annonce est en ligne mais la diffusion push a échoué.",
        variant: 'destructive',
      });
    }
  };

  const save = async (wantPublish) => {
    if (!user?.id) return;
    const title = String(formData.title || '').trim();
    const content = String(formData.content || '').trim();
    if (!title || !content) {
      toast({ title: 'Champs requis', description: 'Titre et contenu sont obligatoires.', variant: 'destructive' });
      return;
    }

    const summaryManual = String(formData.summary || '').trim();
    const summary =
      summaryManual ||
      (content.length > 280 ? `${content.slice(0, 240).trim()}…` : content);

    const extras = cleanExtrasJson(formData.extras_json);
    const nextStatus =
      wantPublish ? 'published' : editingId && formData.status === 'published' ? 'published' : 'draft';
    const published_at = new Date().toISOString();
    const target_role = audienceToTargetRole(formData.audience);
    const priority = categoryToPriority(formData.category);

    setSaving(true);
    try {
      const basePayload = {
        title,
        content,
        summary,
        category: formData.category,
        audience: formData.audience,
        extras_json: extras,
        status: nextStatus,
        published_at,
        target_role,
        priority,
      };

      let announcementId = editingId;

      if (editingId) {
        const { error } = await supabase.from('announcements').update(basePayload).eq('id', editingId);
        if (error) throw error;
        announcementId = editingId;
      } else {
        const { data: inserted, error } = await supabase
          .from('announcements')
          .insert({ ...basePayload, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        announcementId = inserted?.id;
      }

      if (wantPublish && announcementId) {
        await broadcastIfNeeded(announcementId);
      } else {
        toast({
          title: editingId && formData.status === 'published' ? 'Modifications enregistrées' : 'Brouillon enregistré',
          description:
            nextStatus === 'draft'
              ? 'Vous pourrez publier depuis ce panneau.'
              : 'Le contenu est à jour (pas de nouvelle notification).',
        });
      }

      setIsModalOpen(false);
      await load();
    } catch (e) {
      toast({ title: 'Enregistrement impossible', description: e?.message || 'Erreur', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id) => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Annonce archivée' });
      await load();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getAudienceLabel = (value) => AUDIENCE_OPTIONS.find((o) => o.value === value)?.label || value;

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement des annonces…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-[#D4AF37]" /> Annonces officielles
        </h2>
        <Button size="sm" onClick={() => handleOpenModal()} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
          <Plus className="h-4 w-4 mr-2" /> Nouvelle
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Array.isArray(list) && list.length > 0 ? (
          list.map((announcement) => (
            <Card key={announcement.id} className="bg-[#0F1419] border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={announcement.category === 'alert' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                      {announcement.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-white/20">
                      {announcement.status}
                    </Badge>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(new Date(announcement.published_at), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenModal(announcement)}
                      className="h-6 w-6 text-gray-400 hover:text-white"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => archive(announcement.id)}
                      className="h-6 w-6 text-gray-400 hover:text-red-400"
                      disabled={saving}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <h3 className="text-white font-bold mb-1">{announcement.title}</h3>
                <p className="text-gray-400 text-sm line-clamp-2 mb-3">{announcement.summary || announcement.content}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 border-t border-white/5 pt-2">
                  <Target className="h-3 w-3" /> Cible :{' '}
                  <span className="text-[#D4AF37]">{getAudienceLabel(announcement.audience)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8 bg-[#0F1419] rounded-lg border border-dashed border-white/10">
            <p>Aucune annonce.</p>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'annonce" : 'Nouvelle annonce'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Titre</label>
              <Input
                placeholder="Titre de l'annonce"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-[#0F1419] border-white/10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Type</label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="bg-[#0F1419] border-white/10">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Audience</label>
                <Select
                  value={formData.audience}
                  onValueChange={(v) => setFormData({ ...formData, audience: v })}
                >
                  <SelectTrigger className="bg-[#0F1419] border-white/10">
                    <SelectValue placeholder="Audience" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center gap-2">
                <label className="text-sm text-gray-400">Message</label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2 border-[#D4AF37]/40 text-[#D4AF37]"
                    disabled={aiLoading}
                    onClick={() => runAiPolish('fix')}
                  >
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    IA · Corriger
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2 border-white/20"
                    disabled={aiLoading}
                    onClick={() => runAiPolish('shorten')}
                  >
                    IA · Résumer
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder="Texte complet de l'annonce…"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="bg-[#0F1419] border-white/10 min-h-[140px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Résumé (liste & notifications, optionnel)</label>
              <Textarea
                placeholder="Laissez vide pour générer un extrait automatique"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="bg-[#0F1419] border-white/10 h-20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Lien (URL)
                </label>
                <Input
                  className="bg-[#0F1419] border-white/10"
                  placeholder="https://…"
                  value={formData.extras_json.link_url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      extras_json: { ...formData.extras_json, link_url: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Téléphone
                </label>
                <Input
                  className="bg-[#0F1419] border-white/10"
                  placeholder="+33…"
                  value={formData.extras_json.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      extras_json: { ...formData.extras_json, phone: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">ID produit boutique</label>
                <Input
                  className="bg-[#0F1419] border-white/10"
                  placeholder="UUID produit"
                  value={formData.extras_json.product_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      extras_json: { ...formData.extras_json, product_id: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">ID module pédagogique</label>
                <Input
                  className="bg-[#0F1419] border-white/10"
                  placeholder="UUID module"
                  value={formData.extras_json.module_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      extras_json: { ...formData.extras_json, module_id: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Image (URL)
                </label>
                <Input
                  className="bg-[#0F1419] border-white/10"
                  placeholder="https://… image"
                  value={formData.extras_json.image_url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      extras_json: { ...formData.extras_json, image_url: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-white/20"
                disabled={saving}
                onClick={() => save(false)}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {formData.status === 'published' ? 'Enregistrer' : 'Enregistrer brouillon'}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#D4AF37] text-black font-bold hover:bg-yellow-500"
                disabled={saving}
                onClick={() => save(true)}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publier & notifier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnnouncementManager;
