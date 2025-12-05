export type MarketStatus = 'open' | 'premarket' | 'afterhours' | 'closed';

export interface MarketStatusInfo {
  status: MarketStatus;
  label: string;
  nextOpenIn?: string;
  color: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '';
  
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후 개장`;
  }
  return `${minutes}분 후 개장`;
}

function getKSTComponents(): { day: number; hours: number; minutes: number; kstDate: Date } {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstDate = new Date(utc + (9 * 3600000));
  
  return {
    day: kstDate.getDay(),
    hours: kstDate.getHours(),
    minutes: kstDate.getMinutes(),
    kstDate: kstDate
  };
}

function createKSTDate(year: number, month: number, date: number, hours: number, minutes: number): Date {
  const utcDate = new Date(Date.UTC(year, month, date, hours - 9, minutes, 0, 0));
  return utcDate;
}

export function getKoreanMarketStatus(): MarketStatusInfo {
  const { day, hours, minutes, kstDate } = getKSTComponents();
  const currentTime = hours * 60 + minutes;

  const isWeekend = day === 0 || day === 6;

  const preMarketStart = 8 * 60;
  const marketOpen = 9 * 60;
  const marketClose = 15 * 60 + 30;

  if (!isWeekend && currentTime >= marketOpen && currentTime < marketClose) {
    return {
      status: 'open',
      label: '장 중',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    };
  }
  
  if (!isWeekend && currentTime >= preMarketStart && currentTime < marketOpen) {
    const msUntilOpen = (marketOpen - currentTime) * 60 * 1000;
    return {
      status: 'premarket',
      label: '장 전',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    };
  }

  const now = new Date();
  let nextOpen = new Date(kstDate);
  
  if (!isWeekend && currentTime >= marketClose) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  
  nextOpen.setHours(9, 0, 0, 0);

  while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  
  const kstNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 3600000));
  const msUntilOpen = nextOpen.getTime() - kstNow.getTime();
  
  return {
    status: 'closed',
    label: '장 마감',
    nextOpenIn: formatTimeRemaining(msUntilOpen),
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
}

export function getUSMarketStatus(): MarketStatusInfo {
  const now = new Date();
  
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const estOffset = -5 * 3600000;
  const estDate = new Date(utc + estOffset);
  
  const estDay = estDate.getDay();
  const estHours = estDate.getHours();
  const estMinutes = estDate.getMinutes();
  const estTime = estHours * 60 + estMinutes;

  const preMarketStart = 4 * 60;
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const afterHoursEnd = 20 * 60;

  const isWeekend = estDay === 0 || estDay === 6;

  if (isWeekend) {
    const daysUntilMonday = estDay === 0 ? 1 : 2;
    const nextOpen = new Date(estDate);
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(9, 30, 0, 0);
    
    const msUntilOpen = nextOpen.getTime() - estDate.getTime();
    
    return {
      status: 'closed',
      label: '장 마감',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
  }

  if (estTime >= marketOpen && estTime < marketClose) {
    return {
      status: 'open',
      label: '장 중',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    };
  }

  if (estTime >= marketClose && estTime < afterHoursEnd) {
    return {
      status: 'afterhours',
      label: '애프터마켓',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    };
  }

  if (estTime >= preMarketStart && estTime < marketOpen) {
    const msUntilOpen = (marketOpen - estTime) * 60 * 1000;
    return {
      status: 'premarket',
      label: '프리마켓',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    };
  }

  const nextOpen = new Date(estDate);
  if (estTime >= afterHoursEnd) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  
  if (nextOpen.getDay() === 6) {
    nextOpen.setDate(nextOpen.getDate() + 2);
  } else if (nextOpen.getDay() === 0) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  
  nextOpen.setHours(9, 30, 0, 0);
  const msUntilOpen = nextOpen.getTime() - estDate.getTime();
  
  return {
    status: 'closed',
    label: '장 마감',
    nextOpenIn: formatTimeRemaining(msUntilOpen),
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
}

export function getMarketStatusForAsset(assetId: string): MarketStatusInfo | null {
  if (assetId === 'kospi' || assetId === 'kosdaq') {
    return getKoreanMarketStatus();
  } else if (assetId === 'sp500' || assetId === 'nasdaq') {
    return getUSMarketStatus();
  }
  return null;
}
