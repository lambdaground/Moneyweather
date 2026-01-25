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
  crypto: '가상화폐',
  bonds: '채권'
};

// 1. [단위 수정] 미국채 및 금리 지표에 '%' 단위 추가
const ASSET_CONFIGS: Record<string, { name: string; advice: string; cat: AssetCategory; unit: string; source: string; timeBasis: string; messages: Record<WeatherStatus, string> }> = {
  usdkrw: { name: '달러/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '전일 종가', advice: '환율이 높을 땐 수출 기업 주식이 유리할 수 있어요.', messages: { sunny: '달러가 저렴해요!', rainy: '달러가 비싸요!', cloudy: '환율이 잠잠해요.', thunder: '환율 요동 중!' } },
  jpykrw: { name: '엔/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '실시간', advice: '엔저 현상일 때는 일본 여행이나 여행주를 살펴보세요.', messages: { sunny: '엔화가 싸요!', rainy: '엔화가 비싸요!', cloudy: '안정적이에요.', thunder: '급변하고 있어요!' } },
  eurkrw: { name: '유로/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '실시간', advice: '유럽 직구나 여행 계획이 있다면 체크하세요.', messages: { sunny: '유로가 저렴해요.', rainy: '유로가 비싸요.', cloudy: '안정적이에요.', thunder: '변동성 주의!' } },
  kospi: { name: '코스피 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '국내 대형주 중심 지수입니다.', messages: { sunny: '코스피 상승 중!', rainy: '코스피 하락 중.', cloudy: '조용하네요.', thunder: '변동성 주의!' } },
  kosdaq: { name: '코스닥 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '중소형주와 기술주 중심의 시장입니다.', messages: { sunny: '코스닥 활기차요!', rainy: '코스닥 약세.', cloudy: '보합권입니다.', thunder: '요동치고 있어요!' } },
  gold: { name: '국제 금 시세', cat: 'commodity', unit: '달러', source: 'Yahoo Finance', timeBasis: '실시간', advice: '대표적인 안전자산으로 위기 시 가치가 오릅니다.', messages: { sunny: '금값 상승 중!', rainy: '금값 하락 중.', cloudy: '안정적입니다.', thunder: '금값 요동 중!' } },
  silver: { name: '국제 은 시세', cat: 'commodity', unit: '달러', source: 'Yahoo Finance', timeBasis: '실시간', advice: '금보다 변동성이 크며 산업용 수요도 중요합니다.', messages: { sunny: '은값 상승!', rainy: '은값 하락.', cloudy: '조용하네요.', thunder: '은값 급변 중!' } },
  bitcoin: { name: '비트코인', cat: 'crypto', unit: '원', source: 'CoinGecko', timeBasis: '24시간 전', advice: '대표적인 가상자산입니다. 변동성에 주의하세요.', messages: { sunny: '비트코인 불장!', rainy: '비트코인 약세.', cloudy: '횡보 중입니다.', thunder: '롤러코스터!' } },
  ethereum: { name: '이더리움', cat: 'crypto', unit: '원', source: 'CoinGecko', timeBasis: '24시간 전', advice: '스마트 컨트랙트 플랫폼의 대표격입니다.', messages: { sunny: '이더리움 상승!', rainy: '이더리움 하락.', cloudy: '조용하네요.', thunder: '변동성 매우 큼!' } },
  
  // 금리/채권 섹터 - 단위를 '%'로 설정
  bokrate: { name: '한국 기준금리', cat: 'bonds', unit: '%', source: '한국은행', timeBasis: '최근 발표', advice: '모든 대출 및 예금 금리의 기준이 됩니다.', messages: { sunny: '금리 상승!', rainy: '금리 인하.', cloudy: '금리 동결.', thunder: '빅스텝 가능성!' } },
  bonds: { name: '미 국채 10년', cat: 'bonds', unit: '%', source: 'Yahoo Finance', timeBasis: '실시간', advice: '글로벌 장기 금리의 기준점입니다.', messages: { sunny: '장기 금리 상승!', rainy: '장기 금리 하락.', cloudy: '안정적 흐름.', thunder: '금리 급변동!' } },
  bonds2y: { name: '미 국채 2년', cat: 'bonds', unit: '%', source: 'Yahoo Finance', timeBasis: '실시간', advice: '연준의 정책 금리에 민감하게 반응합니다.', messages: { sunny: '단기 금리 상승!', rainy: '단기 금리 하락.', cloudy: '잠잠한 흐름.', thunder: '단기 금리 급등!' } },
  krbond3y: { name: '국고채 3년', cat: 'bonds', unit: '%', source: 'ECOS', timeBasis: '전일 대비', advice: '국내 단기 금리의 기준이 됩니다.', messages: { sunny: '채권 금리 상승!', rainy: '채권 금리 하락.', cloudy: '보합권입니다.', thunder: '금리 요동 중!' } },
  krbond10y: { name: '국고채 10년', cat: 'bonds', unit: '%', source: 'ECOS', timeBasis: '전일 대비', advice: '국내 장기 금리와 주택담보대출에 영향을 줍니다.', messages: { sunny: '장기채 금리 상승!', rainy: '장기채 금리 하락.', cloudy: '안정적 흐름.', thunder: '장기 금리 급변!' } },
  
  gasoline: { name: '국내 휘발유', cat: 'commodity', unit: '원', source: 'Opinet', timeBasis: '전일 대비', advice: '기름값이 오르면 물가에 부담이 됩니다.', messages: { sunny: '휘발유 저렴함!', rainy: '휘발유 비쌈!', cloudy: '가격 보통임.', thunder: '유가 급등락!' } },
  kbrealestate: { name: '전국 주택지수', cat: 'commodity', unit: '', source: '부동산원', timeBasis: '전주 대비', advice: '부동산 시장의 전반적인 분위기를 보여줍니다.', messages: { sunny: '집값 상승세!', rainy: '집값 하향세.', cloudy: '가격 정체기.', thunder: '가격 급변기!' } }
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

  const { data, isLoading, isError } = useQuery<MarketDataResponse>({
    queryKey: ['/market-data.json'],
    queryFn: async () => {
      const res = await fetch('/market-data.json');
      if (!res.ok) throw new Error('로드 실패');
      const rawData = await res.json();

      const assets: AssetData[] = rawData.map((item: any) => {
        const id = item.category.toLowerCase();
        const config = ASSET_CONFIGS[id] || { 
          name: id.toUpperCase(), cat: 'index', unit: '', source: '알 수 없음', timeBasis: '실시간',
          advice: '시장 상황을 확인하세요.', messages: { sunny: '맑음', rainy: '비', cloudy: '흐림', thunder: '번개' } 
        };
        
        const price = item.payload?.price || 0;
        const change = item.payload?.change || 0;
        
        let status: WeatherStatus = 'cloudy';
        if (config.cat === 'crypto') {
            status = Math.abs(change) > 3 ? 'thunder' : change > 1 ? 'sunny' : change < -1 ? 'rainy' : 'cloudy';
        } else if (config.cat === 'currency') {
            status = price > 1400 ? 'rainy' : price < 1350 ? 'sunny' : 'cloudy';
        } else {
            status = Math.abs(change) > 2 ? 'thunder' : change > 0.5 ? 'sunny' : change < -0.5 ? 'rainy' : 'cloudy';
        }

        return {
          id,
          name: config.name,
          category: config.cat,
          categoryName: CATEGORY_NAME_MAP[config.cat], 
          price: Number(price.toFixed(price > 100 ? 0 : 2)),
          change: Number(change.toFixed(2)),
          status,
          source: config.source,
          timeBasis: config.timeBasis,
          message: config.messages[status],
          advice: config.advice,
          unit: config.unit // [수정] 설정된 단위를 그대로 사용
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

        <div className="space-y-4">
          <CategoryFilter selectedCategories={selectedCategories} onToggleCategory={(c) => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} onSelectAll={() => setSelectedCategories(allCats)} />
          <WeatherFilter selectedWeathers={selectedWeathers} onToggleWeather={(w) => setSelectedWeathers(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} onSelectAll={() => setSelectedWeathers(allWeathers)} />
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
      <footer className="py-8 text-center text-xs text-muted-foreground border-t">머니 웨더는 {data?.assets[0]?.source || '다양한 금융 API'}의 데이터를 바탕으로 제공됩니다.</footer>
    </div>
  );
}
