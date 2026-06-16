import React from 'react';

const PlaceholderTab = ({ name }) => (
  <div className="p-8 text-center">
    <p className="text-lg" style={{ color: '#18181B' }}>{name}</p>
    <p className="text-sm mt-2" style={{ color: '#71717A' }}>Section en cours de configuration.</p>
  </div>
);

export const ResourcesTab = () => <PlaceholderTab name="Ressources" />;
export const SchoolInfoTab = () => <PlaceholderTab name="Informations École" />;
export const UsersTab = () => <PlaceholderTab name="Utilisateurs" />;
export const SettingsTab = () => <PlaceholderTab name="Paramètres" />;

export default { ResourcesTab, SchoolInfoTab, UsersTab, SettingsTab };
