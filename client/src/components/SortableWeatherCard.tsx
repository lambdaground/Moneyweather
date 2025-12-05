import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import WeatherCard from './WeatherCard';
import type { AssetData } from '@/lib/marketData';

interface SortableWeatherCardProps {
  asset: AssetData;
  onClick: () => void;
  isEditMode: boolean;
}

export default function SortableWeatherCard({ asset, onClick, isEditMode }: SortableWeatherCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  if (!isEditMode) {
    return <WeatherCard asset={asset} onClick={onClick} />;
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="relative"
    >
      <div
        {...attributes}
        {...listeners}
        data-testid={`drag-handle-${asset.id}`}
        className="absolute top-2 right-2 z-10 p-2 rounded-md bg-background/80 backdrop-blur cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="pointer-events-none">
        <WeatherCard asset={asset} onClick={() => {}} />
      </div>
      <div 
        className="absolute inset-0 border-2 border-dashed border-primary/50 rounded-lg pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
