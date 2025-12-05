import { Sun, CloudRain, Cloud, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AssetData, WeatherStatus } from '@/lib/marketData';

interface WeatherCardProps {
  asset: AssetData;
  onClick: () => void;
}

const weatherStyles: Record<WeatherStatus, { bg: string; border: string; iconBg: string }> = {
  sunny: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
  },
  rainy: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-700',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
  },
  cloudy: {
    bg: 'bg-gray-50 dark:bg-gray-900/50',
    border: 'border-gray-200 dark:border-gray-700',
    iconBg: 'bg-gray-100 dark:bg-gray-800',
  },
  thunder: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
  },
};

const WeatherIcon = ({ status, className }: { status: WeatherStatus; className?: string }) => {
  const iconProps = { className: className || 'w-12 h-12' };
  
  switch (status) {
    case 'sunny':
      return <Sun {...iconProps} className={`${iconProps.className} text-orange-500 dark:text-orange-400`} />;
    case 'rainy':
      return <CloudRain {...iconProps} className={`${iconProps.className} text-slate-500 dark:text-slate-400`} />;
    case 'cloudy':
      return <Cloud {...iconProps} className={`${iconProps.className} text-gray-500 dark:text-gray-400`} />;
    case 'thunder':
      return <Zap {...iconProps} className={`${iconProps.className} text-purple-500 dark:text-purple-400`} />;
  }
};

export default function WeatherCard({ asset, onClick }: WeatherCardProps) {
  const styles = weatherStyles[asset.status];
  const isPositive = asset.change >= 0;

  return (
    <Card
      data-testid={`card-asset-${asset.id}`}
      className={`${styles.bg} ${styles.border} border cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]`}
      onClick={onClick}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 
              data-testid={`text-asset-name-${asset.id}`}
              className="font-semibold text-foreground truncate"
            >
              {asset.name}
            </h3>
            <p 
              data-testid={`text-asset-price-${asset.id}`}
              className="text-lg font-bold text-foreground mt-0.5"
            >
              {asset.priceDisplay}
            </p>
            {asset.buyPriceDisplay && asset.sellPriceDisplay && (
              <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                <span data-testid={`text-buy-price-${asset.id}`}>
                  살 때 <span className="font-medium text-red-600 dark:text-red-400">{asset.sellPriceDisplay}</span>
                </span>
                <span data-testid={`text-sell-price-${asset.id}`}>
                  팔 때 <span className="font-medium text-green-600 dark:text-green-400">{asset.buyPriceDisplay}</span>
                </span>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg ${styles.iconBg}`}>
            <WeatherIcon status={asset.status} className="w-8 h-8" />
          </div>
        </div>

        <p 
          data-testid={`text-asset-message-${asset.id}`}
          className="text-base font-medium text-foreground leading-relaxed"
        >
          {asset.message}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            data-testid={`badge-change-${asset.id}`}
            variant="secondary"
            className={`text-sm ${
              isPositive 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' 
                : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
            }`}
          >
            <span className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {isPositive ? '+' : ''}{asset.change}%
            </span>
          </Badge>
          <Badge
            data-testid={`badge-change-points-${asset.id}`}
            variant="outline"
            className={`text-sm ${
              isPositive 
                ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300' 
                : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300'
            }`}
          >
            {asset.changePointsDisplay}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

export { WeatherIcon };
