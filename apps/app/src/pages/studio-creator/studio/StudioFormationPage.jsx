import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import OwnerFormationBuilder from '@/components/school/formations/OwnerFormationBuilder';
import { useFormations } from '@/hooks/useFormations';
import { useFormationStructure } from '@/hooks/useFormationStructure';
import { useToast } from '@/components/ui/use-toast';
import useTenantBranding from '@/hooks/useTenantBranding';

export default function StudioFormationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { branding, cssVars } = useTenantBranding();
  const { formations, loading, createFormation, updateFormation, refresh } = useFormations();
  const { fetchStructure, saveStructure } = useFormationStructure();
  const [selectedFormation, setSelectedFormation] = useState(null);
  const [loadingStructure, setLoadingStructure] = useState(false);

  const editFormationId = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      return params.get('editFormationId');
    } catch {
      return null;
    }
  }, [location.search]);

  useEffect(() => {
    if (!editFormationId || loading) return;
    const target = formations.find((f) => String(f.id) === String(editFormationId));
    if (!target) return;

    let alive = true;
    const openForEdit = async () => {
      setLoadingStructure(true);
      const { data, error } = await fetchStructure(target.id);
      if (!alive) return;
      setLoadingStructure(false);
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        return;
      }
      setSelectedFormation({ ...target, modules: data || [] });
    };
    openForEdit();
    return () => {
      alive = false;
    };
  }, [editFormationId, loading, formations, fetchStructure, toast]);

  const handleSaveFormation = async (formationData) => {
    try {
      if (!formationData?.id) {
        const { data, error } = await createFormation({
          ...formationData,
          status: formationData?.status || 'draft',
        });
        if (error) {
          toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
          return false;
        }
        if (data?.id) {
          const { error: structErr } = await saveStructure(data.id, formationData?.modules || []);
          if (structErr) {
            toast({ title: 'Erreur', description: structErr.message, variant: 'destructive' });
            return false;
          }
        }
        toast({ title: 'Formation créée' });
      } else {
        const { error } = await updateFormation(formationData.id, formationData);
        if (error) {
          toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
          return false;
        }
        const { error: structErr } = await saveStructure(formationData.id, formationData?.modules || []);
        if (structErr) {
          toast({ title: 'Erreur', description: structErr.message, variant: 'destructive' });
          return false;
        }
        toast({ title: 'Formation mise à jour' });
      }
      await refresh({ silent: true });
      navigate('/studio');
      return true;
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
      return false;
    }
  };

  const handleCancel = () => {
    navigate('/studio');
  };

  if (loading || loadingStructure) {
    /**
     * REPLI DE FOND — pourquoi il compte vraiment.
     * Contrairement à `--school-accent` (déclarée au :root dans index.css),
     * `--school-background` n'a AUCUNE déclaration globale : elle n'existe que si
     * `cssVars` (useTenantBranding) la pose, ou si la page est montée dans la coque
     * du portail (studioWarm.css la force alors à #262624). Hors de ces deux cas —
     * et cet écran de chargement s'affiche en `fixed inset-0`, plein cadre — le
     * repli est RÉELLEMENT ATTEINT. Il valait 0F1419, un navy froid banni par la
     * charte : un plein écran bleu-nuit au démarrage du studio. Il vaut désormais
     * la base chaude de la charte, #262624.
     *
     * `text-gray-300` (encre du bloc) : les gris Tailwind sont teintés BLEU
     * (gray-300 = #d1d5db). Sur une base chaude ils virent au froid → on repasse
     * sur l'encre de la charte, #f5f4ee à 80 % = 9,33:1 sur #262624.
     */
    return (
      <div
        className="fixed inset-0 flex items-center justify-center text-[#f5f4ee]/80"
        data-school-shell="formation-builder"
        data-tenant-brand={branding.slug}
        style={{ ...cssVars, background: 'var(--school-background, #262624)', fontFamily: 'var(--school-font-family, Inter, sans-serif)' }}
      >
        <div className="flex items-center gap-2">
          {/* Repli d'accent aligné sur l'or CHAUD #d99a4e (6,27:1 sur #262624). */}
          <Loader2 className="w-4 h-4 animate-spin text-[var(--school-accent,#d99a4e)]" />
          Chargement du constructeur de formation...
        </div>
      </div>
    );
  }

  return (
    <OwnerFormationBuilder
      formation={selectedFormation}
      onSave={handleSaveFormation}
      onCancel={handleCancel}
    />
  );
}
