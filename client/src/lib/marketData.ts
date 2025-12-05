export type WeatherStatus = 'sunny' | 'rainy' | 'cloudy' | 'thunder';

export type AssetType = 'usdkrw' | 'kospi' | 'gold' | 'bitcoin' | 'bonds';

export interface AssetData {
  id: AssetType;
  name: string;
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
