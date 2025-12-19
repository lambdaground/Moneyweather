import { useState } from 'react';
import DetailModal from '../DetailModal';
import { Button } from '@/components/ui/button';
import type { AssetData } from '@/lib/marketData';

const mockAsset: AssetData = {
  id: 'bitcoin',
  name: '비트코인',
  price: 98500,
  priceDisplay: '$98,500',
  change: 4.2,
  status: 'thunder',
  message: '롤러코스터 출발합니다! 꽉 잡으세요!',
  advice: '비트코인은 변동성이 매우 커요. 잃어도 괜찮은 금액만 투자하고, 장기 관점으로 바라보세요.',
};

export default function DetailModalExample() {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>모달 열기</Button>
      <DetailModal 
        asset={mockAsset} 
        open={open} 
        onClose={() => setOpen(false)} 
      />
    </div>
  );
}
