import React, { useState } from 'react';
import OwnerAdminLayout from '@/components/admin/OwnerAdminLayout';
import { 
  DashboardTab, ProductsTab, OrdersTab, CustomersTab, UsersTab, LogsActivitiesTab 
} from '@/components/admin/AdminTabsData';
import { 
  StoreSettingsTab, PaymentSettingsTab, OwnerProfileTab 
} from '@/components/admin/AdminTabsSettings';
import { Card } from '@/components/ui/card';

// Placeholder for tabs not yet fully implemented to save space
const PlaceholderTab = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-96 bg-[#192734] rounded-xl border border-white/10">
    <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-400">This module is under development.</p>
  </div>
);

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'products': return <ProductsTab />;
      case 'orders': return <OrdersTab />;
      case 'customers': return <CustomersTab />;
      case 'users': return <UsersTab />;
      case 'categories': return <PlaceholderTab title="Categories Management" />;
      case 'settings': return <StoreSettingsTab />;
      case 'payment': return <PaymentSettingsTab />;
      case 'shipping': return <PlaceholderTab title="Shipping Settings" />;
      case 'email': return <PlaceholderTab title="Email & Notifications" />;
      case 'reports': return <PlaceholderTab title="Reports & Analytics" />;
      case 'logs': return <LogsActivitiesTab />;
      case 'profile': return <OwnerProfileTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <OwnerAdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </OwnerAdminLayout>
  );
};

export default AdminPanel;