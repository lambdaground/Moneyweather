import WeatherCard from '../WeatherCard';
import type { AssetData } from '@/lib/marketData';

const mockAsset: AssetData = {
  id: 'usdkrw',
  name: '미국 달러',
  price: 1420,
  priceDisplay: '1,420 KRW',
  change: 1.25,
  status: 'rainy',
  message: '지금 여행가면 손해예요! 환전은 미루세요.',
  advice: '환율이 높을 땐 수출 기업 주식이 좋을 수 있어요!',
};

export default function WeatherCardExample() {
  return (
    <div className="max-w-sm">
      <WeatherCard 
        asset={mockAsset} 
        onClick={() => console.log('Card clicked:', mockAsset.name)} 
      />
    </div>
  );
}
