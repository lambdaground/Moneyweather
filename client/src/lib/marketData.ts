export type WeatherStatus = 'sunny' | 'rainy' | 'cloudy' | 'thunder';

export type AssetType = 
  | 'usdkrw' | 'jpykrw' | 'cnykrw' | 'eurkrw'
  | 'feargreed' | 'kospi' | 'kosdaq' | 'sp500'
  | 'gold' | 'silver' | 'gasoline' | 'diesel' | 'kbrealestate'
  | 'bitcoin' | 'ethereum'
  | 'bonds' | 'bonds2y';

export type AssetCategory = 'currency' | 'index' | 'commodity' | 'crypto' | 'bonds';

export interface AssetData {
  id: AssetType;
  name: string;
  category: AssetCategory;
  price: number;
  priceDisplay: string;
  change: number;
  status: WeatherStatus;
  message: string;
  advice: string;
}

export interface MarketDataResponse {
  assets: AssetData[];
  generatedAt: string;
}

export const assetCategories: Record<AssetCategory, { name: string; icon: string }> = {
  currency: { name: '환율', icon: 'Banknote' },
  index: { name: '주가지수', icon: 'TrendingUp' },
  commodity: { name: '원자재', icon: 'Gem' },
  crypto: { name: '암호화폐', icon: 'Bitcoin' },
  bonds: { name: '금리/채권', icon: 'Landmark' },
};

export const defaultAssets: AssetType[] = ['usdkrw', 'kospi', 'gold', 'bitcoin', 'bonds'];

export function getWeatherIcon(status: WeatherStatus): string {
  switch (status) {
    case 'sunny':
      return 'Sun';
    case 'rainy':
      return 'CloudRain';
    case 'cloudy':
      return 'Cloud';
    case 'thunder':
      return 'Zap';
  }
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 10) return '방금 전';
  if (diffSec < 60) return `${diffSec}초 전`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  
  return date.toLocaleDateString('ko-KR');
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}
