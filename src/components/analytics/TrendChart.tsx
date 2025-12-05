import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';

interface TrendData {
  name: string;
  openRate: number;
  clickRate: number;
}

interface TrendChartProps {
  data: TrendData[];
  title?: string;
  height?: number;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, title = 'Engagement Trends', height = 300 }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-brand-neutral-100">
      <h3 className="text-lg font-semibold text-brand-neutral-800 mb-6">{title}</h3>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              dx={-10}
              unit="%"
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line 
              type="monotone" 
              dataKey="openRate" 
              name="Open Rate" 
              stroke="#8B5CF6" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2, stroke: 'white' }} 
              activeDot={{ r: 6 }} 
            />
            <Line 
              type="monotone" 
              dataKey="clickRate" 
              name="Click Rate" 
              stroke="#10B981" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: 'white' }} 
              activeDot={{ r: 6 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
