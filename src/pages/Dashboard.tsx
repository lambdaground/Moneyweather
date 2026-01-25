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

// 1. 자산별 이름 및 단위 매핑 정보
const ASSET_CONFIG: Record<string, { name: string; unit: string; cat: AssetCategory }> = {
  usdkrw: { name: '달러/원 환율', unit: '원', cat: 'currency' },
  jpykrw: { name: '엔/원 환율', unit: '원', cat: 'currency' },
  eurkrw: { name: '유로/원 환율', unit: '원', cat: 'currency' },
  kospi: { name: '코스피 지수', unit: '', cat: 'index' },
  kosdaq: { name: '코스닥 지수', unit: '', cat: 'index' },
  nasdaq: { name: '나스닥 지수', unit: '', cat: 'index' },
  dowjones: { name: '다우존스 지수', unit: '', cat: 'index' },
  sp500: { name: 'S&P 500', unit: '', cat: 'index' },
  gold: { name: '국제 금 시세', unit: '달러', cat: 'commodity' },
  silver: { name: '국제 은 시세', unit: '달러', cat: 'commodity' },
  gasoline: { name: '국내 휘발유', unit: '원', cat: 'commodity' },
  diesel: { name: '국내 경유', unit: '원', cat: 'commodity' },
  bitcoin: { name: '비트코인', unit: '원', cat: 'crypto' },
  ethereum: { name: '이더리움', unit: '원', cat: 'crypto' },
  kbrealestate: { name: '전국 주택지수', unit: '', cat: 'index' },
  bokrate: { name: '한국은행 금리', unit: '%', cat: 'bonds' },
  bonds: { name: '미 국채 10년', unit: '%', cat: 'bonds' },
  bonds2y: { name: '미 국채 2년', unit: '%', cat: 'bonds' },
  krbond3y: { name: '국고채 3년', unit: '%', cat: 'bonds' },
  krbond10y: { name: '국고채 10년', unit: '%', cat: 'bonds' },
  cpi: { name: '소비자물가지수', unit: '', cat: 'index' },
  ppi: { name: '생산자물가지수', unit: '', cat: 'index' },
  ccsi: { name: '소비자심리지수', unit: '', cat: 'index' },
};

// 2. 변동률에 따른 날씨 결정 로직
const getWeatherStatus = (change: number): WeatherStatus => {
  if (change > 1.5) return 'sunny';
  if (change >= 0) return 'cloudy';
  if (change > -1.5) return 'rainy';
  return 'thunder';
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

  // 3. 데이터 로드 및 형식 변환 (기존 기능 복구 핵심)
  const { data, isLoading, isError } = useQuery<MarketDataResponse>({
    queryKey: ['/market-data.json'],
    queryFn: async () => {
      const res = await fetch('/market-data.json');
      if (!res.ok) throw new Error('데이터 로드 실패');
      const rawData = await res.json();

      const assets: AssetData[] = rawData.map((item: any) => {
        const config = ASSET_CONFIG[item.category];
        const rawPrice = item.payload?.price || 0;
        const rawChange = item.payload?.change || 0;

        return {
          id: item.category,
          category: config?.cat || 'index',
          name: config?.name || item.category.toUpperCase(),
          // 가격 포맷팅: 소수점 오차 제거
          price: Number(rawPrice.toFixed(rawPrice > 100 ? 0 : 2)),
          // 변동률 포맷팅: 소수점 2자리 고정
          change: Number(rawChange.toFixed(2)),
          status: getWeatherStatus(rawChange),
          unit: config?.unit || '',
        };
      });

      return {
        assets,
        generatedAt: rawData[0]?.updated_at || new Date().toISOString(),
      };
    },
    refetchInterval: isEditMode ? false : 300000, 
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      window.location.reload();
      return {};
    },
  });

  const allAssets = data?.assets || [];

  const sortedAssets = useMemo(() => {
    if (cardOrder.length === 0) return allAssets;
    const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
    return [...allAssets].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  }, [allAssets, cardOrder]);

  const assets = sortedAssets.filter(asset => 
    selectedCategories.includes(asset.category) && 
    selectedWeathers.includes(asset.status)
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);

    const savedOrder = localStorage.getItem(CARD_ORDER_KEY);
    if (savedOrder) {
      try { setCardOrder(JSON.parse(savedOrder)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (data?.generatedAt) {
      setTimeAgo(formatTimeAgo(data.generatedAt));
      const interval = setInterval(() => setTimeAgo(formatTimeAgo(data.generatedAt)), 10000);
      return () => clearInterval(interval);
    }
  }, [data?.generatedAt]);

  const handleToggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  const handleToggleCategory = (category: AssetCategory) => {
    setSelectedCategories(prev => prev.length === 1 && prev[0] === category ? allCats : [category]);
  };
  
  const handleSelectAllCategories = () => setSelectedCategories(allCats);

  const handleToggleWeather = (weather: WeatherStatus) => {
    setSelectedWeathers(prev => prev.length === 1 && prev[0] === weather ? allWeathers : [weather]);
  };

  const handleSelectAllWeathers = () => setSelectedWeathers(allWeathers);
  const handleCardClick = (asset: AssetData) => { setSelectedAsset(asset); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setTimeout(() => setSelectedAsset(null), 200); };
  const handleRefresh = () => refreshMutation.mutate();
  const handleToggleEditMode = () => { setIsEditMode(prev => !prev); setActiveId(null); };
  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const currentIds = sortedAssets.map(a => a.id);
      const oldIndex = currentIds.indexOf(String(active.id));
      const newIndex = currentIds.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentIds, oldIndex, newIndex);
        setCardOrder(newOrder);
        localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder));
      }
    }
  };

  const activeAsset = activeId ? sortedAssets.find(a => a.id === activeId) : null;

  // 4. 시장 요약 코멘트 로직
  const getSummaryMessage = () => {
    if (allAssets.length === 0) return '';
    const sunnyCount = allAssets.filter(a => a.status === 'sunny').length;
    const thunderCount = allAssets.filter(a => a.status === 'thunder').length;
    
    if (thunderCount >= 2) return '오늘은 시장이 불안정해요. 신중하게 결정하세요! ⛈️';
    if (sunnyCount >= 3) return '오늘은 좋은 날이에요! 투자하기 괜찮은 분위기네요. ☀️';
    if (sunnyCount === 0) return '오늘은 조용히 관망하는 게 좋겠어요. ☁️';
    return '시장이 혼조세예요. 관심 있는 자산을 살펴보세요! ⛅';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onRefresh={handleRefresh}
        isRefreshing={refreshMutation.isPending}
        isEditMode={isEditMode}
        onToggleEditMode={handleToggleEditMode}
      />

      <main className="container mx-auto px-4 py-6 space-y-4">
        {data?.generatedAt && (
          <div data-testid="text-timestamp" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(data.generatedAt)} 기준 ({timeAgo})</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-center"><span className="text-xs text-muted-foreground">카테고리</span></div>
          <CategoryFilter selectedCategories={selectedCategories} onToggleCategory={handleToggleCategory} onSelectAll={handleSelectAllCategories} />
        </div>

        <div className="space-y-3">
          <div className="text-center"><span className="text-xs text-muted-foreground">날씨 상태</span></div>
          <WeatherFilter selectedWeathers={selectedWeathers} onToggleWeather={handleToggleWeather} onSelectAll={handleSelectAllWeathers} />
        </div>

        {allAssets.length > 0 && (
          <p data-testid="text-summary" className="text-center text-muted-foreground pt-2">
            {getSummaryMessage()}
          </p>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-destructive">데이터를 불러오는 데 실패했어요. 10분 뒤에 다시 확인해보세요.</p>
          </div>
        )}

        {!isLoading && !isError && assets.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={assets.map(a => a.id)} strategy={rectSortingStrategy}>
              {isEditMode && <p className="text-center text-sm text-muted-foreground pb-2">카드를 드래그해서 순서를 변경하세요</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <SortableWeatherCard key={asset.id} asset={asset} onClick={() => handleCardClick(asset)} isEditMode={isEditMode} isDragging={activeId === asset.id} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeAsset ? <WeatherCard asset={activeAsset} onClick={() => {}} /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {!isLoading && !isError && assets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">선택한 조건에 맞는 자산이 없어요.</p>
          </div>
        )}
      </main>

      <DetailModal asset={selectedAsset} open={isModalOpen} onClose={handleCloseModal} />

      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p data-testid="text-footer" className="text-center text-xs text-muted-foreground">
            머니 웨더는 금융 초보자를 위한 정보 제공 서비스입니다. 투자 결정은 신중하게 하세요.
          </p>
        </div>
      </footer>
    </div>
  );
}
