import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const ContactSecretariatPage = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    module: '',
    requestType: '',
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contact_requests')
        .insert([{
          name: formData.name,
          email: formData.email,
          subject: `[${formData.requestType}] ${formData.subject}`,
          message: formData.message,
          created_at: new Date(),
          status: 'new'
        }]);

      if (error) throw error;

      toast({
        title: "Message envoyé avec succès",
        description: "Le secrétariat a bien reçu votre demande. Réponse sous 48h.",
        className: "bg-green-600 border-none text-white"
      });
      setFormData({ name: '', email: '', phone: '', module: '', requestType: '', subject: '', message: '' });

    } catch (error) {
      toast({
        title: "Erreur d'envoi",
        description: "Une erreur est survenue. Veuillez réessayer plus tard.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans pb-20">
      <Helmet>
        <title>{`Contact & Secrétariat — ${isnaTenantConfig.branding.name}`}</title>
      </Helmet>

      {/* Hero */}
      <section className="relative h-[300px] w-full overflow-hidden flex items-center justify-center mb-12">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1599326014852-e083419b6f65?q=80&w=2000&auto=format&fit=crop" 
            alt="Secretariat" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-[#0F1419]/60" />
        </div>
        <div className="relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">Secrétariat Académique</h1>
          <p className="text-gray-300">Notre équipe est à votre écoute pour vous accompagner.</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12">
        
        {/* Left Column: Info */}
        <div className="space-y-10">
          
          {/* Coordinates */}
          <div className="bg-[#192734] p-8 rounded-xl border border-white/5 shadow-lg">
            <h2 className="text-2xl font-serif font-bold text-white mb-6">Coordonnées Officielles</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-lg text-[var(--school-accent)]"><Mail className="w-5 h-5"/></div>
                <div>
                  <h4 className="text-white font-bold">Adresses Email</h4>
                  <p className="text-sm text-gray-400 mt-1">{`${vitrineEmail} (Administratif)`}</p>
                  <p className="text-sm text-gray-400">{`${vitrineEmail} (Questions cours)`}</p>
                  <p className="text-sm text-gray-400">{`${vitrineEmail} (Paiements)`}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-lg text-[var(--school-accent)]"><Phone className="w-5 h-5"/></div>
                <div>
                  <h4 className="text-white font-bold">Téléphone & WhatsApp</h4>
                  <p className="text-sm text-gray-400 mt-1">+33 7 66 52 57 08</p>
                  <p className="text-sm text-gray-500">Uniquement durant les heures d'ouverture</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-lg text-[var(--school-accent)]"><Clock className="w-5 h-5"/></div>
                <div>
                  <h4 className="text-white font-bold">Horaires d'Ouverture</h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-400 mt-1">
                    <span>Lundi - Vendredi:</span> <span>09h00 - 18h00</span>
                    <span>Samedi:</span> <span>10h00 - 14h00</span>
                    <span>Dimanche:</span> <span className="text-red-400">Fermé</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Info */}
          <div className="bg-[#192734]/50 p-8 rounded-xl border border-white/5">
             <h3 className="text-xl font-bold text-white mb-4">Traitement des Demandes</h3>
             <ul className="space-y-4">
                {[
                   "Réception et enregistrement de votre ticket",
                   "Analyse par le service concerné",
                   "Priorisation selon l'urgence (SLA)",
                   "Traitement ou escalade vers la direction",
                   "Réponse finale par email ou téléphone"
                ].map((step, i) => (
                   <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-[var(--school-accent)] font-bold">{i+1}</span>
                      {step}
                   </li>
                ))}
             </ul>
             <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-2 text-sm text-gray-500">
                <AlertCircle className="w-4 h-4" />
                Délai moyen de réponse : 24h à 48h ouvrées.
             </div>
          </div>

        </div>

        {/* Right Column: Form */}
        <div className="bg-[#192734] p-8 rounded-xl border border-white/5 shadow-2xl">
          <h2 className="text-2xl font-serif font-bold text-white mb-6">Formulaire de Contact</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nom complet</label>
                  <Input name="name" required value={formData.name} onChange={handleChange} className="bg-black/20 border-white/10 text-white" />
               </div>
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Email</label>
                  <Input name="email" type="email" required value={formData.email} onChange={handleChange} className="bg-black/20 border-white/10 text-white" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Téléphone</label>
                  <Input name="phone" value={formData.phone} onChange={handleChange} className="bg-black/20 border-white/10 text-white" />
               </div>
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Module (Optionnel)</label>
                  <select name="module" value={formData.module} onChange={handleChange} className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--school-accent)]">
                     <option value="">Sélectionner...</option>
                     <option value="academique">Académique</option>
                     <option value="coaching">Coaching</option>
                     <option value="autre">Autre</option>
                  </select>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium text-gray-300">Type de demande</label>
               <select name="requestType" required value={formData.requestType} onChange={handleChange} className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--school-accent)]">
                  <option value="">Sélectionner le service...</option>
                  <option value="inscription">Inscription & Admissions</option>
                  <option value="finance">Paiements & Facturation</option>
                  <option value="technique">Support Technique</option>
                  <option value="pedagogie">Question Pédagogique</option>
                  <option value="partenariat">Presse & Partenariat</option>
               </select>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium text-gray-300">Sujet</label>
               <Input name="subject" required value={formData.subject} onChange={handleChange} className="bg-black/20 border-white/10 text-white" />
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium text-gray-300">Message</label>
               <textarea 
                  name="message" 
                  required 
                  rows="5"
                  value={formData.message} 
                  onChange={handleChange} 
                  className="w-full p-3 rounded-md bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--school-accent)]"
               ></textarea>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-[var(--school-accent)] text-black hover:bg-[#b5952f] font-bold py-6">
               {isSubmitting ? 'Envoi en cours...' : <><Send className="w-4 h-4 mr-2" /> Envoyer la demande</>}
            </Button>

          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactSecretariatPage;