import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Printer, Download, PenTool, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;
const SITE_NAME = `${SCHOOL} · LIRI`;

const InscriptionContractPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    firstname: '',
    birthdate: '',
    address: '',
    phone: '',
    email: '',
    country: '',
    formationTitle: `Cycle académique ${SCHOOL} — Niveau 1`,
    duration: '9 mois',
    startDate: '',
    endDate: '',
    amount: '',
    discount: '',
    finalAmount: '',
    paymentMethods: {
      virement: false,
      carte: false,
      paypal: false,
      orange: false,
      taptap: false,
      autre: false
    }
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (method) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: {
        ...prev.paymentMethods,
        [method]: !prev.paymentMethods[method]
      }
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-black font-serif print:bg-white print:m-0 print:p-0">
      <Helmet>
        <title>{`Contrat d'inscription — ${SITE_NAME}`}</title>
        <meta name="description" content={`Contrat officiel d'inscription — ${SCHOOL} · LIRI (doctrine & cursus).`} />
      </Helmet>

      {/* Control Bar (Hidden on print) */}
      <div className="bg-[#0F1419] text-white py-4 px-6 shadow-md print:hidden sticky top-16 z-40 flex justify-between items-center">
        <h1 className="text-xl font-sans font-bold text-[var(--school-accent)] flex items-center gap-2">
          <PenTool className="w-5 h-5" /> Contrat d'Inscription
        </h1>
        <div className="flex gap-3">
          <Button onClick={handlePrint} variant="outline" className="border-white/20 hover:bg-white/10 text-white gap-2">
            <Printer className="w-4 h-4" /> Imprimer / PDF
          </Button>
          <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2">
            <Download className="w-4 h-4" /> Télécharger
          </Button>
        </div>
      </div>

      {/* Contract Paper */}
      <div className="max-w-[210mm] mx-auto bg-white my-8 p-[15mm] shadow-2xl print:shadow-none print:my-0 print:w-full print:max-w-none min-h-[297mm]">
        
        {/* Official Header */}
        <header className="text-center border-b-4 border-double border-[#0F1419] pb-6 mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center border-2 border-[var(--school-accent)]">
            {/* Logo Placeholder */}
            <span className="text-3xl font-bold text-[#0F1419]">ISNA</span>
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-[#0F1419] mb-2">{`${SCHOOL} — école en ligne`}</h1>
          <h2 className="text-xl font-bold text-[var(--school-accent)] mb-1">FONDATION MANIKONGO</h2>
          <p className="text-sm text-gray-500 uppercase tracking-widest">Institut des Sciences de la Nature et de l'Âme</p>
        </header>

        {/* Title */}
        <div className="text-center mb-10">
          <h3 className="text-3xl font-bold underline decoration-2 underline-offset-4 uppercase">Contrat d'Inscription / Formation</h3>
        </div>

        {/* Preamble */}
        <div className="mb-8 italic text-justify text-gray-700 bg-gray-50 p-4 border-l-4 border-[var(--school-accent)]">
          "Dans le respect des Lois Universelles et de la quête de Vérité, ce contrat scelle l'engagement mutuel entre l'École, dispensatrice du savoir, et l'Étudiant, chercheur de connaissance."
        </div>

        {/* Parties */}
        <div className="mb-8 space-y-4">
          <p className="font-bold">ENTRE LES SOUSSIGNÉS :</p>
          
          <div className="pl-6">
            <p><strong>L'ISNA (Institut des Sciences de la Nature et de l\'Âme)</strong>,<br/>
            Représenté par la Fondation Manikongo,<br/>
            Ci-après désigné « <strong>L'École</strong> », d\'une part,</p>
          </div>

          <p className="font-bold mt-4">ET :</p>

          {/* Student Form Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 bg-gray-50 p-6 border border-gray-200 rounded-lg print:bg-transparent print:border-black">
            <div className="col-span-1">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Nom :</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-transparent border-b border-gray-400 focus:border-[var(--school-accent)] outline-none py-1 font-sans" />
            </div>
            <div className="col-span-1">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Prénom(s) :</label>
              <input type="text" name="firstname" value={formData.firstname} onChange={handleInputChange} className="w-full bg-transparent border-b border-gray-400 focus:border-[var(--school-accent)] outline-none py-1 font-sans" />
            </div>
            <div className="col-span-1">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Date de naissance :</label>
              <input type="date" name="birthdate" value={formData.birthdate} onChange={handleInputChange} className="w-full bg-transparent border-b border-gray-400 focus:border-[var(--school-accent)] outline-none py-1 font-sans" />
            </div>
             <div className="col-span-1">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Pays de résidence :</label>
              <input type="text" name="country" value={formData.country} onChange={handleInputChange} className="w-full bg-transparent border-b border-gray-400 focus:border-[var(--school-accent)] outline-none py-1 font-sans" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Adresse complète :</label>
              <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="w-full bg-transparent border-b border-gray-400 focus:border-[var(--school-accent)] outline-none py-1 font-sans" />
            </div>
            <div className="col-span-1">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Téléphone (avec indicatif) :</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-transparent border-b border-gray-400 focus:border-[var(--school-accent)] outline-none py-1 font-sans" />
            </div>
            <div className="col-span-1">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Email :</label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-transparent border-b border-gray-400 focus:border-[var(--school-accent)] outline-none py-1 font-sans" />
            </div>
          </div>
          <div className="pl-6">
            <p>Ci-après désigné « <strong>L'Étudiant</strong> », d\'autre part.</p>
          </div>
        </div>

        {/* Articles */}
        <div className="space-y-6 text-sm text-justify leading-relaxed">
          
          <div className="border-t pt-4">
            <h4 className="font-bold uppercase mb-2">Article 1 : Objet du Contrat</h4>
            <p>Le présent contrat a pour objet l'inscription de l\'Étudiant à la formation suivante dispensée par l\'École :</p>
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200">
               <input type="text" name="formationTitle" value={formData.formationTitle} onChange={handleInputChange} className="w-full bg-transparent font-bold text-center outline-none" placeholder="Titre de la Formation" />
            </div>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 2 : Durée et Dates</h4>
            <p>La formation est prévue pour une durée de : <input type="text" name="duration" value={formData.duration} onChange={handleInputChange} className="border-b border-gray-400 w-24 text-center" />.</p>
            <p>Date de début : <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="border-b border-gray-400" /> &nbsp; Date de fin prévisionnelle : <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} className="border-b border-gray-400" />.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 3 : Conditions Financières</h4>
            <div className="grid grid-cols-3 gap-4 mb-2">
               <div>
                  <label className="text-xs">Montant Total (€) :</label>
                  <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} className="w-full border p-1" />
               </div>
               <div>
                  <label className="text-xs">Remise/Bourse (€) :</label>
                  <input type="number" name="discount" value={formData.discount} onChange={handleInputChange} className="w-full border p-1" />
               </div>
               <div>
                  <label className="text-xs font-bold">Net à payer (€) :</label>
                  <input type="number" name="finalAmount" value={formData.finalAmount} onChange={handleInputChange} className="w-full border border-[var(--school-accent)] p-1 font-bold bg-yellow-50" />
               </div>
            </div>
            <p className="mt-2">L'Étudiant s\'engage à régler la somme due selon l\'échéancier convenu. Tout retard de paiement de plus de 7 jours pourra entraîner la suspension de l\'accès aux cours.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 4 : Modalités de Paiement</h4>
            <div className="flex flex-wrap gap-4 text-xs">
               {['virement', 'carte', 'paypal', 'orange', 'taptap', 'autre'].map(method => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                     <div className={`w-4 h-4 border border-black flex items-center justify-center ${formData.paymentMethods[method] ? 'bg-black text-white' : 'bg-white'}`} onClick={() => handleCheckboxChange(method)}>
                        {formData.paymentMethods[method] && <CheckSquare className="w-3 h-3" />}
                     </div>
                     <span className="uppercase">{method === 'orange' ? 'Orange Money' : method === 'taptap' ? 'TapTap Send' : method}</span>
                  </label>
               ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 5 : Obligations de l'École</h4>
            <p>L'École s\'engage à fournir les supports pédagogiques, l\'accès à la plateforme en ligne, et l\'encadrement professoral nécessaires à la bonne réalisation de la formation.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 6 : Obligations de l'Étudiant</h4>
            <p>L'Étudiant s\'engage à suivre les cours avec assiduité, à réaliser les travaux demandés et à respecter le Règlement Intérieur de l\'établissement, dont il reconnaît avoir pris connaissance.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 7 : Propriété Intellectuelle</h4>
            <p>Tous les contenus (vidéos, textes, audios) remis à l'Étudiant restent la propriété exclusive de l\'ISNA. Toute reproduction ou diffusion est strictement interdite.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 8 : Droit à l'Image</h4>
            <p>L'Étudiant autorise l\'École à utiliser son image (captures de cours collectifs) à des fins pédagogiques internes, sauf avis contraire écrit.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 9 : Confidentialité</h4>
            <p>Les deux parties s'engagent à garder confidentielles toutes les informations personnelles ou sensibles échangées durant la formation.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 10 : Annulation et Remboursement</h4>
            <p>L'Étudiant dispose d\'un délai de rétractation de 14 jours après signature. Au-delà, ou dès l\'accès aux cours, aucun remboursement ne sera effectué, sauf cas de force majeure avéré.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 11 : Protection des Données (RGPD)</h4>
            <p>Les données collectées sont nécessaires à la gestion administrative et pédagogique. Elles ne sont pas transmises à des tiers commerciaux.</p>
          </div>

          <div>
            <h4 className="font-bold uppercase mb-2">Article 12 : Litiges</h4>
            <p>En cas de litige, une solution amiable sera privilégiée. À défaut, les tribunaux compétents seront ceux du siège de l'École.</p>
          </div>

           <div>
            <h4 className="font-bold uppercase mb-2">Article 13 : Acceptation</h4>
            <p>La signature du présent contrat vaut acceptation pleine et entière des conditions générales et du règlement intérieur.</p>
          </div>

        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-10 pt-8 border-t border-black">
           <div className="text-center">
              <p className="font-bold mb-8">Pour l'Étudiant</p>
              <p className="text-xs italic mb-12">(Précédé de la mention "Lu et approuvé")</p>
              <div className="border-b border-black w-3/4 mx-auto h-12"></div>
           </div>
           <div className="text-center">
              <p className="font-bold mb-8">Pour l'ISNA / Fondation Manikongo</p>
              <p className="text-xs italic mb-12">(Cachet et Signature)</p>
              <div className="border-b border-black w-3/4 mx-auto h-12"></div>
           </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-300 text-center text-[10px] text-gray-500">
           <p>ISNA - Institut des Sciences de la Nature et de l'Âme | Fondation Manikongo</p>
           <p>Document généré électroniquement le {new Date().toLocaleDateString()} - Document contractuel valant engagement.</p>
        </div>

      </div>
    </div>
  );
};

export default InscriptionContractPage;