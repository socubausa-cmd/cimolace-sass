import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RecentOrdersTable = () => {
  const orders = [
    { id: '#ORD-001', customer: 'Alice Freeman', amount: '$120.50', status: 'completed', date: '2023-10-15' },
    { id: '#ORD-002', customer: 'Bob Smith', amount: '$85.00', status: 'pending', date: '2023-10-14' },
    { id: '#ORD-003', customer: 'Charlie Brown', amount: '$245.00', status: 'completed', date: '2023-10-14' },
    { id: '#ORD-004', customer: 'Diana Ross', amount: '$54.20', status: 'cancelled', date: '2023-10-13' },
    { id: '#ORD-005', customer: 'Evan Wright', amount: '$1,025.00', status: 'completed', date: '2023-10-12' },
    { id: '#ORD-006', customer: 'Fiona Green', amount: '$35.00', status: 'pending', date: '2023-10-12' },
    { id: '#ORD-007', customer: 'George Hill', amount: '$420.00', status: 'completed', date: '2023-10-11' },
    { id: '#ORD-008', customer: 'Hannah Mont', amount: '$15.00', status: 'cancelled', date: '2023-10-10' },
  ];

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed': return <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">Completed</Badge>;
      case 'pending': return <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">Pending</Badge>;
      case 'cancelled': return <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">Cancelled</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card className="border-none shadow-lg bg-[#192734]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Recent Orders</CardTitle>
        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">View All</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-sm text-gray-400 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((order, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors group cursor-pointer">
                  <td className="px-6 py-4 font-medium text-white">{order.id}</td>
                  <td className="px-6 py-4 text-gray-300">{order.customer}</td>
                  <td className="px-6 py-4 text-gray-400">{order.date}</td>
                  <td className="px-6 py-4 text-white font-bold">{order.amount}</td>
                  <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentOrdersTable;