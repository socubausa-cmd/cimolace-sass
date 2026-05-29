import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

const CustomersTable = () => {
  const customers = [
    { name: 'Alice Freeman', email: 'alice@example.com', orders: 12, spent: '$1,200', joinDate: 'Jan 2023' },
    { name: 'Bob Smith', email: 'bob@example.com', orders: 5, spent: '$450', joinDate: 'Feb 2023' },
    { name: 'Charlie Brown', email: 'charlie@example.com', orders: 24, spent: '$3,500', joinDate: 'Dec 2022' },
    { name: 'Diana Ross', email: 'diana@example.com', orders: 1, spent: '$54', joinDate: 'Oct 2023' },
    { name: 'Evan Wright', email: 'evan@example.com', orders: 8, spent: '$890', joinDate: 'Mar 2023' },
    { name: 'Fiona Green', email: 'fiona@example.com', orders: 15, spent: '$1,650', joinDate: 'Apr 2023' },
    { name: 'George Hill', email: 'george@example.com', orders: 3, spent: '$210', joinDate: 'Jun 2023' },
  ];

  return (
    <Card className="border-none shadow-lg bg-[#192734]">
      <CardHeader>
        <CardTitle className="text-white">Top Customers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-sm text-gray-400 uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Total Orders</th>
                <th className="px-6 py-4">Total Spent</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {customers.map((customer, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-white/10">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-bold text-xs">
                          {customer.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-white">{customer.name}</div>
                        <div className="text-sm text-gray-400">{customer.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{customer.orders}</td>
                  <td className="px-6 py-4 text-emerald-400 font-bold">{customer.spent}</td>
                  <td className="px-6 py-4 text-gray-400">{customer.joinDate}</td>
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

export default CustomersTable;