import React from 'react';
import type { DotItemDotProps } from 'recharts';
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
  uniqueOpenCount?: number | null;
  uniqueClickCount?: number | null;
}

interface TrendChartProps {
  data: TrendData[];
  title?: string;
  height?: number;
  tracker?: 'resend' | 'cms';
}

type TrendDotProps = DotItemDotProps & {
  data?: TrendData[];
  dataKey?: keyof TrendData;
  color?: string;
};

const CustomDot = (props: TrendDotProps) => {
    const { cx, cy, value, data = [], dataKey, color } = props;

    if (value == null || !data.length || dataKey === undefined || color === undefined) return null;

    const values = data.map((d) => d[dataKey as keyof TrendData]).filter((value): value is number => typeof value === 'number');
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

export const TrendChart: React.FC<TrendChartProps> = ({ data, title = '互動趨勢', height = 300, tracker = 'resend' }) => {
  const hasCounts = data.some(point => point.uniqueOpenCount != null || point.uniqueClickCount != null);
  if (!hasCounts) {
    return (
      <div role="status" className="flex flex-col items-center justify-center text-center text-brand-neutral-500 p-6" style={{ minHeight: height }}>
        <p className="font-medium">尚無互動趨勢資料</p>
        <p className="text-sm mt-2">{data.length === 0
          ? '此篩選條件沒有可用的電子報。'
          : tracker === 'resend'
            ? 'Resend 指標需要送達確認。可切換至 CMS 追蹤查看現有電子郵件互動資料。'
            : 'CMS 指標需要成功寄送的收件人資料。此篩選條件沒有可用數據。'}</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-brand-neutral-100">
      <h3 className="text-lg font-semibold text-brand-neutral-800 mb-6">{title}</h3>
      <p className="text-sm text-brand-neutral-500 mb-3">每期電子報按收件人去重，重複開啟與點擊各只計一次。</p>
      {data.some(point => point.uniqueOpenCount == null || point.uniqueClickCount == null) && (
        <p className="text-sm text-brand-neutral-500 mb-3">空缺表示所選追蹤來源的收件人數不可用。</p>
      )}
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
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line
              type="monotone"
              dataKey="uniqueOpenCount"
              name="Recipients who opened"
              stroke="#8B5CF6"
              strokeWidth={3}
              dot={(props) => <CustomDot {...props} data={data} dataKey="uniqueOpenCount" color="#8B5CF6" />}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="uniqueClickCount"
              name="Recipients who clicked"
              stroke="#10B981"
              strokeWidth={3}
              dot={(props) => <CustomDot {...props} data={data} dataKey="uniqueClickCount" color="#10B981" />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
