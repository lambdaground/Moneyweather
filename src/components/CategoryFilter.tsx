import { Button } from '@/components/ui/button';
import { Banknote, TrendingUp, Gem, Landmark, LayoutGrid } from 'lucide-react';
import { SiBitcoin } from 'react-icons/si';
import type { AssetCategory } from '@/lib/marketData';

interface CategoryFilterProps {
  selectedCategories: AssetCategory[];
  onToggleCategory: (category: AssetCategory) => void;
  onSelectAll: () => void;
}

const categoryConfig: Record<AssetCategory, { name: string; icon: typeof Banknote }> = {
  currency: { name: '환율', icon: Banknote },
  index: { name: '지수', icon: TrendingUp },
  commodity: { name: '원자재', icon: Gem },
  crypto: { name: '코인', icon: SiBitcoin as any },
  bonds: { name: '금리', icon: Landmark },
};

const allCategories: AssetCategory[] = ['currency', 'index', 'commodity', 'crypto', 'bonds'];

export default function CategoryFilter({ selectedCategories, onToggleCategory, onSelectAll }: CategoryFilterProps) {
  const allSelected = selectedCategories.length === allCategories.length;
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <Button
        data-testid="button-filter-all"
        variant={allSelected ? "default" : "outline"}
        onClick={onSelectAll}
        className="gap-2 text-base"
      >
        <LayoutGrid className="w-5 h-5" />
        <span>전체</span>
      </Button>
      
      {allCategories.map((category) => {
        const config = categoryConfig[category];
        const Icon = config.icon;
        const isSelected = selectedCategories.length === 1 && selectedCategories.includes(category);
        
        return (
          <Button
            key={category}
            data-testid={`button-filter-${category}`}
            variant={isSelected ? "default" : "outline"}
            onClick={() => onToggleCategory(category)}
            className="gap-2 text-base"
          >
            <Icon className="w-5 h-5" />
            <span>{config.name}</span>
          </Button>
        );
      })}
    </div>
  );
}
