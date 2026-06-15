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

/* Thème CLAIR « Wix Studio » — aligné sur OwnerDashboardOverview. */
const LT_TEXT = '#18181B';
const LT_SUB = '#52525B';
const LT_MUTED = '#71717A';
const LT_BORDER = 'rgba(0,0,0,0.08)';
const LT_GOLD_INK = '#8A6D1A';
const cardSurface = {
  background: '#FFFFFF',
  border: `1px solid ${LT_BORDER}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

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
           <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: LT_TEXT }}>
             <Package style={{ color: LT_GOLD_INK }} /> Inventaire
           </h2>
           <p className="text-sm" style={{ color: LT_SUB }}>Inventaire réel des forfaits et abonnés actifs</p>
        </div>
        <div className="flex gap-2">
           <Button
             onClick={() => void refresh()}
             variant="outline"
             className="bg-white text-zinc-700 border-black/10 hover:bg-zinc-50 transition-all duration-200"
           >
             <RefreshCw className="w-4 h-4 mr-2"/> Actualiser
           </Button>
        </div>
      </motion.div>

      {showSkeleton ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="h-[104px] rounded-xl bg-black/[0.05] animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 rounded-xl bg-black/[0.05] animate-pulse" />
            <div className="h-80 rounded-xl bg-black/[0.05] animate-pulse" />
          </div>
          <div className="h-80 rounded-xl bg-black/[0.05] animate-pulse" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Total Articles</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: LT_TEXT }}>{stats.totalItems}</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Valeur Totale</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: LT_GOLD_INK }}>{stats.totalValue.toLocaleString()} EUR</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Rupture de Stock</p>
                <p className="text-2xl font-bold tabular-nums text-red-600">{stats.outOfStock}</p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div whileHover={HOVER_LIFT} whileTap={TAP_SOFT} transition={TRANSITION_FAST}>
            <Card className="border-0 transition-all" style={cardSurface}>
              <CardContent className="p-4 h-[104px] flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: LT_MUTED }}>Stock Faible</p>
                <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.lowStock}</p>
              </CardContent>
            </Card>
            </motion.div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 p-4" style={cardSurface}>
              <h3 className="font-bold mb-4" style={{ color: LT_TEXT }}>Répartition par Catégorie</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', color: '#18181B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Legend wrapperStyle={{ color: '#52525B', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="border-0 p-4" style={cardSurface}>
              <h3 className="font-bold mb-4" style={{ color: LT_TEXT }}>État du Stock</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockStatusData}>
                    <XAxis dataKey="name" stroke="#71717A" fontSize={12} />
                    <YAxis stroke="#71717A" fontSize={12} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', color: '#18181B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="value" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Data Table */}
          <Card className="border-0" style={cardSurface}>
            <div className="p-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${LT_BORDER}` }}>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4" style={{ color: LT_MUTED }} />
                <Input placeholder="Rechercher..." className="pl-8 bg-[#F4F5F7] border-black/10 text-zinc-900 placeholder:text-zinc-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 flex items-center justify-center" style={{ color: LT_MUTED }}><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</div>
              ) : null}
              <Table>
                <TableHeader className="bg-[#F8F8FA]">
                  <TableRow className="border-black/[0.06] hover:bg-transparent">
                    <TableHead className="text-zinc-500">Article</TableHead>
                    <TableHead className="text-zinc-500">Catégorie</TableHead>
                    <TableHead className="text-zinc-500">Qté</TableHead>
                    <TableHead className="text-zinc-500">Prix Unit.</TableHead>
                    <TableHead className="text-zinc-500">Valeur</TableHead>
                    <TableHead className="text-zinc-500">Statut</TableHead>
                    <TableHead className="text-right text-zinc-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && filteredData.length === 0 ? (
                    <TableRow className="border-black/[0.06]">
                      <TableCell colSpan={7} className="text-center py-10" style={{ color: LT_MUTED }}>
                        Aucun article pour cette recherche.
                      </TableCell>
                    </TableRow>
                  ) : filteredData.map((item) => (
                    <TableRow key={item.id} className="border-black/[0.06] hover:bg-zinc-50">
                      <TableCell className="font-medium" style={{ color: LT_TEXT }}>{item.name}</TableCell>
                      <TableCell style={{ color: LT_SUB }}>{item.category}</TableCell>
                      <TableCell style={{ color: LT_TEXT }}>{item.quantity}</TableCell>
                      <TableCell style={{ color: LT_TEXT }}>{item.unitPrice} EUR</TableCell>
                      <TableCell style={{ color: LT_GOLD_INK }}>{(item.quantity * item.unitPrice).toLocaleString()} EUR</TableCell>
                      <TableCell>
                        {item.quantity === 0 ? <Badge variant="destructive">Rupture</Badge> :
                          item.quantity <= item.minQuantity ? <Badge className="bg-amber-500 hover:bg-amber-600 text-black">Faible</Badge> :
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">En Stock</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-xs" style={{ color: LT_MUTED }}>{item.active ? 'Plan actif' : 'Plan inactif'}</TableCell>
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