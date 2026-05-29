import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { BarChart3, Users, Activity, TrendingUp, Clock, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Card from '@/components/Card';

const DashboardPage = () => {
  const stats = [
    { icon: BarChart3, label: 'Total Projects', value: '24', change: '+12%', positive: true },
    { icon: Users, label: 'Active Users', value: '1,284', change: '+8%', positive: true },
    { icon: Activity, label: 'Engagement', value: '89%', change: '-2%', positive: false },
    { icon: TrendingUp, label: 'Revenue', value: '$45.2K', change: '+23%', positive: true },
  ];

  const recentProjects = [
    { id: 1, name: 'E-Commerce Platform', status: 'In Progress', progress: 75, dueDate: '2024-02-15' },
    { id: 2, name: 'Mobile App Redesign', status: 'Completed', progress: 100, dueDate: '2024-01-28' },
    { id: 3, name: 'Dashboard Analytics', status: 'In Progress', progress: 45, dueDate: '2024-02-20' },
    { id: 4, name: 'Marketing Website', status: 'Planning', progress: 15, dueDate: '2024-03-01' },
  ];

  const recentActivity = [
    { id: 1, action: 'Project created', project: 'E-Commerce Platform', time: '2 hours ago' },
    { id: 2, action: 'Task completed', project: 'Mobile App Redesign', time: '5 hours ago' },
    { id: 3, action: 'Team member added', project: 'Dashboard Analytics', time: '1 day ago' },
    { id: 4, action: 'Milestone reached', project: 'Marketing Website', time: '2 days ago' },
  ];

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
        <title>Dashboard - Modern Dashboard</title>
        <meta name="description" content="Manage your projects and track progress with our intuitive dashboard." />
      </Helmet>

      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-gray-400 text-lg">Welcome back! Here's what\'s happening with your projects.</p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            {stats.map((stat, index) => (
              <motion.div key={index} variants={item}>
                <Card className="hover:scale-105">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                      <div className="flex items-center">
                        <span className={`text-sm font-medium ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
                          {stat.change}
                        </span>
                        <span className="text-gray-500 text-sm ml-2">vs last month</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Projects */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="lg:col-span-2"
            >
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Recent Projects</h2>
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </div>
                <div className="space-y-4">
                  {recentProjects.map((project, index) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-300 hover:border-purple-500/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold text-lg mb-1">{project.name}</h3>
                          <div className="flex items-center space-x-2">
                            {project.status === 'Completed' ? (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            ) : project.status === 'In Progress' ? (
                              <Activity className="h-4 w-4 text-blue-400" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-400" />
                            )}
                            <span className={`text-sm ${
                              project.status === 'Completed' ? 'text-green-400' :
                              project.status === 'In Progress' ? 'text-blue-400' :
                              'text-yellow-400'
                            }`}>
                              {project.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center text-gray-400 text-sm mb-1">
                            <Clock className="h-4 w-4 mr-1" />
                            {project.dueDate}
                          </div>
                          <span className="text-white font-semibold">{project.progress}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${project.progress}%` }}
                          transition={{ delay: 0.7 + index * 0.1, duration: 0.8 }}
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <Card>
                <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                      className="flex items-start space-x-3 pb-4 border-b border-white/10 last:border-b-0 last:pb-0"
                    >
                      <div className="w-2 h-2 bg-purple-600 rounded-full mt-2" />
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium mb-1">{activity.action}</p>
                        <p className="text-gray-400 text-sm mb-1">{activity.project}</p>
                        <p className="text-gray-500 text-xs">{activity.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;