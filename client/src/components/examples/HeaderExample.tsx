import { useState } from 'react';
import Header from '../Header';

export default function HeaderExample() {
  const [isDark, setIsDark] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleToggleTheme = () => {
    setIsDark(!isDark);
    console.log('Theme toggled:', !isDark ? 'dark' : 'light');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    console.log('Refreshing data...');
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="w-full">
      <Header
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
