import React from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const COLORS = ['#D4AF37', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7'];

export const SimpleLineChart = ({ data, xKey, dataKey, color = "#D4AF37" }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
      <XAxis dataKey={xKey} stroke="#9ca3af" />
      <YAxis stroke="#9ca3af" />
      <Tooltip
        contentStyle={{
          backgroundColor: '#192734',
          border: '1px solid #ffffff20',
          color: '#fff',
        }}
        labelStyle={{ color: '#e5e7eb' }}
      />
      <Legend wrapperStyle={{ color: '#e5e7eb', fontSize: 12 }} />
      <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} activeDot={{ r: 8 }} />
    </LineChart>
  </ResponsiveContainer>
);

export const SimpleBarChart = ({ data, xKey, dataKey, color = "#0088FE" }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
      <XAxis dataKey={xKey} stroke="#9ca3af" />
      <YAxis stroke="#9ca3af" />
      <Tooltip
        contentStyle={{
          backgroundColor: '#192734',
          border: '1px solid #ffffff20',
          color: '#fff',
        }}
        labelStyle={{ color: '#e5e7eb' }}
      />
      <Legend wrapperStyle={{ color: '#e5e7eb', fontSize: 12 }} />
      <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export const SimplePieChart = ({ data, nameKey, dataKey }) => (
  <ResponsiveContainer width="100%" height={300}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={60}
        outerRadius={80}
        paddingAngle={5}
        dataKey={dataKey}
        nameKey={nameKey}
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={{
          backgroundColor: '#192734',
          border: '1px solid #ffffff20',
          color: '#fff',
        }}
        labelStyle={{ color: '#e5e7eb' }}
      />
      <Legend wrapperStyle={{ color: '#e5e7eb', fontSize: 12 }} />
    </PieChart>
  </ResponsiveContainer>
);

export const SimpleAreaChart = ({ data, xKey, dataKey, color = "#00C49F" }) => (
   <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
         <defs>
            <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
               <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
               <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
         </defs>
         <XAxis dataKey={xKey} stroke="#9ca3af" />
         <YAxis stroke="#9ca3af" />
         <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
         <Tooltip
           contentStyle={{
             backgroundColor: '#192734',
             border: '1px solid #ffffff20',
             color: '#fff',
           }}
           labelStyle={{ color: '#e5e7eb' }}
         />
         <Area type="monotone" dataKey={dataKey} stroke={color} fillOpacity={1} fill={`url(#color${dataKey})`} />
      </AreaChart>
   </ResponsiveContainer>
);