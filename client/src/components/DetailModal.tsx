import { Stethoscope, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        data-testid="modal-asset-detail"
        className="sm:max-w-md"
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span 
              data-testid="text-modal-price"
              className="text-2xl font-bold text-foreground"
            >
              {asset.priceDisplay}
            </span>
            <Badge
              data-testid="badge-modal-change"
              variant="secondary"
              className={`${
                isPositive 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
              }`}
            >
              {isPositive ? '+' : ''}{asset.change}%
            </Badge>
          </div>

          <p 
            data-testid="text-modal-message"
            className="text-lg text-foreground font-medium"
          >
            {asset.message}
          </p>

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
