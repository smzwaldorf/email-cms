import React from 'react';
import { ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import { CountUp } from '@/components/common/CountUp';

interface KPICardProps {
  title: string;
  value: string | number;
  animateValue?: number; // Raw number for animation
  suffix?: string;      // Suffix for animation
  loading?: boolean;
  trend?: number; // precentage change
  trendLabel?: string;
  tooltip?: string;
  icon?: React.ReactNode;
}

export const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  animateValue,
  suffix = '',
  loading = false,
  trend, 
  trendLabel = 'vs last week',
  tooltip,
  icon 
}) => {
  const isPositive = trend && trend >= 0;
  const isNeutral = trend === 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-brand-neutral-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-brand-neutral-500 flex items-center gap-1">
          {title}
          {tooltip && (
            <div className="group relative">
                <HelpCircle className="w-3 h-3 cursor-help text-brand-neutral-400" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded hidden group-hover:block z-10">
                    {tooltip}
                </div>
            </div>
          )}
        </h3>
        {icon && <div className="text-brand-neutral-400">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
            <div className="h-8 w-24 bg-brand-neutral-100 animate-pulse rounded"></div>
        ) : (
            <span className="text-3xl font-bold text-brand-neutral-800">
                {typeof animateValue === 'number' ? (
                    <CountUp end={animateValue} decimals={animateValue % 1 !== 0 ? 1 : 0} suffix={suffix} />
                ) : (
                    value
                )}
            </span>
        )}
      </div>

      {typeof trend === 'number' && (
        <div className="mt-2 flex items-center text-xs">
          <span 
            className={`flex items-center font-medium ${
              isPositive ? 'text-green-600' : isNeutral ? 'text-gray-500' : 'text-red-600'
            }`}
          >
            {isPositive ? <ArrowUp className="w-3 h-3 mr-0.5" /> : <ArrowDown className="w-3 h-3 mr-0.5" />}
            {Math.abs(trend)}%
          </span>
          <span className="text-brand-neutral-400 ml-1.5">{trendLabel}</span>
        </div>
      )}
    </div>
  );
};
