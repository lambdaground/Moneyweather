import { Sun, Moon, RefreshCw, GripVertical, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter'; // 링크 이동을 위해 추가

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
}

export default function Header({ 
  isDark, 
  onToggleTheme, 
  onRefresh, 
  isRefreshing,
  isEditMode,
  onToggleEditMode
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* 타이틀 클릭 시 메인(/)으로 이동하도록 Link 추가 */}
          <Link href="/">
            <h1 
              data-testid="text-app-title"
              className="text-xl sm:text-2xl font-bold text-foreground cursor-pointer hover:opacity-80 transition-opacity"
            >
              오늘의 머니 웨더
            </h1>
          </Link>
          
          <div className="flex items-center gap-2">
            {onToggleEditMode && (
              <Button
                data-testid="button-edit-order"
                variant={isEditMode ? "default" : "ghost"}
                size="icon"
                onClick={onToggleEditMode}
                aria-label={isEditMode ? '편집 완료' : '순서 편집'}
              >
                {isEditMode ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <GripVertical className="w-5 h-5" />
                )}
              </Button>
            )}
            
            <Button
              data-testid="button-refresh"
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing || isEditMode}
              aria-label="새로고침"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              data-testid="button-theme-toggle"
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
