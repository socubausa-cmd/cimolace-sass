import React from 'react';
import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout';
import SupportTab from '@/components/support/SupportTab';

const SupportPage = () => {
   // Reusing the SupportTab component but wrapped in layout for standalone route
   return (
      <OwnerDashboardLayout activeTab="support" onTabChange={() => {}}>
         <SupportTab />
      </OwnerDashboardLayout>
   );
};

export default SupportPage;