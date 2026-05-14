import { useState } from 'react';
export const useAdminData = () => {
  return { data: [], loading: false, error: null, refetch: () => {} };
};
