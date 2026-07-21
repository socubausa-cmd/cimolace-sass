import { useCallback } from 'react';
import { useFormations } from '@/hooks/useFormations';
import { useFormationStructure } from '@/hooks/useFormationStructure';

/**
 * Point de convergence UNIQUE de la publication « en classe ».
 *
 * Tous les constructeurs/générateurs (Masterclass Factory, builders LLM, smartboard…)
 * appellent `publish(draft)` pour qu'un cours créé devienne une VRAIE formation :
 *  1. crée la ligne `courses` (useFormations.createFormation — write direct Supabase, RLS tenant),
 *  2. persiste la structure relationnelle (useFormationStructure.saveStructure →
 *     modules/formation_weeks/formation_days/formation_day_contents),
 *  → immédiatement visible dans l'OS `/liri/formations` (rendu immersif) ET les lecteurs élève.
 *
 * `draft` = { title, description?, status?, category?, level?,
 *             modules: [{ title, weeks: [{ title, days: [{ title, videos?, powerpoint?, quiz? }] }] }] }
 * (même forme que ce que consomme saveStructure / lit fetchStructure).
 *
 * Retour : { id } en succès, ou { error } (avec id si le cours a été créé mais la structure a échoué).
 */
export function usePublishToClassroom() {
  const { createFormation } = useFormations();
  const { saveStructure } = useFormationStructure();

  const publish = useCallback(async (draft) => {
    if (!draft?.title) return { error: new Error('Titre du cours manquant') };
    const { data, error } = await createFormation({
      title: draft.title,
      description: draft.description || '',
      status: draft.status || 'published',
      category: draft.category || null,
      level: draft.level || null,
    });
    if (error) return { error };
    const id = data?.id;
    if (!id) return { error: new Error('Création du cours échouée (aucun id retourné)') };

    const modules = Array.isArray(draft.modules) ? draft.modules : [];
    if (modules.length) {
      const { error: structErr } = await saveStructure(id, modules);
      // saveStructure refuse une structure vide (garde anti-effacement) : on ignore ce cas
      // précis (le cours existe, juste sans contenu) et on remonte les vraies erreurs.
      if (structErr && !/structure vide/i.test(String(structErr.message || ''))) {
        return { error: structErr, id };
      }
    }
    return { id, data };
  }, [createFormation, saveStructure]);

  return { publish };
}

export default usePublishToClassroom;
