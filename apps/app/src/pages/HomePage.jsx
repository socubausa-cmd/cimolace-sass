import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Shield, Sparkles, Code, BookOpen, GraduationCap, LayoutDashboard, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';
import PricingPackagesSection from '@/components/pricing/PricingPackagesSection';
import DashboardButton from '@/components/DashboardButton';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { resolveDashboardPath } from '@/lib/dashboardRoute';

const HomePage = () => {
  const { user } = useAuth();
  const dashboardPath = resolveDashboardPath(user);
  
  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Built with cutting-edge technology for blazing performance and seamless user experience.',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security ensures your data is protected at all times.',
    },
    {
      icon: Sparkles,
      title: 'Beautiful Design',
      description: 'Crafted with attention to detail, delivering a stunning visual experience.',
    },
    {
      icon: Code,
      title: 'Developer Friendly',
      description: 'Clean, maintainable code structure built with modern best practices.',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Home - Modern Dashboard</title>
        <meta name="description" content="Experience the future of modern web applications with our cutting-edge platform." />
      </Helmet>

      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1.2, 1, 1.2],
                rotate: [90, 0, 90],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="inline-block mb-6 px-4 py-2 bg-white/5 backdrop-blur-lg border border-white/10 rounded-full"
              >
                <span className="text-sm font-medium text-gray-300">
                  ✨ Welcome to the future
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
              >
                <span className="gradient-text">Build Amazing</span>
                <br />
                <span className="text-white">Experiences</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="text-xl sm:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
              >
                Create stunning web applications with our modern, intuitive platform.
                Built for developers who demand excellence.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              >
                <Link to={dashboardPath}>
                  <Button className="group bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/projects">
                  <Button className="bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 text-white px-8 py-6 text-lg rounded-xl shadow-lg transition-all duration-300 hover:scale-105">
                    View Projects
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center"
            >
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1 h-3 bg-white/40 rounded-full mt-2"
              />
            </motion.div>
          </motion.div>
        </section>

        {/* Quick Access Section (NEW) */}
        <section className="py-12 bg-[#0F1419] border-t border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
               <h2 className="text-2xl font-serif font-bold text-white mb-2">Accès Rapides</h2>
               <p className="text-gray-400 text-sm">Raccourcis vers vos outils essentiels</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               {/* Show Dashboard Card only if user logged in */}
               {user && (
                 <motion.div whileHover={{ y: -5 }} className="h-full">
                    <Link to={dashboardPath} className="block h-full">
                       <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl p-6 hover:bg-amber-500/20 transition-all cursor-pointer h-full flex flex-col items-center text-center">
                          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 mb-4">
                             <LayoutDashboard className="w-6 h-6" />
                          </div>
                          <h3 className="text-white font-bold mb-2">Tableau de Bord</h3>
                          <p className="text-gray-400 text-xs">Suivez votre progression et accédez à vos cours</p>
                       </div>
                    </Link>
                 </motion.div>
               )}

               <motion.div whileHover={{ y: -5 }} className="h-full">
                  <Link to="/formations" className="block h-full">
                     <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer h-full flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 mb-4">
                           <GraduationCap className="w-6 h-6" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Catalogue</h3>
                        <p className="text-gray-400 text-xs">Explorez toutes nos formations disponibles</p>
                     </div>
                  </Link>
               </motion.div>

               <motion.div whileHover={{ y: -5 }} className="h-full">
                  <Link to="/vie-scolaire?tab=calendar" className="block h-full">
                     <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer h-full flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 mb-4">
                           <Calendar className="w-6 h-6" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Agenda</h3>
                        <p className="text-gray-400 text-xs">Consultez les prochains événements et cours</p>
                     </div>
                  </Link>
               </motion.div>

               <motion.div whileHover={{ y: -5 }} className="h-full">
                  <Link to="/resources" className="block h-full">
                     <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer h-full flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-4">
                           <BookOpen className="w-6 h-6" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Ressources</h3>
                        <p className="text-gray-400 text-xs">Accédez à la bibliothèque numérique</p>
                     </div>
                  </Link>
               </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Packages Section (Replaces Learning Cycles) */}
        <PricingPackagesSection />

        {/* Features Section */}
        <section className="py-20 bg-gradient-to-b from-black to-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Why Choose Us
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Everything you need to build exceptional products
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="group bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-b from-slate-950 to-black">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-white/10 rounded-3xl p-12 shadow-2xl"
            >
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                De la prophétie à la raison, de la raison à la science.
              </p>
              <Link to={dashboardPath}>
                <Button className="group bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-10 py-6 text-lg rounded-xl shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105">
                  Start Building Now
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default HomePage;