import { Button } from '@/components/ui/button';
import { Banknote, TrendingUp, Gem, Landmark } from 'lucide-react';
import { SiBitcoin } from 'react-icons/si';
import type { AssetCategory } from '@/lib/marketData';

interface CategoryFilterProps {
  selectedCategories: AssetCategory[];
  onToggleCategory: (category: AssetCategory) => void;
}

const categoryConfig: Record<AssetCategory, { name: string; icon: typeof Banknote }> = {
  currency: { name: '환율', icon: Banknote },
  index: { name: '지수', icon: TrendingUp },
  commodity: { name: '원자재', icon: Gem },
  crypto: { name: '코인', icon: SiBitcoin as any },
  bonds: { name: '금리', icon: Landmark },
};

export default function CategoryFilter({ selectedCategories, onToggleCategory }: CategoryFilterProps) {
  const allCategories: AssetCategory[] = ['currency', 'index', 'commodity', 'crypto', 'bonds'];
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {allCategories.map((category) => {
        const config = categoryConfig[category];
        const Icon = config.icon;
        const isSelected = selectedCategories.includes(category);
        
        return (
          <Button
            key={category}
            data-testid={`button-filter-${category}`}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onToggleCategory(category)}
            className="gap-1.5"
          >
            <Icon className="w-4 h-4" />
            <span>{config.name}</span>
          </Button>
        );
      })}
    </div>
  );
}
