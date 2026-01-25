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

// 컴포넌트 및 라이브러리 임포트
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

// 한글 이름 매핑 객체
const nameMap: Record<string, string> = {
  usdkrw: '달러/원 환율',
  jpykrw: '엔/원 환율',
  eurkrw: '유로/원 환율',
  kospi: '코스피 지수',
  kosdaq: '코스닥 지수',
  nasdaq: '나스닥 지수',
  dowjones: '다우존스 지수',
  sp500: 'S&P 500',
  gold: '국제 금 시세',
  silver: '국제 은 시세',
  gasoline: '국내 휘발유',
  diesel: '국내 경유',
  bitcoin: '비트코인',
  ethereum: '이더리움',
  kbrealestate: '전국 주택지수',
  bokrate: '한국은행 금리',
  bonds: '미 국채 10년',
  bonds2y: '미 국채 2년',
  krbond3y: '국고채 3년',
  krbond10y: '국고채 10년',
  cpi: '소비자물가지수',
  ppi: '생산자물가지수',
  ccsi: '소비자심리지수'
};

// 수치 변화에 따른 날씨 결정 함수
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

  // 1. 데이터 페칭 로직 (JSON 파일 읽기)
  const { data, isLoading, isError } = useQuery<MarketDataResponse>({
    queryKey: ['/market-data.json'],
    queryFn: async () => {
      const res = await fetch('/market-data.json');
      if (!res.ok) throw new Error('데이터 로드 실패');
      
      const rawData = await res.json();

      // JSON 데이터를 UI용 AssetData 형식으로 변환
      const assets: AssetData[] = rawData.map((item: any) => {
        const cat = item.category;
        let type: AssetCategory = 'index';
        
        if (['usdkrw', 'jpykrw', 'eurkrw'].includes(cat)) type = 'currency';
        else if (['bitcoin', 'ethereum'].includes(cat)) type = 'crypto';
        else if (['gold', 'silver', 'gasoline', 'diesel'].includes(cat)) type = 'commodity';
        else if (cat.includes('bond') || cat === 'bokrate') type = 'bonds';

        const changeVal = item.payload?.change || 0;

        return {
          id: cat,
          category: type,
          name: nameMap[cat] || cat.toUpperCase(),
          price: item.payload?.price || 0,
          change: changeVal,
          status: getWeatherStatus(changeVal),
          unit: cat.includes('krw') || cat.includes('fuel') ? '원' : '',
        };
      });

      return {
        assets,
        generatedAt: rawData[0]?.updated_at || new Date().toISOString(),
      };
    },
    refetchInterval: isEditMode ? false : 300000, // 5분마다 갱신
  });

  // 2. 수동 새로고침 처리
  const refreshMutation = useMutation({
    mutationFn: async () => {
      // 정적 파일 방식이므로 페이지를 새로고침하여 최신 파일을 불러옵니다.
      window.location.reload();
      return {};
    },
  });

  const allAssets = data?.assets || [];

  // 3. 정렬 및 필터링 로직
  const sortedAssets = useMemo(() => {
    if (cardOrder.length === 0) return allAssets;
    const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
    return [...allAssets].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  }, [allAssets, cardOrder]);

  const assets = sortedAssets.filter(asset => 
    selectedCategories.includes(asset.category) && 
    selectedWeathers.includes(asset.status)
  );

  // 4. 이펙트 핸들러
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

  // 5. 이벤트 핸들러들
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

  const getSummaryMessage = () => {
    if (allAssets.length === 0) return '';
    const sunnyCount = allAssets.filter(a => a.status === 'sunny').length;
    const thunderCount = allAssets.filter(a => a.status === 'thunder').length;
    if (thunderCount >= 2) return '오늘은 시장이 불안정해요. 신중하게 결정하세요!';
    if (sunnyCount >= 3) return '오늘은 좋은 날이에요! 투자하기 괜찮은 분위기네요.';
    return '시장이 혼조세예요. 관심 있는 자산을 살펴보세요!';
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
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
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
          <p className="text-center text-muted-foreground pt-2">{getSummaryMessage()}</p>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-destructive">데이터를 불러오는 데 실패했어요. 깃허브 액션 설정을 확인해주세요.</p>
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
          <div className="text-center py-12"><p className="text-muted-foreground">표시할 자산이 없어요.</p></div>
        )}
      </main>

      <DetailModal asset={selectedAsset} open={isModalOpen} onClose={handleCloseModal} />

      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-xs text-muted-foreground">머니 웨더는 금융 초보자를 위한 정보 제공 서비스입니다.</p>
        </div>
      </footer>
    </div>
  );
}
