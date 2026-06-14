import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Package, Loader2, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';

const HOVER_LIFT = { y: -3 };
const TAP_SOFT = { scale: 0.995 };
const TRANSITION_FAST = { duration: 0.2, ease: 'easeOut' };

const InventoryTab = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const refresh = async () => {
    setLoading(true);
    const [{ data: plans }, { data: subs }] = await Promise.all([
      supabase
        .from('billing_plans')
        .select('id,key,label,price_cents,is_active')
        .order('price_cents', { ascending: true }),
      supabase
        .from('billing_subscriptions')
        .select('id,plan_id,status')
        .in('status', ['active', 'past_due']),
    ]);

    const countsByPlan = {};
    (subs || []).forEach((s) => {
      const key = String(s.plan_id || '');
      countsByPlan[key] = (countsByPlan[key] || 0) + 1;
    });

    const rows = (plans || []).map((p) => ({
      id: p.id,
      name: p.label || p.key || 'Plan',
      category: 'forfait',
      quantity: Number(countsByPlan[String(p.id || '')] || 0),
      minQuantity: 1,
      unitPrice: Math.round(Number(p.price_cents || 0) / 100),
      active: Boolean(p.is_active),
    }));
    setInventory(rows);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Filter Data
  const filteredData = useMemo(() => {
    return (inventory || []).filter(item => 
      (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       item.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [inventory, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const totalItems = filteredData.length;
    const totalStock = filteredData.reduce((acc, item) => acc + item.quantity, 0);
    const totalValue = filteredData.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const lowStock = filteredData.filter(item => item.quantity <= item.minQuantity).length;
    const outOfStock = filteredData.filter(item => item.quantity === 0).length;

    return { totalItems, totalStock, totalValue, lowStock, outOfStock };
  }, [filteredData]);

  // Charts Data
  const categoryData = useMemo(() => {
    const acc = {};
    filteredData.forEach(item => {
      acc[item.category] = (acc[item.category] || 0) + 1;
    });
    return Object.keys(acc).map(k => ({ name: k, value: acc[k] }));
  }, [filteredData]);

  const stockStatusData = [
    { name: 'En Stock', value: filteredData.filter(i => i.quantity > i.minQuantity).length },
    { name: 'Faible', value: filteredData.filter(i => i.quantity > 0 && i.quantity <= i.minQuantity).length },
    { name: 'Rupture', value: filteredData.filter(i => i.quantity === 0).length }
  ];

  const COLORS = ['#D4AF37', '#60a5fa', '#f87171', '#4ade80'];
  const showSkeleton = loading && inventory.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={TRANSITION_FAST}
        className="flex justify-between items-center"
      >
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <Package className="text-[var(--school-accent)]" /> Inventaire
           </h2>
           <p className="text-gray-400 text-sm">Inventaire réel des forfaits et abonnés actifs</p>
        </div>
        <div className="flex gap-2">
           <Button
             onClick={() => void refresh()}
             variant="outline"
             className="border-white/10 text-white hover:bg-white/5 transition-all duration-200"
           >
             <RefreshCw className="w-4 h-4 mr-2"/> Actualiser
           </Button>
        </div>
      </motion.div>

      {showSkeleton ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
            <div className="h-[104px] rounded-xl bg-white/10 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 rounded-xl bg-white/10 animate-pulse" />
            <div className="h-80 rounded-xl bg-white/10 animate-pulse" />
          </div>
          <div className="h-80 rounded-xl bg-white/10 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Total Articles</p>
                <p className="text-2xl font-bold text-white">{stats.totalItems}</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Valeur Totale</p>
                <p className="text-2xl font-bold text-[var(--school-accent)]">{stats.totalValue.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Rupture de Stock</p>
                <p className="text-2xl font-bold text-red-400">{stats.outOfStock}</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="premium-panel border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-gray-400 text-xs uppercase">Stock Faible</p>
                <p className="text-2xl font-bold text-orange-400">{stats.lowStock}</p>
              </CardContent>
            </Card>
            </motion.div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="premium-panel border-white/10 p-4">
              <h3 className="text-white font-bold mb-4">Répartition par Catégorie</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0F1419', borderColor: '#333' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="premium-panel border-white/10 p-4">
              <h3 className="text-white font-bold mb-4">État du Stock</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockStatusData}>
                    <XAxis dataKey="name" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0F1419', borderColor: '#333' }} />
                    <Bar dataKey="value" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Data Table */}
          <Card className="premium-panel border-white/10">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input placeholder="Rechercher..." className="pl-8 bg-[#0F1419] border-white/10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 flex items-center justify-center text-gray-400"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</div>
              ) : null}
              <Table>
                <TableHeader className="bg-[#0F1419]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-400">Article</TableHead>
                    <TableHead className="text-gray-400">Catégorie</TableHead>
                    <TableHead className="text-gray-400">Qté</TableHead>
                    <TableHead className="text-gray-400">Prix Unit.</TableHead>
                    <TableHead className="text-gray-400">Valeur</TableHead>
                    <TableHead className="text-gray-400">Statut</TableHead>
                    <TableHead className="text-right text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && filteredData.length === 0 ? (
                    <TableRow className="border-white/5">
                      <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                        Aucun article pour cette recherche.
                      </TableCell>
                    </TableRow>
                  ) : filteredData.map((item) => (
                    <TableRow key={item.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium text-white">{item.name}</TableCell>
                      <TableCell className="text-gray-300">{item.category}</TableCell>
                      <TableCell className="text-white">{item.quantity}</TableCell>
                      <TableCell className="text-white">{item.unitPrice} EUR</TableCell>
                      <TableCell className="text-[var(--school-accent)]">{(item.quantity * item.unitPrice).toLocaleString()} EUR</TableCell>
                      <TableCell>
                        {item.quantity === 0 ? <Badge variant="destructive">Rupture</Badge> :
                          item.quantity <= item.minQuantity ? <Badge className="bg-orange-500 hover:bg-orange-600">Faible</Badge> :
                            <Badge className="bg-green-500 hover:bg-green-600">En Stock</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-xs text-gray-500">{item.active ? 'Plan actif' : 'Plan inactif'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default InventoryTab;