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
import { formatTime, formatTimeAgo } from '@/lib/marketData';
import type { AssetData, MarketDataResponse, AssetCategory, WeatherStatus } from '@/lib/marketData';

const CARD_ORDER_KEY = 'moneyweather_card_order';
const allCats: AssetCategory[] = ['currency', 'index', 'commodity', 'crypto', 'bonds'];
const allWeathers: WeatherStatus[] = ['sunny', 'cloudy', 'rainy', 'thunder'];

const CATEGORY_NAME_MAP: Record<AssetCategory, string> = {
  currency: '환율',
  index: '지수',
  commodity: '원자재',
  crypto: '코인',
  bonds: '금리'
};

// [수정] 요청하신 정확한 순서 매핑
const DEFAULT_ORDER = [
  'kospi', 'kosdaq', 'nasdaq', 'sp500', 'dowjones', // 1. 지수
  'usdkrw', 'eurkrw', 'jpykrw',                    // 2. 환율
  'bitcoin', 'ethereum',                           // 3. 코인
  'gold', 'silver', 'gasoline', 'diesel',          // 4. 원자재
  'bokrate', 'krbond3y', 'krbond10y', 'bonds2y', 'bonds', 'kbrealestate', 'cpi', 'ccsi' // 5. 금리(기타포함)
];

const ASSET_CONFIGS: Record<string, { name: string; advice: string; cat: AssetCategory; unit: string; source: string; timeBasis: string; messages: Record<WeatherStatus, string> }> = {
  kospi: { name: '코스피 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '국내 대형주 중심 지수입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  kosdaq: { name: '코스닥 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '중소형주와 기술주 중심 시장입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  nasdaq: { name: '나스닥 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '미국 기술주 중심 지수입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  sp500: { name: 'S&P 500', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '미국 시장 전반의 지표입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  dowjones: { name: '다우존스 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '미국 우량 기업 지수입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  usdkrw: { name: '달러/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '전일 종가', advice: '환율이 높을 땐 수출 기업이 유리해요.', messages: { sunny: '달러 저렴', rainy: '달러 비쌈', cloudy: '보통', thunder: '변동 큼' } },
  eurkrw: { name: '유로/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '실시간', advice: '유럽 직구 시점을 확인하세요.', messages: { sunny: '유로 저렴', rainy: '유로 비쌈', cloudy: '보통', thunder: '변동 큼' } },
  jpykrw: { name: '엔/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '실시간', advice: '엔저일 때 일본 여행이 유리해요.', messages: { sunny: '엔화 저렴', rainy: '엔화 비쌈', cloudy: '보통', thunder: '변동 큼' } },
  bitcoin: { name: '비트코인', cat: 'crypto', unit: '원', source: 'CoinGecko', timeBasis: '24시간 전', advice: '변동성이 큰 자산입니다.', messages: { sunny: '불장', rainy: '하락장', cloudy: '횡보', thunder: '폭락주의' } },
  ethereum: { name: '이더리움', cat: 'crypto', unit: '원', source: 'CoinGecko', timeBasis: '24시간 전', advice: '알트코인 대장주입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '횡보', thunder: '급변동' } },
  gold: { name: '국제 금 시세', cat: 'commodity', unit: '달러', source: 'Yahoo Finance', timeBasis: '실시간', advice: '대표적인 안전자산입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '요동' } },
  silver: { name: '국제 은 시세', cat: 'commodity', unit: '달러', source: 'Yahoo Finance', timeBasis: '실시간', advice: '은은 산업용 수요도 중요합니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '요동' } },
  gasoline: { name: '휘발유', cat: 'commodity', unit: '원', source: 'Opinet', timeBasis: '전일 대비', advice: '유가 변동은 물가에 영향을 줍니다.', messages: { sunny: '저렴함', rainy: '비쌈', cloudy: '보통', thunder: '급등' } },
  diesel: { name: '경유', cat: 'commodity', unit: '원', source: 'Opinet', timeBasis: '전일 대비', advice: '물류 비용과 직결됩니다.', messages: { sunny: '저렴함', rainy: '비쌈', cloudy: '보통', thunder: '급등' } },
  bokrate: { name: '한국 기준금리', cat: 'bonds', unit: '%', source: '한국은행', timeBasis: '최근 발표', advice: '대출/예금 금리의 기준입니다.', messages: { sunny: '인상', rainy: '인하', cloudy: '동결', thunder: '빅스텝' } },
  krbond3y: { name: '국고채 3년', cat: 'bonds', unit: '%', source: 'ECOS', timeBasis: '전일 대비', advice: '단기 금리의 기준입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
  krbond10y: { name: '국고채 10년', cat: 'bonds', unit: '%', source: 'ECOS', timeBasis: '전일 대비', advice: '장기 금리 지표입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
  bonds2y: { name: '미 국채 2년', cat: 'bonds', unit: '%', source: 'Yahoo Finance', timeBasis: '실시간', advice: '미 연준 정책에 민감합니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
  bonds: { name: '미 국채 10년', cat: 'bonds', unit: '%', source: 'Yahoo Finance', timeBasis: '실시간', advice: '글로벌 장기 금리 기준입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
  kbrealestate: { name: '전국 주택지수', cat: 'index', unit: '', source: '부동산원', timeBasis: '전주 대비', advice: '부동산 시장 흐름 지표입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보합', thunder: '급변' } },
  cpi: { name: '소비자물가', cat: 'index', unit: '', source: 'ECOS', timeBasis: '전월 대비', advice: '인플레이션 핵심 지표입니다.', messages: { sunny: '안정', rainy: '상승', cloudy: '보통', thunder: '인플레' } },
  ccsi: { name: '소비자심리', cat: 'index', unit: '점', source: 'ECOS', timeBasis: '전월 대비', advice: '소비자 경기 전망 지수입니다.', messages: { sunny: '낙관적', rainy: '비관적', cloudy: '보통', thunder: '위축' } },
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

  const { data, isLoading } = useQuery<MarketDataResponse>({
    queryKey: ['/market-data.json'],
    queryFn: async () => {
      const res = await fetch('/market-data.json');
      if (!res.ok) throw new Error('로드 실패');
      const rawData = await res.json();
      return {
        assets: rawData.map((item: any) => {
          const id = item.category.toLowerCase();
          const config = ASSET_CONFIGS[id] || { name: id.toUpperCase(), cat: 'index', unit: '', source: '정보 없음', timeBasis: '실시간', advice: '관망', messages: { sunny: '맑음', rainy: '비', cloudy: '흐림', thunder: '번개' } };
          const price = item.payload?.price || 0;
          const change = item.payload?.change || 0;
          let status: WeatherStatus = 'cloudy';
          if (Math.abs(change) > 2.5) status = 'thunder';
          else if (change > 0.5) status = 'sunny';
          else if (change < -0.5) status = 'rainy';

          return {
            id, name: config.name, category: config.cat, categoryName: CATEGORY_NAME_MAP[config.cat],
            price: config.cat === 'index' ? Number(price.toFixed(2)) : Number(price.toFixed(price > 100 ? 0 : 2)),
            change: Number(change.toFixed(2)), status, source: config.source, timeBasis: config.timeBasis,
            message: config.messages[status], advice: config.advice, unit: config.unit
          };
        }),
        generatedAt: rawData[0]?.updated_at || new Date().toISOString()
      };
    },
    refetchInterval: isEditMode ? false : 300000,
  });

  const allAssets = data?.assets || [];

  // [중요] 정렬 로직 수정: DEFAULT_ORDER를 무조건 우선시합니다.
  const sortedAssets = useMemo(() => {
    const baseAssets = [...allAssets];
    
    // 1. 만약 사용자가 수동으로 순서를 조정한 기록이 있다면 그 지도를 사용합니다.
    if (cardOrder.length > 0) {
      const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
      return baseAssets.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
    }
    
    // 2. 초기 로딩 시에는 무조건 DEFAULT_ORDER 배열의 인덱스 순서대로 정렬합니다.
    return baseAssets.sort((a, b) => {
      const indexA = DEFAULT_ORDER.indexOf(a.id);
      const indexB = DEFAULT_ORDER.indexOf(b.id);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [allAssets, cardOrder]);

  const filteredAssets = useMemo(() => {
    return sortedAssets.filter(asset => 
      selectedCategories.includes(asset.category) && 
      selectedWeathers.includes(asset.status)
    );
  }, [sortedAssets, selectedCategories, selectedWeathers]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    setIsDark(savedTheme === 'dark');
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');

    // [중요] 기존에 저장된 순서가 현재의 DEFAULT_ORDER와 너무 다르면 초기화하거나 무시할 수 있도록
    // 이번에는 명시적으로 DEFAULT_ORDER가 작동하도록 cardOrder 설정을 비워둔 채 시작할 수 있습니다.
    const savedOrder = localStorage.getItem(CARD_ORDER_KEY);
    if (savedOrder) {
        setCardOrder(JSON.parse(savedOrder));
    }
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

        <div className="space-y-4">
          <CategoryFilter 
            selectedCategories={selectedCategories} 
            onToggleCategory={(c) => {
              setSelectedCategories(prev => {
                if (prev.length === allCats.length || !prev.includes(c)) return [c];
                return allCats;
              });
            }} 
            onSelectAll={() => setSelectedCategories(allCats)} 
          />
          <WeatherFilter 
            selectedWeathers={selectedWeathers} 
            onToggleWeather={(w) => {
              setSelectedWeathers(prev => {
                if (prev.length === allWeathers.length || !prev.includes(w)) return [w];
                return allWeathers;
              });
            }} 
            onSelectAll={() => setSelectedWeathers(allWeathers)} 
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-44 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredAssets.map(a => a.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredAssets.map((asset) => (
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
    </div>
  );
}
