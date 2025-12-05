import type { AssetData, AssetType, WeatherStatus, AssetCategory } from "@shared/schema";

interface RawMarketData {
  [key: string]: { price: number; change: number } | null;
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

const previousRates: Record<string, number> = {};

async function fetchExchangeRates(): Promise<Record<string, { price: number; change: number } | null>> {
  try {
    const response = await fetchWithTimeout(
      'https://api.exchangerate-api.com/v4/latest/USD'
    );
    if (!response.ok) return { usdkrw: null, jpykrw: null, cnykrw: null, eurkrw: null };
    
    const data = await response.json();
    const krwPerUsd = data.rates?.KRW;
    const jpyPerUsd = data.rates?.JPY;
    const cnyPerUsd = data.rates?.CNY;
    const eurPerUsd = data.rates?.EUR;
    
    if (!krwPerUsd) return { usdkrw: null, jpykrw: null, cnykrw: null, eurkrw: null };
    
    const rates: Record<string, { price: number; change: number } | null> = {};
    
    const usdkrwPrice = krwPerUsd;
    rates.usdkrw = {
      price: usdkrwPrice,
      change: previousRates.usdkrw 
        ? parseFloat((((usdkrwPrice - previousRates.usdkrw) / previousRates.usdkrw) * 100).toFixed(2))
        : 0
    };
    previousRates.usdkrw = usdkrwPrice;
    
    if (jpyPerUsd) {
      const jpykrwPrice = krwPerUsd / jpyPerUsd;
      rates.jpykrw = {
        price: jpykrwPrice,
        change: previousRates.jpykrw
          ? parseFloat((((jpykrwPrice - previousRates.jpykrw) / previousRates.jpykrw) * 100).toFixed(2))
          : 0
      };
      previousRates.jpykrw = jpykrwPrice;
    }
    
    if (cnyPerUsd) {
      const cnykrwPrice = krwPerUsd / cnyPerUsd;
      rates.cnykrw = {
        price: cnykrwPrice,
        change: previousRates.cnykrw
          ? parseFloat((((cnykrwPrice - previousRates.cnykrw) / previousRates.cnykrw) * 100).toFixed(2))
          : 0
      };
      previousRates.cnykrw = cnykrwPrice;
    }
    
    if (eurPerUsd) {
      const eurkrwPrice = krwPerUsd / eurPerUsd;
      rates.eurkrw = {
        price: eurkrwPrice,
        change: previousRates.eurkrw
          ? parseFloat((((eurkrwPrice - previousRates.eurkrw) / previousRates.eurkrw) * 100).toFixed(2))
          : 0
      };
      previousRates.eurkrw = eurkrwPrice;
    }
    
    return rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return { usdkrw: null, jpykrw: null, cnykrw: null, eurkrw: null };
  }
}

async function fetchYahooFinance(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose || meta?.previousClose;
    
    if (!price) return null;
    
    const isPercentage = symbol === '%5ETNX' || symbol === '^TNX';
    const change = previousClose 
      ? isPercentage 
        ? price - previousClose
        : ((price - previousClose) / previousClose) * 100 
      : 0;
    
    return { 
      price, 
      change: parseFloat(change.toFixed(2)) 
    };
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error);
    return null;
  }
}

async function fetchCrypto(id: string): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    const asset = data[id];
    if (!asset) return null;
    
    return { 
      price: asset.usd, 
      change: parseFloat((asset.usd_24h_change || 0).toFixed(2)) 
    };
  } catch (error) {
    console.error(`Failed to fetch ${id}:`, error);
    return null;
  }
}

export async function fetchAllMarketData(): Promise<RawMarketData> {
  const [
    exchangeRates,
    kospi,
    kosdaq,
    sp500,
    gold,
    silver,
    oil,
    bitcoin,
    ethereum,
    bonds10y,
    bonds2y,
  ] = await Promise.all([
    fetchExchangeRates(),
    fetchYahooFinance('^KS11'),
    fetchYahooFinance('^KQ11'),
    fetchYahooFinance('^GSPC'),
    fetchYahooFinance('GC=F'),
    fetchYahooFinance('SI=F'),
    fetchYahooFinance('CL=F'),
    fetchCrypto('bitcoin'),
    fetchCrypto('ethereum'),
    fetchYahooFinance('^TNX'),
    fetchYahooFinance('^IRX'),
  ]);

  return { 
    ...exchangeRates,
    kospi, 
    kosdaq,
    sp500,
    gold, 
    silver,
    oil,
    bitcoin, 
    ethereum,
    bonds: bonds10y,
    bonds2y,
  };
}

function getCurrencyStatus(price: number, baseLow: number, baseHigh: number): WeatherStatus {
  if (price > baseHigh) return 'rainy';
  if (price < baseLow) return 'sunny';
  return 'cloudy';
}

function getIndexStatus(change: number): WeatherStatus {
  if (Math.abs(change) > 2) return 'thunder';
  if (change > 0.5) return 'sunny';
  if (change < -0.5) return 'rainy';
  return 'cloudy';
}

function getCommodityStatus(change: number): WeatherStatus {
  if (change > 1) return 'sunny';
  if (change < -1) return 'rainy';
  return 'cloudy';
}

function getCryptoStatus(change: number): WeatherStatus {
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

interface AssetConfig {
  name: string;
  category: AssetCategory;
  getStatus: (price: number, change: number) => WeatherStatus;
  formatPrice: (price: number) => string;
  messages: Record<WeatherStatus, string>;
  advice: string;
}

const assetConfigs: Record<AssetType, AssetConfig> = {
  usdkrw: {
    name: '미국 달러',
    category: 'currency',
    getStatus: (price) => getCurrencyStatus(price, 1350, 1400),
    formatPrice: (p) => `${p.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} KRW`,
    messages: {
      sunny: '해외직구 타이밍! 달러가 저렴해요.',
      rainy: '달러가 비싸요! 환전은 미루세요.',
      cloudy: '환율이 잠잠해요. 큰 변화가 없네요.',
      thunder: '환율이 요동치고 있어요!',
    },
    advice: '환율이 높을 땐 수출 기업 주식이 좋을 수 있어요! 반대로 환율이 낮을 땐 해외여행이나 직구가 유리해요.',
  },
  jpykrw: {
    name: '일본 엔화',
    category: 'currency',
    getStatus: (price) => getCurrencyStatus(price, 9, 10),
    formatPrice: (p) => `${p.toFixed(2)} KRW/100엔`,
    messages: {
      sunny: '일본 여행 찬스! 엔화가 싸요.',
      rainy: '엔화가 비싸졌어요. 일본 여행은 나중에?',
      cloudy: '엔화가 안정적이에요.',
      thunder: '엔화가 급변하고 있어요!',
    },
    advice: '엔화가 저렴할 때 일본 여행이나 일본 상품 구매를 고려해보세요.',
  },
  cnykrw: {
    name: '중국 위안화',
    category: 'currency',
    getStatus: (price) => getCurrencyStatus(price, 190, 210),
    formatPrice: (p) => `${p.toFixed(2)} KRW`,
    messages: {
      sunny: '위안화가 저렴해요!',
      rainy: '위안화가 비싸졌어요.',
      cloudy: '위안화가 안정적이에요.',
      thunder: '위안화가 급변하고 있어요!',
    },
    advice: '중국 수출입 기업이라면 위안화 움직임을 주시하세요.',
  },
  eurkrw: {
    name: '유로화',
    category: 'currency',
    getStatus: (price) => getCurrencyStatus(price, 1450, 1550),
    formatPrice: (p) => `${p.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} KRW`,
    messages: {
      sunny: '유럽 여행 기회! 유로가 저렴해요.',
      rainy: '유로가 비싸요. 유럽 여행은 조금 미룰까요?',
      cloudy: '유로가 안정적이에요.',
      thunder: '유로가 급변하고 있어요!',
    },
    advice: '유럽 여행이나 유럽 상품 구매를 계획 중이라면 환율을 체크하세요.',
  },
  kospi: {
    name: '코스피',
    category: 'index',
    getStatus: (_, change) => getIndexStatus(change),
    formatPrice: (p) => `${p.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} pt`,
    messages: {
      sunny: '코스피가 올라가요! 시장이 활기차네요.',
      rainy: '코스피가 내려갔어요. 바겐세일 중?',
      cloudy: '코스피가 조용하네요.',
      thunder: '코스피가 요동쳐요! 롤러코스터 주의보!',
    },
    advice: '주식 시장이 하락할 때는 좋은 기업을 싸게 살 기회일 수 있어요. 하지만 무리한 투자는 금물!',
  },
  kosdaq: {
    name: '코스닥',
    category: 'index',
    getStatus: (_, change) => getIndexStatus(change),
    formatPrice: (p) => `${p.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} pt`,
    messages: {
      sunny: '코스닥이 달리고 있어요!',
      rainy: '코스닥이 쉬어가는 중이에요.',
      cloudy: '코스닥이 조용하네요.',
      thunder: '코스닥이 요동쳐요! 변동성 주의!',
    },
    advice: '코스닥은 중소기업 중심이라 변동성이 커요. 신중하게 투자하세요.',
  },
  sp500: {
    name: 'S&P 500',
    category: 'index',
    getStatus: (_, change) => getIndexStatus(change),
    formatPrice: (p) => `${p.toLocaleString('en-US', { maximumFractionDigits: 2 })} pt`,
    messages: {
      sunny: '미국 시장이 뜨거워요!',
      rainy: '미국 시장이 쉬어가는 중이에요.',
      cloudy: '미국 시장이 조용하네요.',
      thunder: '미국 시장이 요동쳐요!',
    },
    advice: 'S&P 500은 미국 대형주 500개 기업의 지수예요. 미국 경제의 전반적인 상태를 보여줘요.',
  },
  gold: {
    name: '금',
    category: 'commodity',
    getStatus: (_, change) => getCommodityStatus(change),
    formatPrice: (p) => `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    messages: {
      sunny: '금값이 올랐어요! 안전자산 인기 상승!',
      rainy: '금값이 내렸어요. 세상이 평화로운가 봐요.',
      cloudy: '금값이 안정적이에요.',
      thunder: '금값이 크게 움직이고 있어요!',
    },
    advice: '금은 경제가 불안할 때 가치가 오르는 안전자산이에요. 포트폴리오의 10~15%를 금으로 가져가면 안정적이에요.',
  },
  silver: {
    name: '은',
    category: 'commodity',
    getStatus: (_, change) => getCommodityStatus(change),
    formatPrice: (p) => `$${p.toFixed(2)}`,
    messages: {
      sunny: '은값이 올랐어요!',
      rainy: '은값이 내렸어요.',
      cloudy: '은값이 안정적이에요.',
      thunder: '은값이 크게 움직이고 있어요!',
    },
    advice: '은은 금보다 변동성이 크지만, 산업용으로도 많이 쓰여서 수요가 꾸준해요.',
  },
  oil: {
    name: '원유 (WTI)',
    category: 'commodity',
    getStatus: (_, change) => getCommodityStatus(change),
    formatPrice: (p) => `$${p.toFixed(2)}/배럴`,
    messages: {
      sunny: '유가가 올랐어요! 에너지 기업 주목!',
      rainy: '유가가 내렸어요. 주유소 갈 때 좋겠네요.',
      cloudy: '유가가 안정적이에요.',
      thunder: '유가가 크게 움직이고 있어요!',
    },
    advice: '유가는 물가와 경제에 큰 영향을 줘요. 유가가 오르면 물가도 오르는 경향이 있어요.',
  },
  bitcoin: {
    name: '비트코인',
    category: 'crypto',
    getStatus: (_, change) => getCryptoStatus(change),
    formatPrice: (p) => `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    messages: {
      sunny: '비트코인이 달리고 있어요!',
      rainy: '비트코인이 쉬어가는 중이에요.',
      cloudy: '비트코인이 조용하네요.',
      thunder: '롤러코스터 출발! 꽉 잡으세요!',
    },
    advice: '비트코인은 변동성이 매우 커요. 잃어도 괜찮은 금액만 투자하고, 장기 관점으로 바라보세요.',
  },
  ethereum: {
    name: '이더리움',
    category: 'crypto',
    getStatus: (_, change) => getCryptoStatus(change),
    formatPrice: (p) => `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    messages: {
      sunny: '이더리움이 달리고 있어요!',
      rainy: '이더리움이 쉬어가는 중이에요.',
      cloudy: '이더리움이 조용하네요.',
      thunder: '이더리움 롤러코스터!',
    },
    advice: '이더리움은 스마트 컨트랙트 플랫폼이에요. NFT와 DeFi의 기반이 되는 중요한 코인이에요.',
  },
  bonds: {
    name: '미국 10년물 국채',
    category: 'bonds',
    getStatus: (_, change) => getBondsStatus(change),
    formatPrice: (p) => `${p.toFixed(2)}%`,
    messages: {
      sunny: '금리가 올랐어요. 예금이 유리해요!',
      rainy: '금리가 내렸어요.',
      cloudy: '금리가 안정적이에요.',
      thunder: '금리가 급변하고 있어요!',
    },
    advice: '금리가 높을 때는 예금과 적금이 유리해요. 금리가 낮을 때는 대출 받기 좋은 시기예요.',
  },
  bonds2y: {
    name: '미국 2년물 국채',
    category: 'bonds',
    getStatus: (_, change) => getBondsStatus(change),
    formatPrice: (p) => `${p.toFixed(2)}%`,
    messages: {
      sunny: '단기 금리가 올랐어요!',
      rainy: '단기 금리가 내렸어요.',
      cloudy: '단기 금리가 안정적이에요.',
      thunder: '단기 금리가 급변하고 있어요!',
    },
    advice: '2년물 국채 금리는 연준의 금리 정책 기대를 반영해요. 장단기 금리 차이도 중요한 지표예요.',
  },
};

function generateMockData(id: AssetType): { price: number; change: number } {
  const configs: Record<AssetType, { base: number; volatility: number }> = {
    usdkrw: { base: 1380, volatility: 50 },
    jpykrw: { base: 9.5, volatility: 0.5 },
    cnykrw: { base: 200, volatility: 10 },
    eurkrw: { base: 1500, volatility: 50 },
    kospi: { base: 2500, volatility: 100 },
    kosdaq: { base: 850, volatility: 50 },
    sp500: { base: 6000, volatility: 100 },
    gold: { base: 2650, volatility: 80 },
    silver: { base: 31, volatility: 2 },
    oil: { base: 70, volatility: 5 },
    bitcoin: { base: 97000, volatility: 5000 },
    ethereum: { base: 3500, volatility: 300 },
    bonds: { base: 4.2, volatility: 0.3 },
    bonds2y: { base: 4.5, volatility: 0.2 },
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
  const assetIds = Object.keys(assetConfigs) as AssetType[];
  
  for (const id of assetIds) {
    let data = rawData[id];
    const config = assetConfigs[id];
    
    if (!data) {
      console.log(`Using mock data for ${id}`);
      data = generateMockData(id);
    }
    
    if (id === 'jpykrw') {
      data = { price: data.price * 100, change: data.change };
    }
    
    const status = config.getStatus(data.price, data.change);
    
    assets.push({
      id,
      name: config.name,
      category: config.category,
      price: data.price,
      priceDisplay: config.formatPrice(data.price),
      change: data.change,
      status,
      message: config.messages[status],
      advice: config.advice,
    });
  }

  return assets;
}

export async function fetchRealMarketData(): Promise<AssetData[]> {
  const rawData = await fetchAllMarketData();
  return convertToAssetData(rawData);
}
