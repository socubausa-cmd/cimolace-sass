import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const PricingDocumentation = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 py-12 px-4 sm:px-6">
      
      {/* 1. Préambule */}
      <section className="space-y-4">
        <h2 className="text-3xl font-serif font-bold text-white flex items-center gap-3">
          <span className="text-4xl">🖥️</span> Préambule
        </h2>
        <Card className="bg-[#192734] border-white/10 text-gray-300">
          <CardContent className="pt-6 leading-relaxed">
            <p>
              {`Bienvenue dans la documentation officielle des tarifs de `}<strong>{`${isnaTenantConfig.branding.name} Academy`}</strong>. 
              Notre structure de prix est conçue pour refléter la valeur de l'enseignement dispensé, la qualité des infrastructures numériques 
              et l'accompagnement personnalisé offert à chaque étudiant. Cette transparence vise à vous permettre de choisir le parcours 
              le plus adapté à vos ambitions intellectuelles et spirituelles.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 2. Espaces Pédagogiques */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">📚</span> Espaces Pédagogiques
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-blue-900/20 to-transparent border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-blue-400">Salle Virtuelle</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400">
              Espace d'initiation et de découverte. Accès aux contenus fondamentaux, conférences publiques et introductions aux concepts clés.
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-900/20 to-transparent border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-purple-400">Salle Numérique</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400">
              Espace de travail avancé. Accès aux outils interactifs, vidéothèque complète des cours passés et supports de cours numériques.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. Tarifs des Salles */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🎓</span> Tarifs des Salles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: "Salle Virtuelle", price: "30€", period: "/mois", color: "text-blue-400", border: "border-blue-500/30" },
            { title: "Salle Numérique", price: "45€", period: "/mois", color: "text-purple-400", border: "border-purple-500/30" },
            { title: "Cycle Académique", price: "55€", period: "/mois", color: "text-[#D4AF37]", border: "border-[#D4AF37]/30", featured: true }
          ].map((item, idx) => (
            <Card key={idx} className={`bg-[#151a21] ${item.border} ${item.featured ? 'shadow-lg shadow-yellow-900/10 scale-105' : ''}`}>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <h3 className={`font-bold text-lg mb-2 ${item.color}`}>{item.title}</h3>
                <div className="text-3xl font-bold text-white">{item.price}<span className="text-sm font-normal text-gray-500">{item.period}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Ateliers Initiatiques */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🔴</span> Ateliers Initiatiques
        </h2>
        <Card className="bg-[#192734] border-white/10">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400">Type d'Atelier</TableHead>
                  <TableHead className="text-right text-gray-400">Tarif Unitaire</TableHead>
                  <TableHead className="text-right text-gray-400">Inclus dans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableCell className="font-medium text-white">Atelier Virtuel</TableCell>
                  <TableCell className="text-right text-[#D4AF37] font-bold">25€</TableCell>
                  <TableCell className="text-right text-gray-400 text-xs">Salle Virtuelle</TableCell>
                </TableRow>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableCell className="font-medium text-white">Atelier Numérique</TableCell>
                  <TableCell className="text-right text-[#D4AF37] font-bold">35€</TableCell>
                  <TableCell className="text-right text-gray-400 text-xs">Salle Numérique</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* 5. Accès à l'Unité */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🔵</span> Accès à l'Unité
        </h2>
        <p className="text-gray-400 text-sm">Pour les étudiants ne souhaitant pas s'engager sur un forfait mensuel.</p>
        <div className="flex flex-wrap gap-4">
          <Badge variant="outline" className="text-lg py-2 px-4 border-white/20 text-white">Conférence Live : 15€</Badge>
          <Badge variant="outline" className="text-lg py-2 px-4 border-white/20 text-white">Replay Vidéo : 10€</Badge>
          <Badge variant="outline" className="text-lg py-2 px-4 border-white/20 text-white">Support PDF : 5€</Badge>
        </div>
      </section>

      {/* 6. Forfaits Complets */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🎥</span> Forfaits Complets
        </h2>
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="w-[300px] text-white">Forfait</TableHead>
                <TableHead className="text-center text-white">Prix / Mois</TableHead>
                <TableHead className="text-center text-gray-400">Valeur Réelle</TableHead>
                <TableHead className="text-center text-green-400">Économie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-white/10 bg-white/5">
                <TableCell>
                  <div className="font-bold text-white text-lg">Academy Pro</div>
                  <div className="text-sm text-gray-400">Accès complet + Ateliers</div>
                </TableCell>
                <TableCell className="text-center text-xl font-bold text-[#D4AF37]">95€</TableCell>
                <TableCell className="text-center text-gray-500 line-through">125€</TableCell>
                <TableCell className="text-center text-green-400 font-medium">-24%</TableCell>
              </TableRow>
              <TableRow className="border-white/10 bg-gradient-to-r from-yellow-900/10 to-transparent">
                <TableCell>
                  <div className="font-bold text-[#D4AF37] text-lg">Academy Pro+</div>
                  <div className="text-sm text-gray-400">Tout inclus + Coaching groupe</div>
                </TableCell>
                <TableCell className="text-center text-xl font-bold text-[#D4AF37]">110€</TableCell>
                <TableCell className="text-center text-gray-500 line-through">160€</TableCell>
                <TableCell className="text-center text-green-400 font-medium">-31%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 7. Pratique Individuelle & Coaching */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🧿</span> Pratique Individuelle & Coaching
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-[#192734] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Séance Individuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-2">60€ <span className="text-sm font-normal text-gray-500">/ heure</span></div>
              <p className="text-sm text-gray-400">Accompagnement personnalisé sur votre parcours spirituel et académique.</p>
            </CardContent>
          </Card>
          <Card className="bg-[#192734] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Mentorat de Groupe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-2">40€ <span className="text-sm font-normal text-gray-500">/ séance</span></div>
              <p className="text-sm text-gray-400">Sessions collectives limitées à 10 personnes pour approfondir les enseignements.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 8. Principes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🟢</span> Principes
        </h2>
        <ul className="grid md:grid-cols-2 gap-3 text-gray-300">
          <li className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
            <span className="text-green-500">✓</span> Engagement personnel et régularité.
          </li>
          <li className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
            <span className="text-green-500">✓</span> Respect de la propriété intellectuelle.
          </li>
          <li className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
            <span className="text-green-500">✓</span> Bienveillance et respect au sein de la communauté.
          </li>
          <li className="flex items-start gap-2 bg-white/5 p-3 rounded-lg">
            <span className="text-green-500">✓</span> Paiement dû en début de période.
          </li>
        </ul>
      </section>

      {/* 9. Modalités */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🔺</span> Modalités
        </h2>
        <div className="prose prose-invert max-w-none text-gray-400 text-sm">
          <p>
            Les paiements s'effectuent par carte bancaire (via Stripe) de manière sécurisée. 
            L'accès aux salles et aux contenus est immédiat après validation du paiement.
            Tout abonnement est sans engagement de durée, résiliable à tout moment depuis votre espace membre 
            (la période entamée reste due).
          </p>
        </div>
      </section>

      {/* 10. Conclusion */}
      <section className="space-y-4 pt-4 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🔥</span> Conclusion
        </h2>
        <Card className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-500/30">
          <CardContent className="pt-6 text-center">
            <p className="text-lg text-white font-medium italic">
              "L'investissement en soi est le seul qui offre un rendement garanti à vie. 
              Rejoignez l'élite de la pensée et de la spiritualité."
            </p>
          </CardContent>
        </Card>
      </section>

    </div>
  );
};

export default PricingDocumentation;