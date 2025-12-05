export type MarketStatus = 'open' | 'premarket' | 'afterhours' | 'closed';

export interface MarketStatusInfo {
  status: MarketStatus;
  label: string;
  nextOpenIn?: string;
  color: string;
}

function getKSTDate(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (utcOffset + kstOffset) * 60 * 1000);
}

function formatTimeRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후 개장`;
  }
  return `${minutes}분 후 개장`;
}

export function getKoreanMarketStatus(): MarketStatusInfo {
  const kst = getKSTDate();
  const day = kst.getDay();
  const hours = kst.getHours();
  const minutes = kst.getMinutes();
  const currentTime = hours * 60 + minutes;

  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    let daysUntilMonday = day === 0 ? 1 : 2;
    const nextMonday = new Date(kst);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    const msUntilOpen = nextMonday.getTime() - kst.getTime();
    
    return {
      status: 'closed',
      label: '장 마감',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
  }

  const preMarketStart = 8 * 60;
  const marketOpen = 9 * 60;
  const marketClose = 15 * 60 + 30;

  if (currentTime >= marketOpen && currentTime < marketClose) {
    return {
      status: 'open',
      label: '장 중',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    };
  } else if (currentTime >= preMarketStart && currentTime < marketOpen) {
    const msUntilOpen = (marketOpen - currentTime) * 60 * 1000;
    return {
      status: 'premarket',
      label: '장 전',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    };
  } else {
    let nextOpen = new Date(kst);
    if (currentTime >= marketClose) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
    if (nextOpen.getDay() === 0) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    } else if (nextOpen.getDay() === 6) {
      nextOpen.setDate(nextOpen.getDate() + 2);
    }
    nextOpen.setHours(9, 0, 0, 0);
    const msUntilOpen = nextOpen.getTime() - kst.getTime();
    
    return {
      status: 'closed',
      label: '장 마감',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
  }
}

export function getUSMarketStatus(): MarketStatusInfo {
  const kst = getKSTDate();
  const day = kst.getDay();
  const hours = kst.getHours();
  const minutes = kst.getMinutes();
  const currentTime = hours * 60 + minutes;

  const isWeekend = day === 0 || day === 6;
  const isFridayAfterClose = day === 5 && currentTime >= 6 * 60;
  const isSaturdayBeforePremarket = day === 6;
  const isSundayBeforePremarket = day === 0 && currentTime < 18 * 60;

  if (isWeekend || isFridayAfterClose) {
    let nextOpen = new Date(kst);
    
    if (day === 5) {
      nextOpen.setDate(nextOpen.getDate() + 2);
    } else if (day === 6) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
    nextOpen.setHours(23, 30, 0, 0);
    
    if (day === 0 && currentTime >= 18 * 60) {
      const msUntilOpen = ((23 * 60 + 30) - currentTime) * 60 * 1000;
      return {
        status: 'premarket',
        label: '프리마켓',
        nextOpenIn: formatTimeRemaining(msUntilOpen),
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
      };
    }
    
    const msUntilOpen = nextOpen.getTime() - kst.getTime();
    
    return {
      status: 'closed',
      label: '장 마감',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
  }

  const preMarketStart = 18 * 60;
  const marketOpen = 23 * 60 + 30;
  const marketClose = 6 * 60;
  const afterHoursEnd = 10 * 60;

  if (currentTime >= marketClose && currentTime < afterHoursEnd) {
    return {
      status: 'afterhours',
      label: '애프터마켓',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    };
  } else if (currentTime >= afterHoursEnd && currentTime < preMarketStart) {
    const msUntilPremarket = (preMarketStart - currentTime) * 60 * 1000;
    
    let nextOpen = new Date(kst);
    nextOpen.setHours(23, 30, 0, 0);
    const msUntilOpen = nextOpen.getTime() - kst.getTime();
    
    return {
      status: 'closed',
      label: '장 마감',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
  } else if (currentTime >= preMarketStart && currentTime < marketOpen) {
    const msUntilOpen = (marketOpen - currentTime) * 60 * 1000;
    return {
      status: 'premarket',
      label: '프리마켓',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    };
  } else if (currentTime >= marketOpen || currentTime < marketClose) {
    return {
      status: 'open',
      label: '장 중',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    };
  }

  return {
    status: 'closed',
    label: '장 마감',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
}

export function getMarketStatusForAsset(assetId: string): MarketStatusInfo | null {
  if (assetId === 'kospi' || assetId === 'kosdaq') {
    return getKoreanMarketStatus();
  } else if (assetId === 'sp500') {
    return getUSMarketStatus();
  }
  return null;
}
