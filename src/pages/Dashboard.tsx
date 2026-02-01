import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

const ASSET_CONFIGS: Record<string, { name: string; advice: string; cat: AssetCategory; unit: string; source: string; timeBasis: string; messages: Record<WeatherStatus, string> }> = {
  // 환율 (Currency)
  usdkrw: { name: '달러/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '전일 종가', advice: '환율이 높을 땐 수출 기업 주식이 유리할 수 있어요.', messages: { sunny: '달러 저렴', rainy: '달러 비쌈', cloudy: '보통', thunder: '변동 큼' } },
  jpykrw: { name: '엔/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '실시간', advice: '엔저일 때 일본 여행을 계획해보세요.', messages: { sunny: '엔화 저렴', rainy: '엔화 비쌈', cloudy: '보통', thunder: '변동 큼' } },
  eurkrw: { name: '유로/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '실시간', advice: '유럽 직구 시 유리한 시점을 확인하세요.', messages: { sunny: '유로 저렴', rainy: '유로 비쌈', cloudy: '보통', thunder: '변동 큼' } },
  cnykrw: { name: '위안/원 환율', cat: 'currency', unit: '원', source: 'ExchangeRate-API', timeBasis: '실시간', advice: '중국 경제 상황의 척도입니다.', messages: { sunny: '위안 저렴', rainy: '위안 비쌈', cloudy: '보통', thunder: '변동 큼' } },

  // 지수 (Index)
  kospi: { name: '코스피 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '국내 대형주 중심의 시장 상황입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  kosdaq: { name: '코스닥 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '중소형주와 기술주 중심의 시장입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  nasdaq: { name: '나스닥 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '미국 기술주 중심의 시장입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  dowjones: { name: '다우존스 지수', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '미국 우량 기업들의 평균 지수입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  sp500: { name: 'S&P 500', cat: 'index', unit: 'pt', source: 'Yahoo Finance', timeBasis: '장 마감', advice: '미국 주식 시장의 전반적인 지표입니다.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변동' } },
  kbrealestate: { name: '전국 주택지수', cat: 'commodity', unit: '', source: '부동산원', timeBasis: '전주 대비', advice: '부동산 시장의 흐름을 확인하세요.', messages: { sunny: '상승세', rainy: '하락세', cloudy: '보합', thunder: '급변' } },
  cpi: { name: '소비자물가', cat: 'index', unit: '', source: 'ECOS', timeBasis: '전월 대비', advice: '인플레이션 압력을 확인하는 핵심 지표입니다.', messages: { sunny: '물가 안정', rainy: '물가 상승', cloudy: '보통', thunder: '인플레' } },
  ccsi: { name: '소비자심리', cat: 'index', unit: '점', source: 'ECOS', timeBasis: '전월 대비', advice: '소비자들의 경기 전망을 나타냅니다.', messages: { sunny: '낙관적', rainy: '비관적', cloudy: '보통', thunder: '심리 위축' } },
  

  // 원자재 (Commodity)
  gold: { name: '국제 금 시세', cat: 'commodity', unit: '달러', source: 'Yahoo Finance', timeBasis: '실시간', advice: '대표적인 안전자산입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '요동' } },
  silver: { name: '국제 은 시세', cat: 'commodity', unit: '달러', source: 'Yahoo Finance', timeBasis: '실시간', advice: '금보다 변동성이 큰 원자재입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '요동' } },
  gasoline: { name: '국내 휘발유', cat: 'commodity', unit: '원', source: 'Opinet', timeBasis: '전일 대비', advice: '유가 변동은 물가에 큰 영향을 줍니다.', messages: { sunny: '저렴함', rainy: '비쌈', cloudy: '보통', thunder: '급등' } },
  diesel: { name: '국내 경유', cat: 'commodity', unit: '원', source: 'Opinet', timeBasis: '전일 대비', advice: '물류 비용과 직결되는 지표입니다.', messages: { sunny: '저렴함', rainy: '비쌈', cloudy: '보통', thunder: '급등' } },
  

  // 코인 (Crypto)
  bitcoin: { name: '비트코인', cat: 'crypto', unit: '원', source: 'CoinGecko', timeBasis: '24시간 전', advice: '가장 대표적인 가상자산입니다.', messages: { sunny: '불장', rainy: '하락장', cloudy: '횡보', thunder: '폭락/폭등' } },
  ethereum: { name: '이더리움', cat: 'crypto', unit: '원', source: 'CoinGecko', timeBasis: '24시간 전', advice: '알트코인의 대장주입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '횡보', thunder: '급변동' } },

  // 금리 (Bonds)
  bokrate: { name: '한국 기준금리', cat: 'bonds', unit: '%', source: '한국은행', timeBasis: '최근 발표', advice: '모든 시중 금리의 기준이 됩니다.', messages: { sunny: '인상', rainy: '인하', cloudy: '동결', thunder: '빅스텝' } },
  bonds: { name: '미 국채 10년', cat: 'bonds', unit: '%', source: 'Yahoo Finance', timeBasis: '실시간', advice: '글로벌 장기 금리의 기준점입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
  bonds2y: { name: '미 국채 2년', cat: 'bonds', unit: '%', source: 'Yahoo Finance', timeBasis: '실시간', advice: '미 연준의 정책 방향을 잘 보여줍니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
  krbond3y: { name: '국고채 3년', cat: 'bonds', unit: '%', source: 'ECOS', timeBasis: '전일 대비', advice: '우리나라 단기 금리의 기준입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
  krbond10y: { name: '국고채 10년', cat: 'bonds', unit: '%', source: 'ECOS', timeBasis: '전일 대비', advice: '국내 장기 금리 지표입니다.', messages: { sunny: '상승', rainy: '하락', cloudy: '보통', thunder: '급변' } },
};

export default function Dashboard() {
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  
  // 필터 초기값: 처음에는 모두 보여줌
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

      const assets: AssetData[] = rawData.map((item: any) => {
        const id = item.category.toLowerCase();
        // ASSET_CONFIGS에 정의된 세부 ID가 없으면 카테고리 대분류라도 매칭 시도
        const config = ASSET_CONFIGS[id] || { 
          name: id.toUpperCase(), cat: 'index', unit: '', source: '정보 없음', timeBasis: '실시간',
          advice: '시장 상황을 확인하세요.', messages: { sunny: '맑음', rainy: '비', cloudy: '흐림', thunder: '번개' } 
        };
        
        const price = item.payload?.price || 0;
        const change = item.payload?.change || 0;
        
        let status: WeatherStatus = 'cloudy';
        if (Math.abs(change) > 2.5) status = 'thunder';
        else if (change > 0.5) status = 'sunny';
        else if (change < -0.5) status = 'rainy';

        return {
          id,
          name: config.name,
          category: config.cat,
          categoryName: CATEGORY_NAME_MAP[config.cat], 
          price: config.cat === 'index' ? Number(price.toFixed(2)) : Number(price.toFixed(price > 100 ? 0 : 2)),
          change: Number(change.toFixed(2)),
          status,
          source: config.source,
          timeBasis: config.timeBasis,
          message: config.messages[status],
          advice: config.advice,
          unit: config.unit
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

  // 필터링 로직: 선택된 카테고리와 날씨 상태가 모두 포함된 것만 반환
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
          {/* [수정] 필터 클릭 시 '전체'를 해제하고 선택한 항목 하나만 남도록 로직 수정 */}
          <CategoryFilter 
            selectedCategories={selectedCategories} 
            onToggleCategory={(c) => {
              setSelectedCategories(prev => {
                const isAllSelected = prev.length === allCats.length;
                // 전체가 선택된 상태에서 클릭하거나, 이미 선택된 걸 다시 누르면 해당 항목만 단독 선택
                if (isAllSelected || prev.includes(c)) {
                  return [c];
                } 
                // 그 외 다중 선택 (필요한 경우 대비)
                return [...prev, c];
              });
            }} 
            onSelectAll={() => setSelectedCategories(allCats)} 
          />
          <WeatherFilter 
            selectedWeathers={selectedWeathers} 
            onToggleWeather={(w) => {
              setSelectedWeathers(prev => {
                const isAllSelected = prev.length === allWeathers.length;
                if (isAllSelected || prev.includes(w)) {
                  return [w];
                }
                return [...prev, w];
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

        {!isLoading && filteredAssets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">선택한 조건에 맞는 데이터가 없습니다.</p>
          </div>
        )}
      </main>

      <DetailModal asset={selectedAsset} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
