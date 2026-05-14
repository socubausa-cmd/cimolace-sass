import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Users, BookOpen, BarChart2, MessageSquare, Phone, UserCheck, TrendingUp, TrendingDown, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [selectedProfessor, setSelectedProfessor] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeStudentDetailTab, setActiveStudentDetailTab] = useState('performance');
  const navigate = useNavigate();

  // --- Mock Data ---
  const professors = [
    { id: 1, name: 'Thomas Martin', courses: 3, avgStudentProgress: '82%', studentQuestions: 45 },
    { id: 2, name: 'Sophie Laurent', courses: 4, avgStudentProgress: '75%', studentQuestions: 62 },
  ];

  const students = [
    { id: 1, name: 'Alice Martin', progress: 85, grade: '17/20', lastActivity: 'Il y a 2h', notesTaken: true, videoStats: { time: '1h45', pauses: 3, replays: 1 }, videoDetails: [{ video: 'React Fundamentals', time: '1h 55m' }], quizzes: [{ title: 'Quiz React Hooks', score: '18/20', status: 'pass' }], notebookContent: "## React Hooks...", about: { tutor: 'Jean Martin', registered: '2023-09-01', lastYear: 'Validé', dob: '2003-05-12', age: 22, country: 'France' }, finance: { status: 'À jour', totalPaid: '2500€', nextPayment: 'N/A', debt: '0€' } },
    { id: 2, name: 'Bob Durand', progress: 45, grade: '11/20', lastActivity: 'Hier', notesTaken: false, videoStats: { time: '45min', pauses: 8, replays: 4 }, videoDetails: [{ video: 'React Fundamentals', time: '30m' }], quizzes: [{ title: 'Quiz React Hooks', score: '8/20', status: 'fail' }], weakPoints: ['React Hooks'], notebookContent: "Pas de notes.", about: { tutor: 'Claire Durand', registered: '2023-09-01', lastYear: 'Passage conditionnel', dob: '2004-11-20', age: 20, country: 'Belgique' }, finance: { status: 'En retard', totalPaid: '2000€', nextPayment: '2024-01-05', debt: '500€' } },
  ];

  const directorData = {
    stats: [
      { id: 'students', label: 'Total Étudiants', value: '1,250', icon: Users, details: 'Liste complète des étudiants.' },
      { id: 'professors', label: 'Total Professeurs', value: '45', icon: UserCheck, details: 'Liste des professeurs et leurs cours.' },
      { id: 'completion', label: 'Taux de complétion', value: '78%', icon: BarChart2, details: 'Détails par cours et par promotion.' },
      { id: 'alerts', label: 'Alertes', value: '3', icon: AlertTriangle, details: 'Voir les signalements récents.' },
    ]
  };

  const secretaryData = {
    stats: [
      { id: 'messages', label: 'Nouveaux Messages', value: '32', icon: MessageSquare, details: 'Ouvrir la boîte de réception.' },
      { id: 'calls', label: 'Appels en attente', value: '3', icon: Phone, details: 'Voir le journal des appels.' },
      { id: 'registrations', label: 'Inscriptions à valider', value: '8', icon: UserCheck, details: 'Traiter les nouvelles inscriptions.' },
      { id: 'tasks', label: 'Tâches du jour', value: '5', icon: BookOpen, details: 'Voir la liste des tâches.' },
    ],
    yearInfo: [
        { label: 'Année Scolaire', value: '2024-2025' },
        { label: 'Total Professeurs', value: '45' },
        { label: 'Total Étudiants', value: '1,250' },
        { label: 'Modules Actifs', value: '35' },
    ],
    accounting: [
        { label: 'Inscriptions (mois)', value: '+ 5,000€', icon: TrendingUp, color: 'text-green-400' },
        { label: 'Dettes Actives', value: '12,300€', icon: TrendingDown, color: 'text-red-400' },
        { label: 'Dépenses (mois)', value: '- 2,500€', icon: TrendingDown, color: 'text-yellow-400' },
    ]
  };
  
  const supervisorData = {
     stats: [
      { id: 'classes', label: 'Classes Actives', value: '58', icon: BookOpen, details: 'Vue détaillée des classes.' },
      { id: 'progress', label: 'Progression Moyenne', value: '62%', icon: BarChart2, details: 'Rapport de progression.' },
      { id: 'struggling', label: 'Étudiants en difficulté', value: '15', icon: Users, details: 'Liste des étudiants à suivre.' },
      { id: 'quizzes', label: 'Quiz à corriger', value: '47', icon: UserCheck, details: 'Accéder à la plateforme de correction.' },
    ]
  };

  const getRoleData = () => {
    switch (profile?.sub_role) {
      case 'directeur': return { data: directorData, title: 'Directeur' };
      case 'secretaire': return { data: secretaryData, title: 'Secrétaire' };
      case 'superviseur': return { data: supervisorData, title: 'Superviseur' };
      default: return { data: directorData, title: 'Admin' };
    }
  };

  const { data, title } = getRoleData();

  const handleStatClick = (stat) => {
    if (profile?.sub_role === 'directeur' || profile?.sub_role === 'secretaire') {
      if (stat.id === 'students') {
        setActiveTab('students');
        return;
      }
      if (stat.id === 'professors') {
        setActiveTab('professors');
        return;
      }
    }
    setActiveModal('details');
    setModalData(stat);
  };
  
  const handleCloseModal = () => {
    setActiveModal(null);
    setModalData(null);
    setSelectedProfessor(null);
    setSelectedStudent(null);
  };

  const renderDashboard = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {data.stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.button key={index} onClick={() => handleStatClick(stat)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.1 }} className="text-left w-full">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 h-full hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">{stat.label}</span>
                  <Icon className="h-6 w-6 text-purple-400" />
                </div>
                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
      {profile?.sub_role === 'secretaire' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Infos Année en Cours</h2>
                <div className="grid grid-cols-2 gap-4">
                    {data.yearInfo.map(info => <div key={info.label} className="bg-white/10 p-3 rounded-lg"><div className="text-sm text-gray-400">{info.label}</div><div className="text-lg font-bold text-white">{info.value}</div></div>)}
                </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Aperçu Comptabilité</h2>
                <div className="space-y-3">
                    {data.accounting.map(acc => {
                        const Icon = acc.icon;
                        return (<button key={acc.label} onClick={() => handleStatClick({label: acc.label, details: `Détails pour ${acc.label}`})} className="w-full text-left bg-white/10 p-3 rounded-lg flex justify-between items-center hover:bg-white/15 transition-colors"><div><div className="text-sm text-gray-400">{acc.label}</div><div className={`text-lg font-bold ${acc.color}`}>{acc.value}</div></div><Icon className={`h-6 w-6 ${acc.color}`} /></button>);
                    })}
                </div>
            </div>
        </div>
      )}
    </>
  );

  const renderProfessorManager = () => (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
      <h2 className="text-2xl font-bold text-white mb-6">Gestionnaire des Professeurs</h2>
      <div className="space-y-4">
        {professors.map(prof => (
          <div key={prof.id} className="bg-white/10 p-4 rounded-lg border border-white/20 flex justify-between items-center">
            <p className="text-lg font-semibold text-white">{prof.name}</p>
            <Button onClick={() => { setSelectedProfessor(prof); setActiveModal('professorDetails'); }}>Voir les stats</Button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStudentManager = () => (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
      <h2 className="text-2xl font-bold text-white mb-6">Gestionnaire des Étudiants</h2>
      <div className="space-y-4">
        {students.map(student => (
          <div key={student.id} className="bg-white/10 p-4 rounded-lg border border-white/20 flex justify-between items-center">
            <p className="text-lg font-semibold text-white">{student.name}</p>
            <Button onClick={() => { setSelectedStudent(student); setActiveModal('studentDetails'); }}>Voir le profil</Button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderModal = () => {
    if (!activeModal) return null;

    let content;
    switch (activeModal) {
      case 'details':
        content = (
          <>
            <h2 className="text-2xl font-bold text-white">{modalData.label}</h2>
            <p className="text-gray-300 mt-4">{modalData.details}</p>
            <p className="text-center mt-6 text-purple-400 animate-pulse">Chargement des données détaillées...</p>
          </>
        );
        break;
      case 'professorDetails':
        content = selectedProfessor && (
          <>
            <h2 className="text-2xl font-bold text-white">Statistiques de {selectedProfessor.name}</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white/10 p-4 rounded-lg"><div className="text-3xl font-bold text-purple-400">{selectedProfessor.courses}</div><div className="text-sm text-gray-400">Cours Actifs</div></div>
                <div className="bg-white/10 p-4 rounded-lg"><div className="text-3xl font-bold text-purple-400">{selectedProfessor.avgStudentProgress}</div><div className="text-sm text-gray-400">Progression Moy.</div></div>
                <div className="bg-white/10 p-4 rounded-lg"><div className="text-3xl font-bold text-purple-400">{selectedProfessor.studentQuestions}</div><div className="text-sm text-gray-400">Questions Reçues</div></div>
            </div>
          </>
        );
        break;
      case 'studentDetails':
        content = selectedStudent && (
          <>
            <h2 className="text-2xl font-bold text-white">Profil de {selectedStudent.name}</h2>
            <div className="border-b border-white/10 my-4">
              <nav className="-mb-px flex space-x-4">
                <button onClick={() => setActiveStudentDetailTab('performance')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeStudentDetailTab === 'performance' ? 'border-purple-400 text-purple-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Performance</button>
                <button onClick={() => setActiveStudentDetailTab('about')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeStudentDetailTab === 'about' ? 'border-purple-400 text-purple-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>À Propos</button>
                <button onClick={() => setActiveStudentDetailTab('finance')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeStudentDetailTab === 'finance' ? 'border-purple-400 text-purple-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Finances</button>
              </nav>
            </div>
            {activeStudentDetailTab === 'performance' && <div><p>Note moyenne: {selectedStudent.grade}</p><p>Progression: {selectedStudent.progress}%</p></div>}
            {activeStudentDetailTab === 'about' && <div><p>Tuteur: {selectedStudent.about.tutor}</p><p>Inscrit le: {selectedStudent.about.registered}</p></div>}
            {activeStudentDetailTab === 'finance' && (
                <div className="space-y-3">
                    <div className={`p-3 rounded-lg ${selectedStudent.finance.status === 'En retard' ? 'bg-red-500/20' : 'bg-green-500/20'}`}><strong className="text-white">Statut:</strong> <span className={selectedStudent.finance.status === 'En retard' ? 'text-red-300' : 'text-green-300'}>{selectedStudent.finance.status}</span></div>
                    <div className="bg-white/10 p-3 rounded-lg"><strong className="text-purple-300">Total Payé:</strong> {selectedStudent.finance.totalPaid}</div>
                    <div className="bg-white/10 p-3 rounded-lg"><strong className="text-purple-300">Dette:</strong> {selectedStudent.finance.debt}</div>
                    <div className="bg-white/10 p-3 rounded-lg"><strong className="text-purple-300">Prochain Paiement:</strong> {selectedStudent.finance.nextPayment}</div>
                </div>
            )}
          </>
        );
        break;
      default: content = null;
    }

    return (
      <AnimatePresence>
        {activeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseModal}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-slate-900/80 border border-white/20 rounded-xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" onClick={handleCloseModal} className="absolute top-2 right-2"><X className="h-5 w-5" /></Button>
              {content}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <Helmet>
        <title>Tableau de bord Admin - {title}</title>
        <meta name="description" content={`Tableau de bord pour ${title}`} />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-8">
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-white/10">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Tableau de bord - {title}</h1>
                    <p className="text-gray-300">Bienvenue, {profile?.full_name}.</p>
                </div>
                {(profile?.sub_role === 'directeur' || profile?.sub_role === 'secretaire') && (
                    <div className="flex gap-2">
                        <Button onClick={() => setActiveTab('dashboard')} variant={activeTab === 'dashboard' ? 'default' : 'ghost'} className={activeTab === 'dashboard' ? 'bg-purple-600' : 'text-white'}>Dashboard</Button>
                        <Button onClick={() => setActiveTab('professors')} variant={activeTab === 'professors' ? 'default' : 'ghost'} className={activeTab === 'professors' ? 'bg-purple-600' : 'text-white'}>Professeurs</Button>
                        <Button onClick={() => setActiveTab('students')} variant={activeTab === 'students' ? 'default' : 'ghost'} className={activeTab === 'students' ? 'bg-purple-600' : 'text-white'}>Étudiants</Button>
                    </div>
                )}
            </div>
          </div>
        </motion.div>

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'professors' && (profile?.sub_role === 'directeur' || profile?.sub_role === 'secretaire') && renderProfessorManager()}
        {activeTab === 'students' && (profile?.sub_role === 'directeur' || profile?.sub_role === 'secretaire') && renderStudentManager()}
      </div>
      {renderModal()}
    </div>
  );
};

export default AdminDashboard;