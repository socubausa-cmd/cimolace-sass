import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, CheckCircle, Mail } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const ContactModal = ({ isOpen, onClose, initialSubject = '' }) => {
  const vitrineEmail = useVitrineContactEmail();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: initialSubject,
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: dbError } = await supabase
        .from('contact_requests')
        .insert([formData]);

      if (dbError) throw dbError;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFormData({ name: '', email: '', subject: '', message: '' });
        onClose();
      }, 2000);
    } catch (err) {
      setError("Une erreur est survenue. Veuillez réessayer.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 m-auto max-w-lg h-fit bg-[#0F1419] border border-yellow-500/20 rounded-2xl p-0 shadow-2xl z-[70] overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="bg-gradient-to-r from-yellow-600/20 to-transparent p-6 border-b border-white/10 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-serif font-bold text-white">Contacter le Secrétariat</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {success ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                  <h4 className="text-xl font-bold text-white mb-2">Message envoyé !</h4>
                  <p className="text-gray-400">Nous vous répondrons dans les plus brefs délais.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Nom</label>
                      <input
                        required
                        type="text"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Email</label>
                      <input
                        required
                        type="email"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Sujet</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                      value={formData.subject}
                      onChange={e => setFormData({...formData, subject: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Message</label>
                    <textarea
                      required
                      rows={4}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 resize-none"
                      value={formData.message}
                      onChange={e => setFormData({...formData, message: e.target.value})}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold mt-4"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Envoyer
                  </Button>
                </form>
              )}
              
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                 <p className="text-sm text-gray-400 mb-2">Vous préférez nous écrire directement ?</p>
                 <a
                   href={`mailto:${vitrineEmail}`}
                   className="inline-flex items-center gap-2 text-[var(--school-accent)] hover:underline font-medium"
                 >
                    <Mail className="w-4 h-4" />
                    {vitrineEmail}
                 </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ContactModal;