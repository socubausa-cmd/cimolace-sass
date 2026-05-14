import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Calendar, AlertCircle, CheckCircle, Clock,
  FileText, Download, ChevronRight, ChevronDown, RefreshCw,
  Zap, ExternalLink, Info, AlertTriangle
} from 'lucide-react';

export default function CimolaceBillingDashboardPage() {
  const [billingProfile, setBillingProfile] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      // TODO: Appeler l'API pour récupérer les données de facturation
      // Pour l'instant, données mock
      setBillingProfile({
        id: '1',
        billing_mode: 'chariow_manual',
        plan_key: 'pro',
        monthly_amount: 200,
        setup_status: 'paid',
        subscription_status: 'active',
        next_billing_date: '2026-05-30T00:00:00Z',
        grace_until: null,
      });
      
      setSchedules([
        {
          id: '1',
          amount: 200,
          due_date: '2026-05-30T00:00:00Z',
          status: 'pending',
          payment_link: null,
        },
        {
          id: '2',
          amount: 200,
          due_date: '2026-04-30T00:00:00Z',
          status: 'paid',
          paid_at: '2026-04-28T00:00:00Z',
        },
      ]);
      
      setInvoices([
        {
          id: '1',
          invoice_number: 'INV-202604-1234',
          amount: 200,
          type: 'monthly',
          status: 'paid',
          due_date: '2026-04-30T00:00:00Z',
          paid_at: '2026-04-28T00:00:00Z',
        },
        {
          id: '2',
          invoice_number: 'INV-202604-5678',
          amount: 500,
          type: 'setup',
          status: 'paid',
          due_date: '2026-04-15T00:00:00Z',
          paid_at: '2026-04-14T00:00:00Z',
        },
      ]);
    } catch (error) {
      console.error('Erreur chargement données billing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePaymentLink = async () => {
    try {
      // TODO: Appeler l'API pour générer le lien Chariow
      setPaymentLink('https://pay.chariow.ga/checkout/mock-link');
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Erreur génération lien:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getDaysUntilDue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'text-green-400';
      case 'pending': return 'text-amber-400';
      case 'late': return 'text-orange-400';
      case 'overdue': return 'text-red-400';
      case 'grace_period': return 'text-yellow-400';
      default: return 'text-white/60';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-5 h-5" />;
      case 'pending': return <Clock className="w-5 h-5" />;
      case 'late': return <AlertCircle className="w-5 h-5" />;
      case 'overdue': return <AlertTriangle className="w-5 h-5" />;
      case 'grace_period': return <AlertCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getSubscriptionStatusText = (status) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'suspended': return 'Suspendu';
      case 'cancelled': return 'Annulé';
      case 'pending': return 'En attente';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const nextSchedule = schedules.find(s => s.status === 'pending');
  const daysUntilDue = nextSchedule ? getDaysUntilDue(nextSchedule.due_date) : null;
  const isUrgent = daysUntilDue !== null && daysUntilDue <= 5;

  return (
    <>
      <Helmet>
        <title>Facturation | CIMOLACE</title>
        <meta name="description" content="Gestion de votre abonnement CIMOLACE" />
      </Helmet>

      <div className="min-h-screen bg-[#050507] text-white">
        {/* Header */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-[#050507]/80 border-b border-white/[0.04]">
          <Link to="/cimolace/admin" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black tracking-tight">CIMOLACE</span>
          </Link>
          <Link
            to="/cimolace/admin"
            className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Retour au dashboard
          </Link>
        </nav>

        <div className="pt-24 pb-12 px-6">
          <div className="max-w-5xl mx-auto">
            {/* Header Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white mb-2">Facturation & Abonnement</h1>
              <p className="text-white/60">Gérez vos paiements et suivez votre abonnement</p>
            </div>

            {/* Billing Mode Badge */}
            <div className="flex items-center gap-2 mb-6">
              <div className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs font-medium">
                Mode Chariow Manuel
              </div>
              <div className={`px-3 py-1 rounded-full border text-xs font-medium ${
                billingProfile?.subscription_status === 'active'
                  ? 'bg-green-500/20 border-green-500/30 text-green-400'
                  : 'bg-red-500/20 border-red-500/30 text-red-400'
              }`}>
                {getSubscriptionStatusText(billingProfile?.subscription_status)}
              </div>
            </div>

            {/* Current Plan Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Plan actif</h2>
                  <p className="text-3xl font-black text-white capitalize">
                    {billingProfile?.plan_key}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/60 mb-1">Montant mensuel</p>
                  <p className="text-2xl font-bold text-white">
                    {billingProfile?.monthly_amount}€
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/40" />
                  <span className="text-sm text-white/60">
                    Prochaine échéance : {nextSchedule ? formatDate(nextSchedule.due_date) : 'N/A'}
                  </span>
                </div>
                {daysUntilDue !== null && (
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {daysUntilDue > 0 ? `J-${daysUntilDue}` : daysUntilDue === 0 ? "Aujourd'hui" : `J+${Math.abs(daysUntilDue)}`}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Payment Action Card */}
            {nextSchedule && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`bg-gradient-to-br ${
                  isUrgent 
                    ? 'from-orange-500/20 to-red-500/20 border-orange-500/30' 
                    : 'from-violet-500/20 to-cyan-500/20 border-violet-500/30'
                } border rounded-2xl p-6 mb-6`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      {isUrgent ? 'Paiement requis' : 'Paiement mensuel'}
                    </h3>
                    <p className="text-sm text-white/60">
                      {isUrgent 
                        ? 'Votre paiement est en retard. Veuillez payer dès que possible.'
                        : 'Votre paiement mensuel est disponible.'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">
                      {nextSchedule.amount}€
                    </p>
                    <p className="text-xs text-white/60">à payer</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  {!nextSchedule.payment_link ? (
                    <button
                      onClick={handleGeneratePaymentLink}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-5 h-5" />
                      Générer lien de paiement
                    </button>
                  ) : (
                    <a
                      href={paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Payer via Chariow
                    </a>
                  )}
                </div>
              </motion.div>
            )}

            {/* Payment History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6"
            >
              <h3 className="text-lg font-bold text-white mb-4">Historique des paiements</h3>
              
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={getStatusColor(schedule.status)}>
                        {getStatusIcon(schedule.status)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{schedule.amount}€</p>
                        <p className="text-xs text-white/60">{formatDate(schedule.due_date)}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${getStatusColor(schedule.status)}`}>
                      {schedule.status === 'paid' ? 'Payé' : schedule.status === 'pending' ? 'En attente' : schedule.status}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Invoices */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Factures
                </h3>
              </div>
              
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id}>
                    <div
                      className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.04] cursor-pointer hover:bg-white/[0.04] transition-colors"
                      onClick={() => setExpandedInvoice(expandedInvoice === invoice.id ? null : invoice.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={getStatusColor(invoice.status)}>
                          {getStatusIcon(invoice.status)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{invoice.invoice_number}</p>
                          <p className="text-xs text-white/60">
                            {invoice.type === 'setup' ? 'Frais de configuration' : 'Abonnement mensuel'} • {formatDate(invoice.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium text-white">{invoice.amount}€</p>
                          <p className={`text-xs ${getStatusColor(invoice.status)}`}>
                            {invoice.status === 'paid' ? 'Payé' : invoice.status}
                          </p>
                        </div>
                        {expandedInvoice === invoice.id ? (
                          <ChevronDown className="w-5 h-5 text-white/40" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-white/40" />
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedInvoice === invoice.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-2 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/60">Date de paiement</span>
                              <span className="text-white">
                                {invoice.paid_at ? formatDate(invoice.paid_at) : 'Non payé'}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-white/60">Type</span>
                              <span className="text-white capitalize">{invoice.type}</span>
                            </div>
                            <button className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors">
                              <Download className="w-4 h-4" />
                              Télécharger PDF
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Suspension Warning */}
            {billingProfile?.subscription_status === 'suspended' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mt-6"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-red-400 mb-2">Abonnement suspendu</h3>
                    <p className="text-sm text-white/60 mb-4">
                      Votre abonnement a été suspendu en raison d'un paiement en retard. Veuillez régulariser votre situation pour réactiver vos services.
                    </p>
                    <button
                      onClick={handleGeneratePaymentLink}
                      className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Payer maintenant
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Payment Modal */}
        <AnimatePresence>
          {showPaymentModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6"
              onClick={() => setShowPaymentModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#0a0a0c] border border-white/[0.1] rounded-2xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-white mb-4">Lien de paiement généré</h3>
                <p className="text-white/60 mb-4">
                  Utilisez ce lien pour payer votre abonnement via Chariow Mobile Money.
                </p>
                <div className="bg-white/[0.05] rounded-lg p-4 mb-4">
                  <p className="text-xs text-white/40 mb-1">Lien de paiement</p>
                  <p className="text-sm text-violet-400 break-all">{paymentLink}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Fermer
                  </button>
                  <a
                    href={paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
