import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import WeatherCard from '@/components/WeatherCard';
import DetailModal from '@/components/DetailModal';
import Header from '@/components/Header';
import CategoryFilter from '@/components/CategoryFilter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { AssetData, MarketDataResponse, AssetCategory } from '@/lib/marketData';
import { formatTime, formatTimeAgo } from '@/lib/marketData';

export default function Dashboard() {
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<AssetCategory[]>([
    'currency', 'index', 'commodity', 'crypto', 'bonds'
  ]);
  const [timeAgo, setTimeAgo] = useState('');

  const { data, isLoading, isError } = useQuery<MarketDataResponse>({
    queryKey: ['/api/market'],
    refetchInterval: 30000,
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
  const assets = allAssets.filter(asset => selectedCategories.includes(asset.category));

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
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

  const allCats: AssetCategory[] = ['currency', 'index', 'commodity', 'crypto', 'bonds'];
  const allSelected = selectedCategories.length === allCats.length;
  
  const handleToggleCategory = (category: AssetCategory) => {
    setSelectedCategories(prev => {
      const isOnlyThisSelected = prev.length === 1 && prev[0] === category;
      
      if (isOnlyThisSelected) {
        return allCats;
      }
      
      return [category];
    });
  };
  
  const handleSelectAll = () => {
    setSelectedCategories(allCats);
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

  const getSummaryMessage = () => {
    if (assets.length === 0) return '';
    
    const sunnyCount = assets.filter(a => a.status === 'sunny').length;
    const thunderCount = assets.filter(a => a.status === 'thunder').length;
    
    if (thunderCount >= 2) return '오늘은 시장이 불안정해요. 신중하게 결정하세요!';
    if (sunnyCount >= 3) return '오늘은 좋은 날이에요! 투자하기 괜찮은 분위기네요.';
    if (sunnyCount === 0) return '오늘은 조용히 관망하는 게 좋겠어요.';
    return '시장이 혼조세예요. 관심 있는 자산을 살펴보세요!';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onRefresh={handleRefresh}
        isRefreshing={refreshMutation.isPending}
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
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

        <CategoryFilter
          selectedCategories={selectedCategories}
          onToggleCategory={handleToggleCategory}
          onSelectAll={handleSelectAll}
        />

        {assets.length > 0 && (
          <p 
            data-testid="text-summary"
            className="text-center text-muted-foreground"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {assets.map((asset) => (
              <WeatherCard
                key={asset.id}
                asset={asset}
                onClick={() => handleCardClick(asset)}
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && assets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">표시할 자산이 없어요. 카테고리를 선택해주세요.</p>
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
