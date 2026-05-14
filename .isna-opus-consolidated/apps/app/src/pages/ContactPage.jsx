import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getWebContact } from '@/data/prorascienceVitrineFromWebContent';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const ContactPage = () => {
  const vitrineEmail = useVitrineContactEmail();
  const wc = useMemo(() => getWebContact(vitrineEmail), [vitrineEmail]);
  const contactInfo = wc.info.map((block, i) => ({
    icon: [MapPin, Phone, Mail][i],
    title: block.title,
    lines: block.lines,
    email: block.email,
  }));
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('contact_requests')
        .insert([{
           name: formData.name,
           email: formData.email,
           subject: formData.subject,
           message: formData.message,
           status: 'new',
           created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Message Envoyé",
        description: "Nous avons bien reçu votre demande. Réponse sous 48h.",
        className: "bg-green-600 text-white border-none"
      });
      setFormData({ name: '', email: '', subject: '', message: '' });

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 font-sans pb-20">
      <Helmet><title>Nous Contacter | PRORASCIENCE</title></Helmet>

      {/* Hero */}
      <section className="bg-[#151a21] py-16 text-center px-6 border-b border-white/5">
        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{wc.hero.title}</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
           {wc.hero.lead}
        </p>
      </section>

      <div className="max-w-6xl mx-auto px-6 mt-12 grid lg:grid-cols-2 gap-16">
         
         {/* Form Section */}
         <div>
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
               <Mail className="w-6 h-6 text-[#D4AF37]" /> Envoyez-nous un message
            </h2>
            
            {success ? (
               <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center animate-in fade-in zoom-in">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
                     <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Message Reçu !</h3>
                  <p className="text-gray-400 mb-6">Merci de nous avoir contactés. Nous reviendrons vers vous très rapidement.</p>
                  <Button onClick={() => setSuccess(false)} variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10">
                     Envoyer un autre message
                  </Button>
               </div>
            ) : (
               <form onSubmit={handleSubmit} className="space-y-6 bg-[#192734] p-8 rounded-2xl border border-white/5">
                  <div className="grid md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Nom Complet</label>
                        <Input 
                           name="name" 
                           required 
                           value={formData.name} 
                           onChange={handleChange}
                           className="bg-[#0F1419] border-white/10 focus:border-[#D4AF37]" 
                           placeholder="Votre nom" 
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Email</label>
                        <Input 
                           name="email" 
                           type="email" 
                           required 
                           value={formData.email} 
                           onChange={handleChange}
                           className="bg-[#0F1419] border-white/10 focus:border-[#D4AF37]" 
                           placeholder="votre@email.com" 
                        />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-gray-300">Sujet</label>
                     <select 
                        name="subject" 
                        required 
                        value={formData.subject} 
                        onChange={handleChange}
                        className="w-full h-10 rounded-md border border-white/10 bg-[#0F1419] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent"
                     >
                        <option value="">Sélectionnez un sujet</option>
                        {wc.subjects.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-gray-300">Message</label>
                     <Textarea 
                        name="message" 
                        required 
                        value={formData.message} 
                        onChange={handleChange}
                        className="bg-[#0F1419] border-white/10 focus:border-[#D4AF37] min-h-[150px]" 
                        placeholder="Comment pouvons-nous vous aider ?" 
                     />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold h-12">
                     {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                     {loading ? "Envoi en cours..." : "Envoyer le Message"}
                  </Button>
               </form>
            )}
         </div>

         {/* Info Section */}
         <div className="space-y-10">
            <div>
               <h2 className="text-2xl font-bold mb-8">Informations</h2>
               <div className="space-y-6">
                  {contactInfo.map((item) => (
                     <div key={item.title} className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-[#192734] rounded-lg flex items-center justify-center text-[#D4AF37] border border-white/5 shrink-0">
                           <item.icon className="w-6 h-6" />
                        </div>
                        <div>
                           <h3 className="font-bold text-lg text-white">{item.title}</h3>
                           {item.email ? (
                              <>
                                {item.lines.map((line, j) => (
                                  <a
                                    key={`${item.title}-${j}`}
                                    href={`mailto:${item.email}`}
                                    className="block text-gray-400 hover:text-[#D4AF37] transition-colors"
                                  >
                                    {line}
                                  </a>
                                ))}
                              </>
                           ) : (
                              item.lines.map((line, j) => (
                                <p key={`${item.title}-${j}`} className="text-gray-400">
                                  {line}
                                </p>
                              ))
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {/* Map Placeholder */}
            <div className="bg-[#192734] h-64 rounded-2xl border border-white/10 flex items-center justify-center text-gray-500">
               <div className="text-center">
                  <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Carte Google Maps intégrée ici</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ContactPage;