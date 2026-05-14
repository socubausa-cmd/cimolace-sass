import { useState, useEffect, useCallback } from 'react';
import { mockDataStore } from '@/lib/mockDataStore';
import { useToast } from '@/components/ui/use-toast';

export const useMockData = (key) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = mockDataStore.getAll()[key] || [];
      setData(result);
    } catch (error) {
      console.error(`Error fetching ${key}:`, error);
      toast({ title: "Erreur", description: "Impossible de charger les données.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [key, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addItem = async (item) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const store = mockDataStore.getAll();
      const newItem = { ...item, id: Math.random().toString(36).substr(2, 9) };
      const updated = { ...store, [key]: [...(store[key] || []), newItem] };
      mockDataStore.saveAll(updated);
      setData(prev => [...prev, newItem]);
      toast({ title: "Succès", description: "Élément ajouté avec succès." });
      return newItem;
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de l'ajout.", variant: "destructive" });
      throw error;
    }
  };

  const updateItem = async (id, updates) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const store = mockDataStore.getAll();
      const items = store[key] || [];
      const updated = items.map(item => item.id === id ? { ...item, ...updates } : item);
      mockDataStore.saveAll({ ...store, [key]: updated });
      setData(updated);
      toast({ title: "Succès", description: "Mis à jour avec succès." });
      return updated.find(item => item.id === id);
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de la mise à jour.", variant: "destructive" });
      throw error;
    }
  };

  const deleteItem = async (id) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const store = mockDataStore.getAll();
      const items = store[key] || [];
      const updated = items.filter(item => item.id !== id);
      mockDataStore.saveAll({ ...store, [key]: updated });
      setData(updated);
      toast({ title: "Succès", description: "Supprimé avec succès." });
      return true;
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de la suppression.", variant: "destructive" });
      throw error;
    }
  };

  return {
    data,
    loading,
    addItem,
    updateItem,
    deleteItem,
    refresh: fetchData
  };
};

export const useMockSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const store = mockDataStore.getAll();
      setSettings(store.schoolInfo || {});
      setLoading(false);
    };
    load();
  }, []);

  const updateSettings = async (updates) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const store = mockDataStore.getAll();
      const newSettings = { ...store.schoolInfo, ...updates };
      mockDataStore.saveAll({ ...store, schoolInfo: newSettings });
      setSettings(newSettings);
      toast({ title: "Succès", description: "Paramètres mis à jour." });
    } catch (error) {
       toast({ title: "Erreur", description: "Erreur de sauvegarde.", variant: "destructive" });
    }
  };

  return { settings, loading, updateSettings };
};