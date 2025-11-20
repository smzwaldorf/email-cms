/**
 * StatsCard - Reusable statistics card component
 */

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: string;
  loading?: boolean;
}

export function StatsCard({ title, value, icon, loading = false }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-waldorf-sage/20 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-waldorf-clay mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-16 bg-waldorf-sage/20 animate-pulse rounded"></div>
          ) : (
            <p className="text-3xl font-bold text-waldorf-brown">{value}</p>
          )}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}
