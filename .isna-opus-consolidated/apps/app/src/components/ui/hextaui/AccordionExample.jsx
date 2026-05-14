import React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./Accordion";

/**
 * Example usage of HextaUI Accordion for forum FAQ/topics
 * 
 * Copy this pattern for your forum implementation
 */
export function ForumFAQExample() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
        Questions fréquentes du forum
      </h2>

      <Accordion type="single" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger value="item-1">
            Comment créer un nouveau sujet de discussion ?
          </AccordionTrigger>
          <AccordionContent value="item-1">
            Pour créer un nouveau sujet, cliquez sur le bouton "Nouveau sujet" 
            en haut de la page. Remplissez le titre et le contenu, puis sélectionnez 
            la catégorie appropriée pour votre question.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger value="item-2">
            Quelles sont les règles de la communauté ?
          </AccordionTrigger>
          <AccordionContent value="item-2">
            Notre communauté valorise le respect mutuel, l'entraide et les 
            échanges constructifs. Évitez les propos discriminatoires, le spam 
            et les contenus hors-sujet. Les modérateurs se réservent le droit 
            de supprimer tout contenu inapproprié.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3">
          <AccordionTrigger value="item-3">
            Comment signaler un contenu problématique ?
          </AccordionTrigger>
          <AccordionContent value="item-3">
            Cliquez sur l'icône "Signaler" à côté de chaque message. Décrivez 
            brièvement la raison du signalement. Notre équipe de modération 
            examinera le contenu dans les 24 heures.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-4">
          <AccordionTrigger value="item-4">
            Puis-je modifier mon message après publication ?
          </AccordionTrigger>
          <AccordionContent value="item-4">
            Oui, vous pouvez modifier vos messages pendant 30 minutes après 
            publication. Au-delà de ce délai, contactez un modérateur pour 
            demander une modification.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/**
 * Multiple items can be opened simultaneously
 */
export function ForumCategoriesExample() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
        Catégories du forum (mode multiple)
      </h2>

      <Accordion type="multiple" defaultValue={/** @type {string[]} */ (["general"])}>
        <AccordionItem value="general">
          <AccordionTrigger value="general">
            Discussion générale
          </AccordionTrigger>
          <AccordionContent value="general">
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Bienvenue aux nouveaux membres (42 messages)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Présentations (128 messages)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full" />
                Discussions libres (356 messages)
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="support">
          <AccordionTrigger value="support">
            Support technique
          </AccordionTrigger>
          <AccordionContent value="support">
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                Bugs signalés (15 messages)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full" />
                Questions d'installation (89 messages)
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="features">
          <AccordionTrigger value="features">
            Suggestions de fonctionnalités
          </AccordionTrigger>
          <AccordionContent value="features">
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                En cours d'évaluation (23 messages)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-teal-500 rounded-full" />
                Implémentées (67 messages)
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default ForumFAQExample;
