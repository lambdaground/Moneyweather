import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import SortableWeatherCard from '@/components/SortableWeatherCard';
import WeatherCard from '@/components/WeatherCard';
import DetailModal from '@/components/DetailModal';
import Header from '@/components/Header';
import CategoryFilter from '@/components/CategoryFilter';
import WeatherFilter from '@/components/WeatherFilter';
import { queryClient } from '@/lib/queryClient';
import type { AssetData, MarketDataResponse, AssetCategory, WeatherStatus } from '@/lib/marketData';
import { formatTime, formatTimeAgo } from '@/lib/marketData';

const CARD_ORDER_KEY = 'moneyweather_card_order';
const allCats: AssetCategory[] = ['currency', 'index', 'commodity', 'crypto', 'bonds'];
const allWeathers: WeatherStatus[] = ['sunny', 'cloudy', 'rainy', 'thunder'];

// --- [realMarketData.ts의 설정 정보 통합] ---
const ASSET_CONFIGS: Record<string, { name: string; advice: string; cat: AssetCategory; messages: Record<WeatherStatus, string> }> = {
  usdkrw: { 
    name: '미국 달러', cat: 'currency', 
    advice: '전일 마감 환율(종가) 기준이에요. 실시간 환율과 다를 수 있어요. 환율이 낮을 땐 해외여행이나 직구가 유리해요.',
    messages: { sunny: '해외직구 타이밍! 달러가 저렴해요.', rainy: '달러가 비싸요! 환전은 미루세요.', cloudy: '환율이 잠잠해요.', thunder: '환율이 요동치고 있어요!' }
  },
  jpykrw: { 
    name: '일본 엔화', cat: 'currency', 
    advice: '엔화가 저렴할 때 일본 여행이나 일본 상품 구매를 고려해보세요.',
    messages: { sunny: '일본 여행 찬스! 엔화가 싸요.', rainy: '엔화가 비싸졌어요.', cloudy: '엔화가 안정적이에요.', thunder: '엔화가 급변하고 있어요!' }
  },
  kospi: { 
    name: '코스피', cat: 'index', 
    advice: '국내 대형주 중심 지수예요. 시장이 하락할 때는 좋은 기업을 싸게 살 기회일 수 있어요.',
    messages: { sunny: '코스피가 올라가요! 활기차네요.', rainy: '코스피가 내려갔어요. 바겐세일 중?', cloudy: '코스피가 조용하네요.', thunder: '롤러코스터 주의보!' }
  },
  nasdaq: { 
    name: '나스닥', cat: 'index', 
    advice: '미국 기술주 중심 지수예요. 변동성이 크지만 성장 잠재력도 높아요.',
    messages: { sunny: '나스닥이 불타오르고 있어요!', rainy: '나스닥이 쉬어가는 중이에요.', cloudy: '나스닥이 조용하네요.', thunder: '기술주 주의보!' }
  },
  bitcoin: { 
    name: '비트코인', cat: 'crypto', 
    advice: '변동성이 매우 커요. 잃어도 괜찮은 금액만 투자하고 장기 관점으로 바라보세요.',
    messages: { sunny: '비트코인이 달리고 있어요!', rainy: '비트코인이 쉬어가는 중.', cloudy: '비트코인이 조용하네요.', thunder: '꽉 잡으세요! 롤러코스터!' }
  },
  gasoline: { 
    name: '휘발유', cat: 'commodity', 
    advice: '기름값이 오를 때는 급출발, 급가속을 피하면 연비가 10%까지 좋아져요!',
    messages: { sunny: '휘발유가 저렴해요! 주유 타이밍.', rainy: '휘발유가 비싸요. 대중교통 추천!', cloudy: '가격이 평균이에요.', thunder: '유가가 급변하고 있어요!' }
  },
  kbrealestate: { 
    name: '강남 아파트', cat: 'commodity', 
    advice: '서울 아파트 시장의 바로미터예요. 금리 인상기에는 집값이 조정되는 경향이 있어요.',
    messages: { sunny: '집값이 오르고 있어요!', rainy: '집값이 조정 중이에요.', cloudy: '가격이 안정적이에요.', thunder: '크게 움직이고 있어요!' }
  },
  bokrate: { 
    name: '한국 기준금리', cat: 'bonds', 
    advice: '금리가 오르면 대출 이자가 늘어나고, 예금 이자도 올라요.',
    messages: { sunny: '금리가 올랐어요!', rainy: '금리가 내렸어요.', cloudy: '금리가 동결됐어요.', thunder: '금리가 급변했어요!' }
  }
};

// 날씨 판정 로직
const calculateStatus = (id: string, price: number, change: number): WeatherStatus => {
  if (id === 'usdkrw') return price > 1400 ? 'rainy' : price < 1350 ? 'sunny' : 'cloudy';
  if (Math.abs(change) > 2.5) return 'thunder';
  if (change > 0.5) return 'sunny';
  if (change < -0.5) return 'rainy';
  return 'cloudy';
};

export default function Dashboard() {
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<AssetCategory[]>(allCats);
  const [selectedWeathers, setSelectedWeathers] = useState<WeatherStatus[]>(allWeathers);
  const [timeAgo, setTimeAgo] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 1. JSON 데이터 Fetch 및 변환
  const { data, isLoading, isError } = useQuery<MarketDataResponse>({
    queryKey: ['/market-data.json'],
    queryFn: async () => {
      const res = await fetch('/market-data.json');
      if (!res.ok) throw new Error('로드 실패');
      const rawData = await res.json();

      const assets: AssetData[] = rawData.map((item: any) => {
        const id = item.category;
        const config = ASSET_CONFIGS[id] || { name: id.toUpperCase(), cat: 'index', advice: '시장 상황을 확인하세요.', messages: { sunny: '맑음', rainy: '비', cloudy: '흐림', thunder: '번개' } };
        
        const price = item.payload?.price || 0;
        const change = item.payload?.change || 0;
        const status = calculateStatus(id, price, change);

        return {
          id,
          name: config.name,
          category: config.cat,
          price: Number(price.toFixed(price > 100 ? 0 : 2)),
          change: Number(change.toFixed(2)),
          status,
          message: config.messages[status],
          advice: config.advice,
          unit: id.includes('krw') || id.includes('gasoline') ? '원' : ''
        };
      });

      return { assets, generatedAt: rawData[0]?.updated_at || new Date().toISOString() };
    },
    refetchInterval: isEditMode ? false : 300000,
  });

  const allAssets = data?.assets || [];

  // 2. 정렬 및 필터링
  const sortedAssets = useMemo(() => {
    if (cardOrder.length === 0) return allAssets;
    const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
    return [...allAssets].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  }, [allAssets, cardOrder]);

  const assets = sortedAssets.filter(asset => 
    selectedCategories.includes(asset.category) && selectedWeathers.includes(asset.status)
  );

  // 3. 상태 관리 Effect
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    setIsDark(savedTheme === 'dark');
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    const savedOrder = localStorage.getItem(CARD_ORDER_KEY);
    if (savedOrder) setCardOrder(JSON.parse(savedOrder));
  }, []);

  useEffect(() => {
    if (data?.generatedAt) {
      const update = () => setTimeAgo(formatTimeAgo(data.generatedAt));
      update();
      const interval = setInterval(update, 10000);
      return () => clearInterval(interval);
    }
  }, [data?.generatedAt]);

  // 4. 핸들러 함수
  const handleToggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const currentIds = sortedAssets.map(a => a.id);
      const newOrder = arrayMove(currentIds, currentIds.indexOf(String(active.id)), currentIds.indexOf(String(over.id)));
      setCardOrder(newOrder);
      localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder));
    }
    setActiveId(null);
  };

  const getSummaryMessage = () => {
    const sunnyCount = allAssets.filter(a => a.status === 'sunny').length;
    if (sunnyCount >= 3) return '오늘은 좋은 날이에요! 투자하기 괜찮은 분위기네요. ☀️';
    if (allAssets.some(a => a.status === 'thunder')) return '시장이 불안정해요. 신중하게 결정하세요! ⛈️';
    return '시장이 혼조세예요. 관심 있는 자산을 살펴보세요! ⛅';
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Header isDark={isDark} onToggleTheme={handleToggleTheme} onRefresh={() => window.location.reload()} isEditMode={isEditMode} onToggleEditMode={() => setIsEditMode(!isEditMode)} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {data?.generatedAt && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(data.generatedAt)} 기준 ({timeAgo})</span>
          </div>
        )}

        <CategoryFilter selectedCategories={selectedCategories} onToggleCategory={(c) => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} onSelectAll={() => setSelectedCategories(allCats)} />
        <WeatherFilter selectedWeathers={selectedWeathers} onToggleWeather={(w) => setSelectedWeathers(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} onSelectAll={() => setSelectedWeathers(allWeathers)} />

        <p className="text-center font-medium">{getSummaryMessage()}</p>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={handleDragEnd}>
            <SortableContext items={assets.map(a => a.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <SortableWeatherCard key={asset.id} asset={asset} onClick={() => { setSelectedAsset(asset); setIsModalOpen(true); }} isEditMode={isEditMode} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? <WeatherCard asset={sortedAssets.find(a => a.id === activeId)!} onClick={() => {}} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <DetailModal asset={selectedAsset} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <footer className="py-8 text-center text-xs text-muted-foreground border-t">머니 웨더는 정보 제공 서비스입니다. 투자 결정은 신중하게 하세요.</footer>
    </div>
  );
}
