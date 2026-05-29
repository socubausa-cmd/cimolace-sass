import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Clock, Award, CreditCard, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const InscriptionPage = () => {
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    country: '',
    objectives: ''
  });
  const navigate = useNavigate();

  const programs = [
    {
      id: 'web-dev',
      title: 'Développement Web Full-Stack',
      duration: '6 mois',
      level: 'Débutant à Expert',
      price: 2999,
      monthlyPrice: 499,
      description: 'Maîtrisez React, Node.js, et les technologies modernes du web',
      features: [
        'HTML, CSS, JavaScript avancé',
        'React & Next.js',
        'Node.js & Express',
        'Bases de données SQL/NoSQL',
        'Déploiement et DevOps',
        'Projet final en entreprise'
      ],
      color: 'from-blue-600 to-cyan-600'
    },
    {
      id: 'data-science',
      title: 'Data Science & IA',
      duration: '8 mois',
      level: 'Intermédiaire',
      price: 3499,
      monthlyPrice: 583,
      description: 'Devenez expert en analyse de données et intelligence artificielle',
      features: [
        'Python & R',
        'Machine Learning',
        'Deep Learning',
        'Visualisation de données',
        'Big Data & Cloud',
        'Projets réels avec des entreprises'
      ],
      color: 'from-green-600 to-emerald-600'
    },
    {
      id: 'ux-design',
      title: 'Design UX/UI',
      duration: '4 mois',
      level: 'Débutant',
      price: 2299,
      monthlyPrice: 383,
      description: 'Créez des expériences utilisateur exceptionnelles',
      features: [
        'Recherche utilisateur',
        'Wireframing & Prototyping',
        'Design System',
        'Figma & Adobe Creative Suite',
        'Tests utilisateurs',
        'Portfolio professionnel'
      ],
      color: 'from-purple-600 to-pink-600'
    }
  ];

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!selectedProgram) {
      toast({
        title: "Sélection requise",
        description: "Veuillez choisir un programme de formation.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive"
      });
      return;
    }

    // Simulation du processus d'inscription
    const enrollmentData = {
      program: selectedProgram,
      student: formData,
      timestamp: new Date().toISOString()
    };

    // Sauvegarde locale (sera remplacé par Supabase)
    const existingEnrollments = JSON.parse(localStorage.getItem('enrollments') || '[]');
    existingEnrollments.push(enrollmentData);
    localStorage.setItem('enrollments', JSON.stringify(existingEnrollments));
    localStorage.setItem('user-profile', JSON.stringify(formData));

    toast({
      title: "Paiement réussi !",
      description: "Votre inscription est validée. Redirection vers votre tableau de bord...",
    });

    setTimeout(() => {
      navigate('/eleve');
    }, 2000);
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <Helmet>
        <title>Inscription - EduPlatform</title>
        <meta name="description" content="Inscrivez-vous à nos formations certifiantes et commencez votre transformation professionnelle" />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-white mb-6">
            Choisissez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">formation</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Sélectionnez le programme qui correspond à vos objectifs et commencez votre transformation professionnelle dès aujourd'hui.
          </p>
        </motion.div>

        {/* Sélection du programme */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {programs.map((program, index) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className={`relative bg-white/5 backdrop-blur-sm rounded-xl p-6 border-2 cursor-pointer transition-all ${
                selectedProgram?.id === program.id 
                  ? 'border-purple-400 bg-purple-600/20' 
                  : 'border-white/10 hover:border-white/30'
              }`}
              onClick={() => setSelectedProgram(program)}
            >
              {selectedProgram?.id === program.id && (
                <div className="absolute -top-3 -right-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full p-2">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              
              <div className={`bg-gradient-to-r ${program.color} rounded-lg p-3 w-fit mb-4`}>
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">{program.title}</h3>
              <p className="text-gray-300 mb-4">{program.description}</p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-gray-300">
                  <Clock className="h-4 w-4 mr-2 text-purple-400" />
                  <span>{program.duration}</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <Award className="h-4 w-4 mr-2 text-purple-400" />
                  <span>{program.level}</span>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                {program.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center text-sm text-gray-300">
                    <Check className="h-3 w-3 mr-2 text-green-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-white/10 pt-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{program.price}€</div>
                  <div className="text-sm text-gray-300">ou {program.monthlyPrice}€/mois</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Formulaire d'inscription */}
        {selectedProgram && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">
                Finaliser votre inscription
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">Prénom *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                      placeholder="Votre prénom"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-2">Nom *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                      placeholder="Votre nom"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Pays</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                    placeholder="France"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Vos objectifs</label>
                  <textarea
                    name="objectives"
                    value={formData.objectives}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                    placeholder="Décrivez vos objectifs professionnels..."
                  />
                </div>
                
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-6 border border-purple-400/30">
                  <h3 className="text-xl font-bold text-white mb-4">Récapitulatif</h3>
                  <div className="space-y-2 text-gray-300">
                    <div className="flex justify-between">
                      <span>Formation:</span>
                      <span className="text-white">{selectedProgram.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Durée:</span>
                      <span className="text-white">{selectedProgram.duration}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-purple-400">{selectedProgram.price}€</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payer et s'inscrire
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default InscriptionPage;