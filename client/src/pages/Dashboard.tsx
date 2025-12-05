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
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import SortableWeatherCard from '@/components/SortableWeatherCard';
import DetailModal from '@/components/DetailModal';
import Header from '@/components/Header';
import CategoryFilter from '@/components/CategoryFilter';
import WeatherFilter from '@/components/WeatherFilter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { AssetData, MarketDataResponse, AssetCategory, WeatherStatus } from '@/lib/marketData';
import { formatTime, formatTimeAgo } from '@/lib/marketData';

const CARD_ORDER_KEY = 'moneyweather_card_order';

const allCats: AssetCategory[] = ['currency', 'index', 'commodity', 'crypto', 'bonds'];
const allWeathers: WeatherStatus[] = ['sunny', 'cloudy', 'rainy', 'thunder'];

export default function Dashboard() {
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<AssetCategory[]>(allCats);
  const [selectedWeathers, setSelectedWeathers] = useState<WeatherStatus[]>(allWeathers);
  const [timeAgo, setTimeAgo] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data, isLoading, isError } = useQuery<MarketDataResponse>({
    queryKey: ['/api/market'],
    refetchInterval: isEditMode ? false : 30000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/market/refresh');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/market'] });
    },
  });

  const allAssets = data?.assets || [];

  const sortedAssets = useMemo(() => {
    if (cardOrder.length === 0) return allAssets;
    
    const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
    const sorted = [...allAssets].sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? 999;
      const orderB = orderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });
    return sorted;
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
      try {
        setCardOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error('Failed to parse saved card order');
      }
    }
  }, []);

  useEffect(() => {
    if (data?.generatedAt) {
      setTimeAgo(formatTimeAgo(data.generatedAt));
      
      const interval = setInterval(() => {
        setTimeAgo(formatTimeAgo(data.generatedAt));
      }, 1000);
      
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
    setSelectedCategories(prev => {
      const isOnlyThisSelected = prev.length === 1 && prev[0] === category;
      if (isOnlyThisSelected) {
        return allCats;
      }
      return [category];
    });
  };
  
  const handleSelectAllCategories = () => {
    setSelectedCategories(allCats);
  };

  const handleToggleWeather = (weather: WeatherStatus) => {
    setSelectedWeathers(prev => {
      const isOnlyThisSelected = prev.length === 1 && prev[0] === weather;
      if (isOnlyThisSelected) {
        return allWeathers;
      }
      return [weather];
    });
  };

  const handleSelectAllWeathers = () => {
    setSelectedWeathers(allWeathers);
  };

  const handleCardClick = (asset: AssetData) => {
    setSelectedAsset(asset);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedAsset(null), 200);
  };

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  const handleToggleEditMode = () => {
    setIsEditMode(prev => !prev);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sortedAssets.findIndex(a => a.id === active.id);
      const newIndex = sortedAssets.findIndex(a => a.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(
          sortedAssets.map(a => a.id),
          oldIndex,
          newIndex
        );
        setCardOrder(newOrder);
        localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder));
      }
    }
  };

  const getSummaryMessage = () => {
    if (allAssets.length === 0) return '';
    
    const sunnyCount = allAssets.filter(a => a.status === 'sunny').length;
    const thunderCount = allAssets.filter(a => a.status === 'thunder').length;
    
    if (thunderCount >= 2) return '오늘은 시장이 불안정해요. 신중하게 결정하세요!';
    if (sunnyCount >= 3) return '오늘은 좋은 날이에요! 투자하기 괜찮은 분위기네요.';
    if (sunnyCount === 0) return '오늘은 조용히 관망하는 게 좋겠어요.';
    return '시장이 혼조세예요. 관심 있는 자산을 살펴보세요!';
  };

  const getEmptyMessage = () => {
    const catAllSelected = selectedCategories.length === allCats.length;
    const weatherAllSelected = selectedWeathers.length === allWeathers.length;
    
    if (!catAllSelected && !weatherAllSelected) {
      return '선택한 카테고리와 날씨에 해당하는 자산이 없어요.';
    }
    if (!catAllSelected) {
      return '선택한 카테고리에 해당하는 자산이 없어요.';
    }
    if (!weatherAllSelected) {
      return '선택한 날씨 상태의 자산이 없어요.';
    }
    return '표시할 자산이 없어요.';
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
          <div 
            data-testid="text-timestamp"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Clock className="w-4 h-4" />
            <span>
              {formatTime(data.generatedAt)} 기준 ({timeAgo})
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs text-muted-foreground">카테고리</span>
          </div>
          <CategoryFilter
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            onSelectAll={handleSelectAllCategories}
          />
        </div>

        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs text-muted-foreground">날씨 상태</span>
          </div>
          <WeatherFilter
            selectedWeathers={selectedWeathers}
            onToggleWeather={handleToggleWeather}
            onSelectAll={handleSelectAllWeathers}
          />
        </div>

        {allAssets.length > 0 && (
          <p 
            data-testid="text-summary"
            className="text-center text-muted-foreground pt-2"
          >
            {getSummaryMessage()}
          </p>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div 
                key={i}
                className="h-40 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-destructive">데이터를 불러오는 데 실패했어요. 다시 시도해주세요.</p>
          </div>
        )}

        {!isLoading && !isError && assets.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={assets.map(a => a.id)} 
              strategy={rectSortingStrategy}
            >
              {isEditMode && (
                <p 
                  data-testid="text-edit-mode-hint"
                  className="text-center text-sm text-muted-foreground pb-2"
                >
                  카드를 드래그해서 순서를 변경하세요
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <SortableWeatherCard
                    key={asset.id}
                    asset={asset}
                    onClick={() => handleCardClick(asset)}
                    isEditMode={isEditMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {!isLoading && !isError && assets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{getEmptyMessage()}</p>
          </div>
        )}
      </main>

      <DetailModal
        asset={selectedAsset}
        open={isModalOpen}
        onClose={handleCloseModal}
      />

      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p 
            data-testid="text-footer"
            className="text-center text-xs text-muted-foreground"
          >
            머니 웨더는 금융 초보자를 위한 정보 제공 서비스입니다. 투자 결정은 신중하게 하세요.
          </p>
        </div>
      </footer>
    </div>
  );
}
