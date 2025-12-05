import type { AssetData, AssetType, WeatherStatus } from "@shared/schema";

interface RawMarketData {
  usdkrw: { price: number; change: number } | null;
  kospi: { price: number; change: number } | null;
  gold: { price: number; change: number } | null;
  bitcoin: { price: number; change: number } | null;
  bonds: { price: number; change: number } | null;
}

async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

let previousUsdKrw: number | null = null;

async function fetchUsdKrw(): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      'https://api.exchangerate-api.com/v4/latest/USD'
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    const price = data.rates?.KRW;
    if (!price) return null;
    
    let change = 0;
    if (previousUsdKrw !== null) {
      change = ((price - previousUsdKrw) / previousUsdKrw) * 100;
    }
    previousUsdKrw = price;
    
    return { price, change: parseFloat(change.toFixed(2)) };
  } catch (error) {
    console.error('Failed to fetch USD/KRW:', error);
    return null;
  }
}

async function fetchBitcoin(): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    const price = data.bitcoin?.usd;
    const change = data.bitcoin?.usd_24h_change;
    
    if (price === undefined) return null;
    
    return { 
      price, 
      change: parseFloat((change || 0).toFixed(2)) 
    };
  } catch (error) {
    console.error('Failed to fetch Bitcoin:', error);
    return null;
  }
}

async function fetchGold(): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=2d'
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose || meta?.previousClose;
    
    if (!price) return null;
    
    const change = previousClose 
      ? ((price - previousClose) / previousClose) * 100 
      : 0;
    
    return { 
      price, 
      change: parseFloat(change.toFixed(2)) 
    };
  } catch (error) {
    console.error('Failed to fetch Gold:', error);
    return null;
  }
}

async function fetchKospi(): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=2d'
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose || meta?.previousClose;
    
    if (!price) return null;
    
    const change = previousClose 
      ? ((price - previousClose) / previousClose) * 100 
      : 0;
    
    return { 
      price, 
      change: parseFloat(change.toFixed(2)) 
    };
  } catch (error) {
    console.error('Failed to fetch KOSPI:', error);
    return null;
  }
}

async function fetchBonds(): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=2d'
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose || meta?.previousClose;
    
    if (!price) return null;
    
    const change = previousClose 
      ? price - previousClose
      : 0;
    
    return { 
      price, 
      change: parseFloat(change.toFixed(2)) 
    };
  } catch (error) {
    console.error('Failed to fetch 10Y Bonds:', error);
    return null;
  }
}

export async function fetchAllMarketData(): Promise<RawMarketData> {
  const [usdkrw, bitcoin, gold, kospi, bonds] = await Promise.all([
    fetchUsdKrw(),
    fetchBitcoin(),
    fetchGold(),
    fetchKospi(),
    fetchBonds(),
  ]);

  return { usdkrw, kospi, gold, bitcoin, bonds };
}

function getUsdKrwStatus(price: number): WeatherStatus {
  if (price > 1400) return 'rainy';
  if (price < 1350) return 'sunny';
  return 'cloudy';
}

function getKospiStatus(change: number): WeatherStatus {
  if (Math.abs(change) > 2) return 'thunder';
  if (change > 0.5) return 'sunny';
  if (change < -0.5) return 'rainy';
  return 'cloudy';
}

function getGoldStatus(change: number): WeatherStatus {
  if (change > 1) return 'sunny';
  if (change < -1) return 'rainy';
  return 'cloudy';
}

function getBitcoinStatus(change: number): WeatherStatus {
  if (Math.abs(change) > 3) return 'thunder';
  if (change > 1) return 'sunny';
  if (change < -1) return 'rainy';
  return 'cloudy';
}

function getBondsStatus(change: number): WeatherStatus {
  if (change > 0.1) return 'sunny';
  if (change < -0.1) return 'cloudy';
  return 'cloudy';
}

const messages: Record<AssetType, Record<WeatherStatus, string>> = {
  usdkrw: {
    sunny: '해외직구 타이밍! 달러가 저렴해요.',
    rainy: '지금 여행가면 손해예요! 환전은 미루세요.',
    cloudy: '환율이 잠잠해요. 큰 변화가 없네요.',
    thunder: '환율이 요동치고 있어요! 조심하세요.',
  },
  kospi: {
    sunny: '시장이 뜨거워요! 빨간불이 켜졌어요.',
    rainy: '시장이 차갑게 식었어요. 바겐세일 중일지도?',
    cloudy: '시장이 조용하네요. 관망하는 분위기예요.',
    thunder: '시장이 요동치고 있어요! 롤러코스터 주의보!',
  },
  gold: {
    sunny: '불안할 땐 역시 금이죠! 방어력이 올라갔어요.',
    rainy: '세상이 평화로운가 봐요. 금 인기가 식었어요.',
    cloudy: '금값이 안정적이에요. 조용한 하루네요.',
    thunder: '금값이 크게 움직이고 있어요!',
  },
  bitcoin: {
    sunny: '코인이 달리고 있어요!',
    rainy: '코인이 쉬어가는 중이에요. 잠시 숨 고르기?',
    cloudy: '코인이 조용하네요. 폭풍 전 고요일지도?',
    thunder: '롤러코스터 출발합니다! 꽉 잡으세요!',
  },
  bonds: {
    sunny: '은행 이자가 쏠쏠해요. 적금 들기 좋은 날!',
    rainy: '금리가 많이 내려갔어요.',
    cloudy: '금리가 내려갔어요. 대출받긴 좋겠네요.',
    thunder: '금리가 급변하고 있어요!',
  },
};

const advices: Record<AssetType, string> = {
  usdkrw: '환율이 높을 땐 수출 기업 주식이 좋을 수 있어요! 반대로 환율이 낮을 땐 해외여행이나 직구가 유리해요.',
  kospi: '주식 시장이 하락할 때는 좋은 기업을 싸게 살 기회일 수 있어요. 하지만 무리한 투자는 금물!',
  gold: '금은 경제가 불안할 때 가치가 오르는 안전자산이에요. 포트폴리오의 10~15%를 금으로 가져가면 안정적이에요.',
  bitcoin: '비트코인은 변동성이 매우 커요. 잃어도 괜찮은 금액만 투자하고, 장기 관점으로 바라보세요.',
  bonds: '금리가 높을 때는 예금과 적금이 유리해요. 금리가 낮을 때는 대출 받기 좋은 시기예요.',
};

const assetNames: Record<AssetType, string> = {
  usdkrw: '미국 달러',
  kospi: '코스피',
  gold: '금',
  bitcoin: '비트코인',
  bonds: '10년물 국채',
};

function formatPrice(id: AssetType, price: number): string {
  switch (id) {
    case 'usdkrw':
      return `${price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} KRW`;
    case 'kospi':
      return `${price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} pt`;
    case 'gold':
      return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'bitcoin':
      return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'bonds':
      return `${price.toFixed(2)}%`;
    default:
      return String(price);
  }
}

function generateMockData(id: AssetType): { price: number; change: number } {
  const configs: Record<AssetType, { base: number; volatility: number }> = {
    usdkrw: { base: 1380, volatility: 50 },
    kospi: { base: 2500, volatility: 100 },
    gold: { base: 2650, volatility: 80 },
    bitcoin: { base: 97000, volatility: 5000 },
    bonds: { base: 4.2, volatility: 0.3 },
  };
  
  const config = configs[id];
  const changePercent = (Math.random() - 0.5) * 6;
  const priceChange = config.base * (changePercent / 100);
  const price = config.base + priceChange + (Math.random() - 0.5) * config.volatility;
  
  return {
    price: Math.max(0, price),
    change: parseFloat(changePercent.toFixed(2)),
  };
}

export function convertToAssetData(rawData: RawMarketData): AssetData[] {
  const assets: AssetData[] = [];
  const assetIds: AssetType[] = ['usdkrw', 'kospi', 'gold', 'bitcoin', 'bonds'];
  
  const statusFunctions: Record<AssetType, (price: number, change: number) => WeatherStatus> = {
    usdkrw: (price) => getUsdKrwStatus(price),
    kospi: (_, change) => getKospiStatus(change),
    gold: (_, change) => getGoldStatus(change),
    bitcoin: (_, change) => getBitcoinStatus(change),
    bonds: (_, change) => getBondsStatus(change),
  };

  for (const id of assetIds) {
    let data = rawData[id];
    
    if (!data) {
      console.log(`Using mock data for ${id}`);
      data = generateMockData(id);
    }
    
    const status = statusFunctions[id](data.price, data.change);
    
    assets.push({
      id,
      name: assetNames[id],
      price: data.price,
      priceDisplay: formatPrice(id, data.price),
      change: data.change,
      status,
      message: messages[id][status],
      advice: advices[id],
    });
  }

  return assets;
}

export async function fetchRealMarketData(): Promise<AssetData[]> {
  const rawData = await fetchAllMarketData();
  return convertToAssetData(rawData);
}
