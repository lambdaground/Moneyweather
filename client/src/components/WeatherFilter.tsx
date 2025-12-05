import { Button } from '@/components/ui/button';
import { Sun, CloudRain, Cloud, Zap, LayoutGrid } from 'lucide-react';
import type { WeatherStatus } from '@/lib/marketData';

interface WeatherFilterProps {
  selectedWeathers: WeatherStatus[];
  onToggleWeather: (weather: WeatherStatus) => void;
  onSelectAll: () => void;
}

const weatherConfig: Record<WeatherStatus, { name: string; icon: typeof Sun; color: string }> = {
  sunny: { name: '맑음', icon: Sun, color: 'text-orange-500' },
  cloudy: { name: '흐림', icon: Cloud, color: 'text-gray-500' },
  rainy: { name: '비', icon: CloudRain, color: 'text-slate-500' },
  thunder: { name: '번개', icon: Zap, color: 'text-purple-500' },
};

const allWeathers: WeatherStatus[] = ['sunny', 'cloudy', 'rainy', 'thunder'];

export default function WeatherFilter({ selectedWeathers, onToggleWeather, onSelectAll }: WeatherFilterProps) {
  const allSelected = selectedWeathers.length === allWeathers.length;
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <Button
        data-testid="button-weather-all"
        variant={allSelected ? "default" : "outline"}
        onClick={onSelectAll}
        className="gap-2 text-base"
      >
        <LayoutGrid className="w-5 h-5" />
        <span>전체</span>
      </Button>
      
      {allWeathers.map((weather) => {
        const config = weatherConfig[weather];
        const Icon = config.icon;
        const isSelected = selectedWeathers.length === 1 && selectedWeathers.includes(weather);
        
        return (
          <Button
            key={weather}
            data-testid={`button-weather-${weather}`}
            variant={isSelected ? "default" : "outline"}
            onClick={() => onToggleWeather(weather)}
            className="gap-2 text-base"
          >
            <Icon className={`w-5 h-5 ${isSelected ? '' : config.color}`} />
            <span>{config.name}</span>
          </Button>
        );
      })}
    </div>
  );
}
