/**
 * Global providers wrapper for the LIRI Pro architecture.
 * Wraps all Zustand stores and any future context providers.
 */
import React from 'react';

type ProvidersProps = {
  children: React.ReactNode;
};

/**
 * All Zustand stores are singletons — no Provider wrapper needed.
 * This component is the correct place to add future context providers
 * (theme, i18n, feature flags, etc.) without polluting App.jsx.
 */
export function LiriProProviders({ children }: ProvidersProps) {
  return <>{children}</>;
}
