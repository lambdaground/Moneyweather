import { Stethoscope, X, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { AssetData } from '@/lib/marketData';
import { WeatherIcon } from './WeatherCard';

interface DetailModalProps {
  asset: AssetData | null;
  open: boolean;
  onClose: () => void;
}

export default function DetailModal({ asset, open, onClose }: DetailModalProps) {
  if (!asset) return null;

  const isPositive = asset.change >= 0;
  const hasChart = asset.chartData && asset.chartData.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        data-testid="modal-asset-detail"
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <WeatherIcon status={asset.status} className="w-10 h-10" />
              <DialogTitle 
                data-testid="text-modal-title"
                className="text-xl"
              >
                {asset.name}
              </DialogTitle>
            </div>
            <Button
              data-testid="button-close-modal"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <span 
              data-testid="text-modal-price"
              className="text-3xl font-bold text-foreground"
            >
              {asset.priceDisplay}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                data-testid="badge-modal-change"
                variant="secondary"
                className={`text-base ${
                  isPositive 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' 
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                }`}
              >
                <span className="flex items-center gap-1">
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {isPositive ? '+' : ''}{asset.change}%
                </span>
              </Badge>
              <Badge
                data-testid="badge-modal-change-points"
                variant="outline"
                className={`text-base ${
                  isPositive 
                    ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300' 
                    : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300'
                }`}
              >
                {asset.changePointsDisplay}
              </Badge>
            </div>
          </div>

          <p 
            data-testid="text-modal-message"
            className="text-lg text-foreground font-medium"
          >
            {asset.message}
          </p>

          {hasChart && (
            <div 
              data-testid="chart-price-history"
              className="bg-muted/30 rounded-lg p-3"
            >
              <p className="text-sm text-muted-foreground mb-2 font-medium">최근 5일 추이</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={asset.chartData}>
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString(), '가격']}
                      labelStyle={{ color: 'var(--foreground)' }}
                      contentStyle={{ 
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke={isPositive ? '#22c55e' : '#ef4444'}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Stethoscope className="w-5 h-5" />
              <span className="font-semibold">머니 박사의 조언</span>
            </div>
            <p 
              data-testid="text-modal-advice"
              className="text-sm text-muted-foreground leading-relaxed"
            >
              {asset.advice}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
