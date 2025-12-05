import { useState, useEffect, useCallback } from 'react';
import WeatherCard from '@/components/WeatherCard';
import DetailModal from '@/components/DetailModal';
import Header from '@/components/Header';
import { getMockMarketData, type AssetData } from '@/lib/marketData';

export default function Dashboard() {
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      const data = getMockMarketData();
      setAssets(data);
      setIsRefreshing(false);
    }, 300);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const handleToggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
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
    loadData();
  };

  const getSummaryMessage = () => {
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
        isRefreshing={isRefreshing}
      />

      <main className="container mx-auto px-4 py-6">
        {assets.length > 0 && (
          <p 
            data-testid="text-summary"
            className="text-center text-muted-foreground mb-6"
          >
            {getSummaryMessage()}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <WeatherCard
              key={asset.id}
              asset={asset}
              onClick={() => handleCardClick(asset)}
            />
          ))}
        </div>

        {assets.length === 0 && !isRefreshing && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">데이터를 불러오는 중...</p>
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
