import { useState, useEffect } from 'react';
import { Sun, CloudRain, Cloud, Zap, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AssetData, WeatherStatus } from '@/lib/marketData';
import { getMarketStatusForAsset, type MarketStatusInfo } from '@/lib/marketStatus';

interface WeatherCardProps {
  asset: AssetData;
  onClick: () => void;
  isEditMode?: boolean; // 드래그 모드 대응
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
  const [marketStatus, setMarketStatus] = useState<MarketStatusInfo | null>(null);

  useEffect(() => {
    const status = getMarketStatusForAsset(asset.id);
    setMarketStatus(status);

    if (status) {
      const interval = setInterval(() => {
        setMarketStatus(getMarketStatusForAsset(asset.id));
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [asset.id]);

  return (
    <Card
      data-testid={`card-asset-${asset.id}`}
      className={`${styles.bg} ${styles.border} border cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]`}
      onClick={onClick}
    >
      <div className="p-4 space-y-4">
        {/* 상단: 이름 및 시장 상태 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-foreground truncate">
                {asset.name}
              </h3>
              {/* 카테고리 한국어 표기 (Dashboard에서 넘겨준 값 사용) */}
              <Badge variant="outline" className="text-[10px] opacity-70">
                {asset.categoryName || asset.category}
              </Badge>
            </div>
            
            {marketStatus && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                {marketStatus.status === 'open' ? (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                ) : null}
                {marketStatus.label} {marketStatus.nextOpenIn && `(${marketStatus.nextOpenIn})`}
              </p>
            )}
          </div>
          <div className={`p-1.5 rounded-lg ${styles.iconBg}`}>
            <WeatherIcon status={asset.status} className="w-7 h-7" />
          </div>
        </div>

        {/* 중단: 현재 가격 */}
        <div className="py-1">
          <p className="text-2xl font-black text-foreground tracking-tight">
            {asset.price.toLocaleString()}
            <span className="text-sm font-medium ml-1 opacity-70">{asset.unit}</span>
          </p>
        </div>

        {/* 하단: 변동 정보 및 출처 */}
        <div className="flex flex-col gap-2 pt-2 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <Badge
              className={`text-xs font-bold ${
                isPositive 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              }`}
            >
              <span className="flex items-center gap-1">
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}{asset.change}%
              </span>
            </Badge>
            
            <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {asset.changePointsDisplay}
            </span>
          </div>

          {/* 데이터 출처 및 기준 시점 (요청하신 사항 반영) */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              {asset.source}
            </span>
            <span>{asset.timeBasis} 기준</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export { WeatherIcon };
