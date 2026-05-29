import React, { createContext, useContext } from 'react';

const MobileReelsShellContext = createContext(false);

export function MobileReelsShellProvider({ active, children }) {
  return (
    <MobileReelsShellContext.Provider value={Boolean(active)}>
      {children}
    </MobileReelsShellContext.Provider>
  );
}

export function useMobileReelsShellActive() {
  return useContext(MobileReelsShellContext);
}
