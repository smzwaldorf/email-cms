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

const CustomDot = (props: any) => {
    const { cx, cy, value, data, dataKey, color } = props;
    
    if (!data || data.length === 0) return null;

    const values = data.map((d: any) => d[dataKey]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const isMax = value === max;
    const isMin = value === min;
    
    if (isMax) {
        // Larger Filled Dot for Max
        return (
            <circle cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />
        );
    }
    
    if (isMin) {
         // Hollow Dot for Min
         return (
            <circle cx={cx} cy={cy} r={5} fill="white" stroke={color} strokeWidth={2} />
        );
    }

    // Standard Dot
    return (
        <circle cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1} />
    );
};

export const TrendChart: React.FC<TrendChartProps> = ({ data, title = 'Engagement Trends', height = 300 }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-brand-neutral-100">
      <h3 className="text-lg font-semibold text-brand-neutral-800 mb-6">{title}</h3>
      <div style={{ width: '100%', height, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
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
              dot={(props) => <CustomDot {...props} data={data} dataKey="openRate" color="#8B5CF6" />}
              activeDot={{ r: 6 }} 
            />
            <Line 
              type="monotone" 
              dataKey="clickRate" 
              name="Click Rate" 
              stroke="#10B981" 
              strokeWidth={3} 
              dot={(props) => <CustomDot {...props} data={data} dataKey="clickRate" color="#10B981" />}
              activeDot={{ r: 6 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
