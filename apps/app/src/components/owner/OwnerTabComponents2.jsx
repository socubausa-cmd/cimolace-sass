import React from 'react';

const PlaceholderTab = ({ name }) => (
  <div className="p-8 text-center">
    <p className="text-gray-400 text-lg">{name}</p>
    <p className="text-gray-600 text-sm mt-2">Section en cours de configuration.</p>
  </div>
);

export const ResourcesTab = () => <PlaceholderTab name="Ressources" />;
export const SchoolInfoTab = () => <PlaceholderTab name="Informations École" />;
export const UsersTab = () => <PlaceholderTab name="Utilisateurs" />;
export const SettingsTab = () => <PlaceholderTab name="Paramètres" />;

export default { ResourcesTab, SchoolInfoTab, UsersTab, SettingsTab };
