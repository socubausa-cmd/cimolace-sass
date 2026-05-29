import React, { useState, useEffect } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DataTable from '@/components/ui/DataTable';
import { SimpleLineChart, SimpleBarChart } from '@/components/admin/AdminCharts';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Search, Filter, ShoppingBag, Users, DollarSign, Package, 
  Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

// --- Dashboard Tab ---
export const DashboardTab = () => {
  const { fetchOrders, fetchProducts, fetchCustomers } = useAdminData();
  const [stats, setStats] = useState({ revenue: 0, orders: 0, customers: 0, products: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const [orders, products, customers] = await Promise.all([fetchOrders(), fetchProducts(), fetchCustomers()]);
      const revenue = orders?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
      setStats({
        revenue,
        orders: orders?.length || 0,
        customers: customers?.length || 0,
        products: products?.length || 0
      });
      setLoading(false);
    };
    loadStats();
  }, [fetchOrders, fetchProducts, fetchCustomers]);

  const StatCard = ({ title, value, icon: Icon, trend }) => (
    <Card className="bg-[#192734] border-white/10">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <h3 className="text-2xl font-bold text-white mt-2">{value}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-500">
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-green-400 flex items-center">
            <ArrowUpRight className="w-4 h-4 mr-1" /> {trend}%
          </span>
          <span className="text-gray-500 ml-2">vs last month</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={`$${stats.revenue.toFixed(2)}`} icon={DollarSign} trend={12.5} />
        <StatCard title="Total Orders" value={stats.orders} icon={ShoppingBag} trend={8.2} />
        <StatCard title="Total Customers" value={stats.customers} icon={Users} trend={5.3} />
        <StatCard title="Total Products" value={stats.products} icon={Package} trend={2.1} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Sales Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart 
              data={[
                { label: 'W1', value: 400 }, { label: 'W2', value: 300 }, 
                { label: 'W3', value: 550 }, { label: 'W4', value: 450 }
              ]} 
              height={250} 
            />
          </CardContent>
        </Card>
        <Card className="bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
             <SimpleBarChart 
               data={[
                 { label: 'Mod A', value: 65 }, { label: 'Mod B', value: 45 },
                 { label: 'Mod C', value: 30 }, { label: 'Mod D', value: 20 }
               ]}
               height={250}
               color="#7B61FF"
             />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// --- Products Tab ---
export const ProductsTab = () => {
  const { fetchProducts, deleteProduct } = useAdminData();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, [fetchProducts]);

  const columns = [
    { key: 'title', label: 'Name' },
    { key: 'price', label: 'Price', render: (val) => `${val}€` },
    { key: 'status', label: 'Status', render: (val) => <Badge variant={val === 'active' ? 'default' : 'secondary'}>{val}</Badge> },
    { key: 'code', label: 'Code' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Products</h2>
        <Button variant="accent"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
      </div>
      <DataTable 
        columns={columns} 
        data={products} 
        searchFields={['title', 'code']}
        onDelete={(item) => deleteProduct(item.id).then(() => fetchProducts().then(setProducts))}
        onEdit={(item) => console.log('Edit', item)}
      />
    </div>
  );
};

// --- Orders Tab ---
export const OrdersTab = () => {
  const { fetchOrders } = useAdminData();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders().then(setOrders);
  }, [fetchOrders]);

  const columns = [
    { key: 'id', label: 'Order ID', render: (val) => val.substring(0, 8) },
    { key: 'student', label: 'Customer', render: (val) => val?.user?.full_name || 'Unknown' },
    { key: 'amount', label: 'Total', render: (val) => `${val}€` },
    { key: 'status', label: 'Status', render: (val) => (
      <Badge className={val === 'succeeded' ? 'bg-green-500' : 'bg-yellow-500'}>{val}</Badge>
    )},
    { key: 'created_at', label: 'Date', render: (val) => new Date(val).toLocaleDateString() }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Orders Management</h2>
      <DataTable columns={columns} data={orders} searchFields={['id', 'status']} />
    </div>
  );
};

// --- Customers Tab ---
export const CustomersTab = () => {
  const { fetchCustomers } = useAdminData();
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchCustomers().then(setCustomers);
  }, [fetchCustomers]);

  const columns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (val) => <Badge variant="outline">{val}</Badge> },
    { key: 'created_at', label: 'Joined', render: (val) => new Date(val).toLocaleDateString() }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Customers</h2>
      <DataTable columns={columns} data={customers} searchFields={['full_name', 'email']} />
    </div>
  );
};

// --- Users Tab ---
export const UsersTab = () => {
  const { fetchUsers, updateUser } = useAdminData();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, [fetchUsers]);

  const columns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (val) => <Badge className="capitalize">{val}</Badge> },
    { key: 'last_login', label: 'Last Login', render: (val) => val ? new Date(val).toLocaleDateString() : 'Never' }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">User Management</h2>
      <DataTable 
        columns={columns} 
        data={users} 
        searchFields={['full_name', 'email']}
        onEdit={(user) => console.log('Edit user', user)}
      />
    </div>
  );
};

// --- Logs Tab ---
export const LogsActivitiesTab = () => {
  const { fetchAuditLogs } = useAdminData();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchAuditLogs().then(setLogs);
  }, [fetchAuditLogs]);

  const columns = [
    { key: 'action', label: 'Action', render: (val) => <span className="font-mono text-xs">{val}</span> },
    { key: 'entity_type', label: 'Entity' },
    { key: 'ip_address', label: 'IP Address' },
    { key: 'created_at', label: 'Time', render: (val) => new Date(val).toLocaleString() }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">System Logs</h2>
      <DataTable columns={columns} data={logs} searchFields={['action', 'entity_type']} />
    </div>
  );
};