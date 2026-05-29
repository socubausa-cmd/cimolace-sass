import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { ExternalLink, Github, Calendar, Tag } from 'lucide-react';
import Card from '@/components/Card';

const ProjectsPage = () => {
  const [filter, setFilter] = useState('All');

  const projects = [
    {
      id: 1,
      title: 'E-Commerce Platform',
      description: 'A modern e-commerce solution with real-time inventory management and advanced analytics.',
      tags: ['React', 'Node.js', 'MongoDB'],
      category: 'Web',
      image: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=600&fit=crop',
      date: 'Jan 2024',
      status: 'Completed',
    },
    {
      id: 2,
      title: 'Mobile Banking App',
      description: 'Secure mobile banking application with biometric authentication and instant transfers.',
      tags: ['React Native', 'Firebase', 'TypeScript'],
      category: 'Mobile',
      image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&h=600&fit=crop',
      date: 'Dec 2023',
      status: 'In Progress',
    },
    {
      id: 3,
      title: 'AI Dashboard',
      description: 'Analytics dashboard powered by machine learning for predictive insights and data visualization.',
      tags: ['Python', 'TensorFlow', 'React'],
      category: 'AI/ML',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      date: 'Feb 2024',
      status: 'Planning',
    },
    {
      id: 4,
      title: 'Social Media Platform',
      description: 'Next-generation social networking platform with real-time messaging and content sharing.',
      tags: ['Next.js', 'PostgreSQL', 'WebSockets'],
      category: 'Web',
      image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=600&fit=crop',
      date: 'Nov 2023',
      status: 'Completed',
    },
    {
      id: 5,
      title: 'Fitness Tracker',
      description: 'Comprehensive fitness tracking app with workout plans and nutrition monitoring.',
      tags: ['Flutter', 'Firebase', 'Health Kit'],
      category: 'Mobile',
      image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop',
      date: 'Jan 2024',
      status: 'In Progress',
    },
    {
      id: 6,
      title: 'Cloud Infrastructure',
      description: 'Scalable cloud infrastructure solution with automated deployment and monitoring.',
      tags: ['AWS', 'Kubernetes', 'Terraform'],
      category: 'DevOps',
      image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&h=600&fit=crop',
      date: 'Dec 2023',
      status: 'Completed',
    },
  ];

  const categories = ['All', 'Web', 'Mobile', 'AI/ML', 'DevOps'];

  const filteredProjects = filter === 'All' 
    ? projects 
    : projects.filter(project => project.category === filter);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <>
      <Helmet>
        <title>Projects - Modern Dashboard</title>
        <meta name="description" content="Explore our portfolio of innovative projects and cutting-edge solutions." />
      </Helmet>

      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center"
          >
            <h1 className="text-5xl font-bold text-white mb-4">Our Projects</h1>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">
              Discover the innovative solutions we've built for our clients and community
            </p>
          </motion.div>

          {/* Filter Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-4 mb-12"
          >
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  filter === category
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </motion.div>

          {/* Projects Grid */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AnimatePresence mode="wait">
              {filteredProjects.map((project) => (
                <motion.div
                  key={project.id}
                  variants={item}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5 }}
                >
                  <Card className="group overflow-hidden h-full flex flex-col">
                    <div className="relative overflow-hidden rounded-xl mb-4">
                      <img
                        src={project.image}
                        alt={project.title}
                        className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                        <div className="flex space-x-3">
                          <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                            <ExternalLink className="h-5 w-5 text-white" />
                          </button>
                          <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                            <Github className="h-5 w-5 text-white" />
                          </button>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                          project.status === 'Completed' ? 'bg-green-500/80 text-white' :
                          project.status === 'In Progress' ? 'bg-blue-500/80 text-white' :
                          'bg-yellow-500/80 text-white'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-gray-400 text-sm mb-4 flex-1">
                        {project.description}
                      </p>
                      <div className="flex items-center text-gray-500 text-sm mb-3">
                        <Calendar className="h-4 w-4 mr-2" />
                        {project.date}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-purple-600/20 text-purple-300 text-xs font-medium rounded-full border border-purple-400/30 flex items-center"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ProjectsPage;