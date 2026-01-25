import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Clock, Info } from 'lucide-react';
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
import { formatTime, formatTimeAgo } from '@/lib/marketData';
import type { AssetData, MarketDataResponse, AssetCategory, WeatherStatus } from '@/lib/marketData';

const CARD_ORDER_KEY = 'moneyweather_card_order';
const allCats: AssetCategory[] = ['currency', 'index', 'commodity', 'crypto', 'bonds'];
const allWeathers: WeatherStatus[] = ['sunny', 'cloudy', 'rainy', 'thunder'];

// 1. 카테고리 한국어 명칭 매핑
const CATEGORY_NAME_MAP: Record<AssetCategory, string> = {
  currency: '환율',
  index: '지수',
  commodity: '원자재',
  crypto: '가상화폐',
  bonds: '채권'
};

// 2. 자산별 상세 설정 통합 (이름, 조언, 출처, 기준 시점)
const ASSET_CONFIGS: Record<string, { name: string; advice: string; cat: AssetCategory; source: string; timeBasis: string; messages: Record<WeatherStatus, string> }> = {
  usdkrw: { 
    name: '달러/원 환율', cat: 'currency', source: 'ExchangeRate-API', timeBasis: '전일 종가',
    advice: '환율이 높을 땐 수출 기업 주식이 좋을 수 있어요!',
    messages: { sunny: '달러가 저렴해요.', rainy: '달러가 비싸요.', cloudy: '잠잠하네요.', thunder: '요동쳐요!' }
  },
  jpykrw: { 
    name: '엔/원 환율', cat: 'currency', source: 'ExchangeRate-API', timeBasis: '실시간',
    advice: '엔화가 저렴할 때 일본 여행이나 일본 상품 구매를 고려해보세요.',
    messages: { sunny: '엔화가 싸요!', rainy: '엔화가 비싸졌어요.', cloudy: '안정적이에요.', thunder: '급변하고 있어요!' }
  },
  eurkrw: { 
    name: '유로/원 환율', cat: 'currency', source: 'ExchangeRate-API', timeBasis: '실시간',
    advice: '유럽 직구나 여행 계획이 있다면 환율을 체크하세요.',
    messages: { sunny: '유로가 저렴해요.', rainy: '유로가 비싸요.', cloudy: '안정적이에요.', thunder: '급변하고 있어요!' }
  },
  kospi: { 
    name: '코스피 지수', cat: 'index', source: 'Yahoo Finance', timeBasis: '장 마감',
    advice: '국내 대형주 중심 지수예요.',
    messages: { sunny: '코스피 상승 중!', rainy: '코스피 하락 중.', cloudy: '조용하네요.', thunder: '변동성 주의!' }
  },
  kosdaq: { 
    name: '코스닥 지수', cat: 'index', source: 'Yahoo Finance', timeBasis: '장 마감',
    advice: '중소형주와 기술주 중심의 시장입니다.',
    messages: { sunny: '코스닥 활기차요!', rainy: '코스닥 약세.', cloudy: '조용하네요.', thunder: '요동치고 있어요!' }
  },
  gold: { 
    name: '국제 금 시세', cat: 'commodity', source: 'Yahoo Finance', timeBasis: '실시간',
    advice: '금은 경제가 불안할 때 가치가 오르는 대표적인 안전자산입니다.',
    messages: { sunny: '금값이 올랐어요!', rainy: '금값이 내렸어요.', cloudy: '안정적이에요.', thunder: '금값 요동 중!' }
  },
  bitcoin: { 
    name: '비트코인', cat: 'crypto', source: 'CoinGecko', timeBasis: '24시간 전',
    advice: '가장 대표적인 가상자산으로 변동성이 매우 큽니다.',
    messages: { sunny: '비트코인 상승!', rainy: '비트코인 하락.', cloudy: '횡보 중입니다.', thunder: '폭락/폭등 주의!' }
  },
  bonds: { 
    name: '미 국채 10년', cat: 'bonds', source: 'Yahoo Finance', timeBasis: '실시간',
    advice: '미국 국채 금리는 전 세계 금리의 기준이 됩니다.',
    messages: { sunny: '금리 상승세!', rainy: '금리 하락세.', cloudy: '안정적입니다.', thunder: '금리 급변동!' }
  },
  bokrate: { 
    name: '한국 기준금리', cat: 'bonds', source: '한국은행(ECOS)', timeBasis: '최근 발표',
    advice: '한국은행이 결정하는 정책 금리로 대출 금리에 직접 영향을 줍니다.',
    messages: { sunny: '금리가 올랐어요!', rainy: '금리가 내렸어요.', cloudy: '금리 동결 중.', thunder: '금리 전격 변동!' }
  }
  // 필요에 따라 나머지 자산들도 위 형식으로 추가하세요.
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

  // 데이터 로드 및 한국어 매핑 로직
  const { data, isLoading, isError } = useQuery<MarketDataResponse>({
    queryKey: ['/market-data.json'],
    queryFn: async () => {
      const res = await fetch('/market-data.json');
      if (!res.ok) throw new Error('로드 실패');
      const rawData = await res.json();

      const assets: AssetData[] = rawData.map((item: any) => {
        const id = item.category;
        const config = ASSET_CONFIGS[id] || { 
          name: id.toUpperCase(), 
          cat: 'index', 
          source: '알 수 없음', 
          timeBasis: '실시간',
          advice: '시장 상황을 확인하세요.', 
          messages: { sunny: '맑음', rainy: '비', cloudy: '흐림', thunder: '번개' } 
        };
        
        const price = item.payload?.price || 0;
        const change = item.payload?.change || 0;
        
        // 날씨 판정
        let status: WeatherStatus = 'cloudy';
        if (Math.abs(change) > 2.5) status = 'thunder';
        else if (change > 0.5) status = 'sunny';
        else if (change < -0.5) status = 'rainy';

        return {
          id,
          name: config.name,
          category: config.cat,
          categoryName: CATEGORY_NAME_MAP[config.cat], // 한국어 카테고리명 추가
          price: Number(price.toFixed(price > 100 ? 0 : 2)),
          change: Number(change.toFixed(2)),
          status,
          source: config.source,        // 데이터 출처
          timeBasis: config.timeBasis,  // 기준 시점
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

  const sortedAssets = useMemo(() => {
    if (cardOrder.length === 0) return allAssets;
    const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
    return [...allAssets].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  }, [allAssets, cardOrder]);

  const assets = sortedAssets.filter(asset => 
    selectedCategories.includes(asset.category) && selectedWeathers.includes(asset.status)
  );

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

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Header isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} onRefresh={() => window.location.reload()} isEditMode={isEditMode} onToggleEditMode={() => setIsEditMode(!isEditMode)} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {data?.generatedAt && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(data.generatedAt)} 기준 ({timeAgo})</span>
          </div>
        )}

        {/* 카테고리 필터 명칭도 한국어로 표시되도록 CATEGORY_NAME_MAP 활용 */}
        <div className="space-y-4">
          <CategoryFilter 
            selectedCategories={selectedCategories} 
            onToggleCategory={(c) => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} 
            onSelectAll={() => setSelectedCategories(allCats)} 
          />
          <WeatherFilter 
            selectedWeathers={selectedWeathers} 
            onToggleWeather={(w) => setSelectedWeathers(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} 
            onSelectAll={() => setSelectedWeathers(allWeathers)} 
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-44 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={handleDragEnd}>
            <SortableContext items={assets.map(a => a.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <SortableWeatherCard 
                    key={asset.id} 
                    asset={asset} 
                    onClick={() => { setSelectedAsset(asset); setIsModalOpen(true); }} 
                    isEditMode={isEditMode} 
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? <WeatherCard asset={sortedAssets.find(a => a.id === activeId)!} onClick={() => {}} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* 모달에 클릭 시 상세 코멘트 표시 */}
      <DetailModal asset={selectedAsset} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <footer className="py-8 text-center text-xs text-muted-foreground border-t">
        머니 웨더는 {data?.assets[0]?.source || '다양한 금융 API'}의 데이터를 바탕으로 제공됩니다.
      </footer>
    </div>
  );
}
