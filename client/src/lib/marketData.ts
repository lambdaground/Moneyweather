export type WeatherStatus = 'sunny' | 'rainy' | 'cloudy' | 'thunder';

export type AssetType = 'usdkrw' | 'kospi' | 'gold' | 'bitcoin' | 'bonds';

export interface AssetData {
  id: AssetType;
  name: string;
  price: number;
  priceDisplay: string;
  change: number;
  status: WeatherStatus;
  message: string;
  advice: string;
}

interface AssetConfig {
  name: string;
  basePrice: number;
  volatility: number;
  unit: string;
  getStatus: (price: number, change: number) => WeatherStatus;
  getMessages: () => Record<WeatherStatus, string>;
  getAdvice: () => string;
}

const assetConfigs: Record<AssetType, AssetConfig> = {
  usdkrw: {
    name: '미국 달러',
    basePrice: 1380,
    volatility: 50,
    unit: 'KRW',
    getStatus: (price: number) => {
      if (price > 1400) return 'rainy';
      if (price < 1350) return 'sunny';
      return 'cloudy';
    },
    getMessages: () => ({
      sunny: '해외직구 타이밍! 달러가 저렴해요.',
      rainy: '지금 여행가면 손해예요! 환전은 미루세요.',
      cloudy: '환율이 잠잠해요. 큰 변화가 없네요.',
      thunder: '환율이 요동치고 있어요! 조심하세요.',
    }),
    getAdvice: () => '환율이 높을 땐 수출 기업 주식이 좋을 수 있어요! 반대로 환율이 낮을 땐 해외여행이나 직구가 유리해요.',
  },
  kospi: {
    name: '코스피',
    basePrice: 2500,
    volatility: 100,
    unit: 'pt',
    getStatus: (price: number, change: number) => {
      if (Math.abs(change) > 2) return 'thunder';
      if (change > 0.5) return 'sunny';
      if (change < -0.5) return 'rainy';
      return 'cloudy';
    },
    getMessages: () => ({
      sunny: '시장이 뜨거워요! 빨간불이 켜졌어요.',
      rainy: '시장이 차갑게 식었어요. 바겐세일 중일지도?',
      cloudy: '시장이 조용하네요. 관망하는 분위기예요.',
      thunder: '시장이 요동치고 있어요! 롤러코스터 주의보!',
    }),
    getAdvice: () => '주식 시장이 하락할 때는 좋은 기업을 싸게 살 기회일 수 있어요. 하지만 무리한 투자는 금물!',
  },
  gold: {
    name: '금',
    basePrice: 2650,
    volatility: 80,
    unit: 'USD/oz',
    getStatus: (price: number, change: number) => {
      if (change > 1) return 'sunny';
      if (change < -1) return 'rainy';
      return 'cloudy';
    },
    getMessages: () => ({
      sunny: '불안할 땐 역시 금이죠! 방어력이 올라갔어요.',
      rainy: '세상이 평화로운가 봐요. 금 인기가 식었어요.',
      cloudy: '금값이 안정적이에요. 조용한 하루네요.',
      thunder: '금값이 크게 움직이고 있어요!',
    }),
    getAdvice: () => '금은 경제가 불안할 때 가치가 오르는 안전자산이에요. 포트폴리오의 10~15%를 금으로 가져가면 안정적이에요.',
  },
  bitcoin: {
    name: '비트코인',
    basePrice: 97000,
    volatility: 5000,
    unit: 'USD',
    getStatus: (price: number, change: number) => {
      if (Math.abs(change) > 3) return 'thunder';
      if (change > 1) return 'sunny';
      if (change < -1) return 'rainy';
      return 'cloudy';
    },
    getMessages: () => ({
      sunny: '코인이 달리고 있어요!',
      rainy: '코인이 쉬어가는 중이에요. 잠시 숨 고르기?',
      cloudy: '코인이 조용하네요. 폭풍 전 고요일지도?',
      thunder: '롤러코스터 출발합니다! 꽉 잡으세요!',
    }),
    getAdvice: () => '비트코인은 변동성이 매우 커요. 잃어도 괜찮은 금액만 투자하고, 장기 관점으로 바라보세요.',
  },
  bonds: {
    name: '10년물 국채',
    basePrice: 4.2,
    volatility: 0.3,
    unit: '%',
    getStatus: (price: number, change: number) => {
      if (change > 0.1) return 'sunny';
      if (change < -0.1) return 'cloudy';
      return 'cloudy';
    },
    getMessages: () => ({
      sunny: '은행 이자가 쏠쏠해요. 적금 들기 좋은 날!',
      rainy: '금리가 많이 내려갔어요.',
      cloudy: '금리가 내려갔어요. 대출받긴 좋겠네요.',
      thunder: '금리가 급변하고 있어요!',
    }),
    getAdvice: () => '금리가 높을 때는 예금과 적금이 유리해요. 금리가 낮을 때는 대출 받기 좋은 시기예요.',
  },
};

function formatPrice(price: number, unit: string): string {
  if (unit === 'KRW') {
    return `${price.toLocaleString('ko-KR')} ${unit}`;
  }
  if (unit === 'pt') {
    return `${price.toLocaleString('ko-KR')} ${unit}`;
  }
  if (unit === '%') {
    return `${price.toFixed(2)}${unit}`;
  }
  if (unit === 'USD' || unit === 'USD/oz') {
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return `${price.toLocaleString('ko-KR')} ${unit}`;
}

function generateRandomChange(volatility: number, basePrice: number): { price: number; change: number } {
  const changePercent = (Math.random() - 0.5) * 6;
  const priceChange = basePrice * (changePercent / 100);
  const price = basePrice + priceChange + (Math.random() - 0.5) * volatility;
  return {
    price: Math.max(0, price),
    change: parseFloat(changePercent.toFixed(2)),
  };
}

export function getMockMarketData(): AssetData[] {
  const assets: AssetData[] = [];

  for (const [id, config] of Object.entries(assetConfigs)) {
    const { price, change } = generateRandomChange(config.volatility, config.basePrice);
    const status = config.getStatus(price, change);
    const messages = config.getMessages();

    assets.push({
      id: id as AssetType,
      name: config.name,
      price,
      priceDisplay: formatPrice(price, config.unit),
      change,
      status,
      message: messages[status],
      advice: config.getAdvice(),
    });
  }

  return assets;
}

export function getWeatherIcon(status: WeatherStatus): string {
  switch (status) {
    case 'sunny':
      return 'Sun';
    case 'rainy':
      return 'CloudRain';
    case 'cloudy':
      return 'Cloud';
    case 'thunder':
      return 'Zap';
  }
}
