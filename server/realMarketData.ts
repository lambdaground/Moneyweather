import type { AssetData, AssetType, WeatherStatus, AssetCategory } from "@shared/schema";

interface RawMarketData {
  [key: string]: { price: number; change: number; previousClose?: number; chartData?: { time: string; price: number }[] } | null;
}

let cachedUsdKrw: number = 1400;

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

async function fetchExchangeRates(): Promise<Record<string, { price: number; change: number; previousClose?: number } | null>> {
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
    
    cachedUsdKrw = krwPerUsd;
    
    const rates: Record<string, { price: number; change: number; previousClose?: number } | null> = {};
    
    const usdkrwPrice = krwPerUsd;
    const prevUsdkrw = previousRates.usdkrw || usdkrwPrice;
    rates.usdkrw = {
      price: usdkrwPrice,
      change: previousRates.usdkrw 
        ? parseFloat((((usdkrwPrice - previousRates.usdkrw) / previousRates.usdkrw) * 100).toFixed(2))
        : 0,
      previousClose: prevUsdkrw
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

async function fetchYahooFinance(symbol: string): Promise<{ price: number; change: number; previousClose?: number; chartData?: { time: string; price: number }[] } | null> {
  try {
    const response = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=5d`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const prevClose = meta?.chartPreviousClose || meta?.previousClose;
    
    if (!price) return null;
    
    const isPercentage = symbol === '%5ETNX' || symbol === '^TNX' || symbol === '^IRX';
    const change = prevClose 
      ? isPercentage 
        ? price - prevClose
        : ((price - prevClose) / prevClose) * 100 
      : 0;
    
    const chartData: { time: string; price: number }[] = [];
    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    
    if (timestamps && quotes?.close) {
      for (let i = 0; i < timestamps.length; i++) {
        const closePrice = quotes.close[i];
        if (closePrice !== null && closePrice !== undefined) {
          const date = new Date(timestamps[i] * 1000);
          chartData.push({
            time: date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            price: closePrice
          });
        }
      }
    }
    
    return { 
      price, 
      change: parseFloat(change.toFixed(2)),
      previousClose: prevClose,
      chartData: chartData.length > 0 ? chartData : undefined
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

let previousFearGreedValue: number | null = null;

async function fetchFearGreed(): Promise<{ price: number; change: number } | null> {
  try {
    const response = await fetchWithTimeout(
      'https://api.alternative.me/fng/?limit=2'
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    const current = data.data?.[0];
    const previous = data.data?.[1];
    
    if (!current) return null;
    
    const currentValue = parseInt(current.value, 10);
    const previousValue = previous ? parseInt(previous.value, 10) : previousFearGreedValue;
    
    const change = previousValue !== null ? currentValue - previousValue : 0;
    previousFearGreedValue = currentValue;
    
    return { 
      price: currentValue,
      change: parseFloat(change.toFixed(2))
    };
  } catch (error) {
    console.error('Failed to fetch Fear & Greed:', error);
    return null;
  }
}

let previousGasolinePrice: number | null = null;
let previousDieselPrice: number | null = null;

async function fetchKoreanFuelPrices(): Promise<Record<string, { price: number; change: number } | null>> {
  try {
    const apiKey = process.env.OPINET_API_KEY || 'DEMO_KEY';
    const response = await fetchWithTimeout(
      `https://www.opinet.co.kr/api/avgAllPrice.do?out=json&code=${apiKey}`,
      8000
    );
    
    if (!response.ok) {
      console.log('Opinet API not accessible, using realistic Korean fuel prices');
      return { gasoline: null, diesel: null };
    }
    
    const data = await response.json();
    const result = data.RESULT?.OIL;
    
    if (!result || !Array.isArray(result)) {
      return { gasoline: null, diesel: null };
    }
    
    const rates: Record<string, { price: number; change: number } | null> = {};
    
    for (const item of result) {
      if (item.PRODCD === 'B027') {
        const price = parseFloat(item.PRICE);
        const change = previousGasolinePrice 
          ? ((price - previousGasolinePrice) / previousGasolinePrice) * 100 
          : 0;
        rates.gasoline = { price, change: parseFloat(change.toFixed(2)) };
        previousGasolinePrice = price;
      }
      if (item.PRODCD === 'D047') {
        const price = parseFloat(item.PRICE);
        const change = previousDieselPrice 
          ? ((price - previousDieselPrice) / previousDieselPrice) * 100 
          : 0;
        rates.diesel = { price, change: parseFloat(change.toFixed(2)) };
        previousDieselPrice = price;
      }
    }
    
    return rates;
  } catch (error) {
    console.log('Korean fuel API unavailable, using mock data');
    return { gasoline: null, diesel: null };
  }
}

let previousRealEstatePrice: number | null = null;

async function fetchRealEstateIndex(): Promise<{ price: number; change: number } | null> {
  try {
    const apiKey = process.env.REB_API_KEY;
    if (!apiKey) {
      console.log('REB API key not configured');
      return null;
    }
    
    // 부동산통계정보시스템 API - 주택종합 매매가격지수
    const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?STATBL_ID=A_2024_00900&DTACYCLE_CD=YY&WRTTIME_IDTFR_ID=2022&Type=json&serviceKey=${apiKey}`;
    
    const response = await fetchWithTimeout(url, 10000);
    
    if (!response.ok) {
      console.log('REB Real Estate API not accessible, status:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // API 응답 구조: {"SttsApiTblData": [{"head": [...]}, {"row": [...]}]}
    const apiData = data.SttsApiTblData;
    if (!apiData || !Array.isArray(apiData) || apiData.length < 2) {
      console.log('Unexpected REB API response structure');
      return null;
    }
    
    const rowSection = apiData.find((item: any) => item.row);
    const items = rowSection?.row || [];
    
    if (!items || items.length === 0) {
      console.log('No row data in REB API response');
      return null;
    }
    
    // 전국 데이터 찾기 (CLS_FULLNM이 '전국'으로 시작하는 항목)
    let nationalData = items.find((item: any) => 
      item.CLS_NM === '전국' || 
      item.CLS_FULLNM === '전국' ||
      (item.CLS_FULLNM && item.CLS_FULLNM.startsWith('전국'))
    );
    
    // 전국 데이터가 없으면 서울 데이터 찾기
    if (!nationalData) {
      nationalData = items.find((item: any) => 
        item.CLS_FULLNM && item.CLS_FULLNM.startsWith('서울')
      );
    }
    
    // 서울도 없으면 모든 지역의 평균 계산
    let price: number;
    if (!nationalData) {
      const validItems = items.filter((item: any) => 
        item.DTA_VAL && !isNaN(parseFloat(item.DTA_VAL))
      );
      
      if (validItems.length === 0) {
        console.log('No valid data items in REB API response');
        return null;
      }
      
      const sum = validItems.reduce((acc: number, item: any) => 
        acc + parseFloat(item.DTA_VAL), 0
      );
      price = sum / validItems.length;
      console.log(`REB: Using average of ${validItems.length} regions: ${price.toFixed(2)}`);
    } else {
      price = parseFloat(nationalData.DTA_VAL);
      console.log(`REB: Found data for ${nationalData.CLS_FULLNM || nationalData.CLS_NM}: ${price}`);
    }
    
    const change = previousRealEstatePrice
      ? ((price - previousRealEstatePrice) / previousRealEstatePrice) * 100
      : 0;
    
    previousRealEstatePrice = price;
    
    // 지수를 강남 30평 아파트 시세로 변환 (100 = 25억원 기준)
    const gangnamPrice = (price / 100) * 25;
    
    console.log('Gangnam Apartment Price calculated:', { 
      originalIndex: price.toFixed(2), 
      gangnamPrice: gangnamPrice.toFixed(2) + '억', 
      change: change.toFixed(2) + '%' 
    });
    
    return { 
      price: gangnamPrice,
      change: parseFloat(change.toFixed(2))
    };
  } catch (error) {
    console.log('REB Real Estate API error:', error);
    return null;
  }
}

// 한국은행 ECOS API - 기준금리 데이터
let previousBokRate: number | null = null;
let lastFetch: number = 0;
const FETCH_INTERVAL = 86400000; // 1일(밀리초)

async function fetchBokBaseRate(): Promise<{ price: number; change: number } | null> {
  const apiKey = process.env.ECOS_API_KEY;
  
  if (!apiKey) {
    console.log('ECOS API key not configured, using mock data for BOK rate');
    return null;
  }
  
  const now = Date.now();
  if (now - lastFetch < FETCH_INTERVAL) {
    console.log('Using cached BOK base rate data');
    return previousBokRate ? { price: previousBokRate, change: 0 } : null;
  }
  
  lastFetch = now;
  
  try {
    // ECOS API: 한국은행 기준금리 통계표 코드 722Y001
    // 최근 2개월 데이터 조회 (월별)
    const today = new Date();
    const endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const startYear = today.getMonth() <= 1 ? today.getFullYear() - 1 : today.getFullYear();
    const startMonth = today.getMonth() <= 1 ? 12 + today.getMonth() : today.getMonth();
    const startDate = `${startYear}${String(startMonth).padStart(2, '0')}`;
    
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/722Y001/M/${startDate}/${endDate}/0101000`;
    
    console.log('Fetching BOK base rate from ECOS API...');
    const response = await fetchWithTimeout(url, 10000);
    
    if (!response.ok) {
      console.log('ECOS API not accessible, status:', response.status);
      return null;
    }
    
    const data = await response.json();
    const searchResult = data.StatisticSearch.row;
    
    if (!searchResult || !searchResult.length) {
      console.log('No data in ECOS API response');
      return null;
    }
    
    // 가장 최신 데이터
    const latestRow = searchResult[searchResult.length - 1];
    const currentRate = parseFloat(latestRow.DATA_VALUE);
    
    let change = 0;
    if (searchResult.length >= 2) {
      const previousRow = searchResult[searchResult.length - 2];
      const previousRate = parseFloat(previousRow.DATA_VALUE);
      change = currentRate - previousRate;  // 변화 계산
    } else if (previousBokRate !== null) {
      change = currentRate - previousBokRate;
    }
    
    previousBokRate = currentRate;
    
    console.log('BOK Base Rate fetched:', { rate: currentRate.toFixed(2) + '%', change: change.toFixed(2) + '%p' });
    
    return { 
      price: currentRate,
      change: parseFloat(change.toFixed(2))
    };
  } catch (error) {
    console.log('ECOS API error:', error);
    return null;
  }
}

export async function fetchAllMarketData(): Promise<RawMarketData> {
  const [
    exchangeRates,
    feargreed,
    kospi,
    kosdaq,
    nasdaq,
    sp500,
    gold,
    silver,
    koreanFuel,
    kbrealestate,
    bitcoin,
    ethereum,
    bonds10y,
    bonds2y,
    bokrate,
  ] = await Promise.all([
    fetchExchangeRates(),
    fetchFearGreed(),
    fetchYahooFinance('^KS11'),
    fetchYahooFinance('^KQ11'),
    fetchYahooFinance('^IXIC'),
    fetchYahooFinance('^GSPC'),
    fetchYahooFinance('GC=F'),
    fetchYahooFinance('SI=F'),
    fetchKoreanFuelPrices(),
    fetchRealEstateIndex(),
    fetchCrypto('bitcoin'),
    fetchCrypto('ethereum'),
    fetchYahooFinance('^TNX'),
    fetchYahooFinance('^IRX'),
    fetchBokBaseRate(),
  ]);

  return { 
    ...exchangeRates,
    feargreed,
    kospi, 
    kosdaq,
    nasdaq,
    sp500,
    gold, 
    silver,
    gasoline: koreanFuel.gasoline,
    diesel: koreanFuel.diesel,
    kbrealestate,
    bitcoin, 
    ethereum,
    bonds: bonds10y,
    bonds2y,
    bokrate,
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

function getFearGreedStatus(value: number, change: number): WeatherStatus {
  if (Math.abs(change) >= 15) return 'thunder';
  if (value >= 70) return 'sunny';
  if (value >= 50) return 'cloudy';
  if (value >= 30) return 'rainy';
  return 'thunder';
}

function getRealEstateStatus(change: number): WeatherStatus {
  if (Math.abs(change) > 2) return 'thunder';
  if (change > 0.5) return 'sunny';
  if (change < -0.5) return 'rainy';
  return 'cloudy';
}

function getFuelStatus(price: number, baseLow: number, baseHigh: number): WeatherStatus {
  if (price > baseHigh) return 'rainy';
  if (price < baseLow) return 'sunny';
  return 'cloudy';
}

interface AssetConfig {
  name: string;
  category: AssetCategory;
  getStatus: (price: number, change: number) => WeatherStatus;
  formatPrice: (price: number) => string;
  formatBuyPrice?: (price: number) => string;
  formatSellPrice?: (price: number) => string;
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
  feargreed: {
    name: '공포 탐욕 지수',
    category: 'index',
    getStatus: (price, change) => getFearGreedStatus(price, change),
    formatPrice: (p) => `${p.toFixed(0)}점`,
    messages: {
      sunny: '탐욕 구간! 시장이 낙관적이에요.',
      rainy: '공포 구간! 시장이 불안해해요.',
      cloudy: '중립 구간. 시장이 관망 중이에요.',
      thunder: '극단적 공포! 대폭락 주의보!',
    },
    advice: '공포 지수가 극단적으로 낮을 때가 오히려 매수 기회일 수 있어요. "남들이 공포에 떨 때 탐욕을 부려라"는 워렌 버핏의 말처럼요!',
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
  nasdaq: {
    name: '나스닥',
    category: 'index',
    getStatus: (_, change) => getIndexStatus(change),
    formatPrice: (p) => `${p.toLocaleString('en-US', { maximumFractionDigits: 2 })} pt`,
    messages: {
      sunny: '나스닥이 불타오르고 있어요!',
      rainy: '나스닥이 쉬어가는 중이에요.',
      cloudy: '나스닥이 조용하네요.',
      thunder: '나스닥이 요동쳐요! 기술주 주의보!',
    },
    advice: '나스닥은 애플, 구글, 마이크로소프트 등 미국 기술주 중심 지수예요. 변동성이 크지만 성장 잠재력도 높아요.',
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
    formatPrice: (p) => {
      const pricePerDon = p * cachedUsdKrw * (3.75 / 31.1035);
      return `${Math.round(pricePerDon).toLocaleString('ko-KR')}원/돈`;
    },
    formatBuyPrice: (p) => {
      const pricePerDon = p * cachedUsdKrw * (3.75 / 31.1035) * 0.97;
      return `${Math.round(pricePerDon).toLocaleString('ko-KR')}원`;
    },
    formatSellPrice: (p) => {
      const pricePerDon = p * cachedUsdKrw * (3.75 / 31.1035) * 1.03;
      return `${Math.round(pricePerDon).toLocaleString('ko-KR')}원`;
    },
    messages: {
      sunny: '금값이 올랐어요! 안전자산 인기 상승!',
      rainy: '금값이 내렸어요. 세상이 평화로운가 봐요.',
      cloudy: '금값이 안정적이에요.',
      thunder: '금값이 크게 움직이고 있어요!',
    },
    advice: '금은 경제가 불안할 때 가치가 오르는 안전자산이에요. 포트폴리오의 10~15%를 금으로 가져가면 안정적이에요. 한 돈은 3.75g이에요.',
  },
  silver: {
    name: '은',
    category: 'commodity',
    getStatus: (_, change) => getCommodityStatus(change),
    formatPrice: (p) => {
      const pricePerDon = p * cachedUsdKrw * (3.75 / 31.1035);
      return `${Math.round(pricePerDon).toLocaleString('ko-KR')}원/돈`;
    },
    formatBuyPrice: (p) => {
      const pricePerDon = p * cachedUsdKrw * (3.75 / 31.1035) * 0.95;
      return `${Math.round(pricePerDon).toLocaleString('ko-KR')}원`;
    },
    formatSellPrice: (p) => {
      const pricePerDon = p * cachedUsdKrw * (3.75 / 31.1035) * 1.05;
      return `${Math.round(pricePerDon).toLocaleString('ko-KR')}원`;
    },
    messages: {
      sunny: '은값이 올랐어요!',
      rainy: '은값이 내렸어요.',
      cloudy: '은값이 안정적이에요.',
      thunder: '은값이 크게 움직이고 있어요!',
    },
    advice: '은은 금보다 변동성이 크지만, 산업용으로도 많이 쓰여서 수요가 꾸준해요. 한 돈은 3.75g이에요.',
  },
  gasoline: {
    name: '휘발유',
    category: 'commodity',
    getStatus: (price) => getFuelStatus(price, 1600, 1750),
    formatPrice: (p) => `${p.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원/L`,
    messages: {
      sunny: '휘발유가 저렴해요! 주유하기 좋은 때!',
      rainy: '휘발유가 비싸요. 대중교통 고려해보세요.',
      cloudy: '휘발유 가격이 평균이에요.',
      thunder: '유가가 급변하고 있어요!',
    },
    advice: '기름값이 오를 때는 연비 좋은 운전 습관을 들이세요. 급출발, 급가속을 피하면 연비가 10%까지 좋아져요!',
  },
  diesel: {
    name: '경유',
    category: 'commodity',
    getStatus: (price) => getFuelStatus(price, 1500, 1650),
    formatPrice: (p) => `${p.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원/L`,
    messages: {
      sunny: '경유가 저렴해요!',
      rainy: '경유가 비싸요.',
      cloudy: '경유 가격이 안정적이에요.',
      thunder: '경유 가격이 급변하고 있어요!',
    },
    advice: '경유차는 장거리 운전에 유리해요. 출퇴근 거리가 길다면 경유차가 유지비를 절약할 수 있어요.',
  },
  kbrealestate: {
    name: '강남 아파트',
    category: 'commodity',
    getStatus: (_, change) => getRealEstateStatus(change),
    formatPrice: (p) => {
      // p는 억원 단위로 저장됨 (예: 25 = 25억원)
      return `${p.toFixed(1)}억 (30평)`;
    },
    messages: {
      sunny: '강남 집값이 오르고 있어요!',
      rainy: '강남 집값이 조정 중이에요.',
      cloudy: '강남 집값이 안정적이에요.',
      thunder: '강남 집값이 크게 움직이고 있어요!',
    },
    advice: '강남 30평 아파트 평균 시세예요. 서울 아파트 시장의 바로미터로, 전체 부동산 시장의 방향을 가늠할 수 있어요. 금리 인상기에는 집값이 조정되는 경향이 있어요.',
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
  bokrate: {
    name: '한국 기준금리',
    category: 'bonds',
    getStatus: (price, change) => {
      if (Math.abs(change) >= 0.25) return 'thunder';
      if (change > 0) return 'sunny';
      if (change < 0) return 'rainy';
      return 'cloudy';
    },
    formatPrice: (p) => `${p.toFixed(2)}%`,
    messages: {
      sunny: '한은이 금리를 올렸어요!',
      rainy: '한은이 금리를 내렸어요.',
      cloudy: '기준금리가 동결됐어요.',
      thunder: '기준금리가 크게 변동했어요!',
    },
    advice: '한국은행 기준금리는 대출금리와 예금금리에 영향을 줘요. 금리가 오르면 대출 이자가 늘어나고, 예금 이자도 올라요.',
  },
};

function generateMockData(id: AssetType): { price: number; change: number } {
  const configs: Record<AssetType, { base: number; volatility: number }> = {
    usdkrw: { base: 1380, volatility: 50 },
    jpykrw: { base: 9.5, volatility: 0.5 },
    cnykrw: { base: 200, volatility: 10 },
    eurkrw: { base: 1500, volatility: 50 },
    feargreed: { base: 50, volatility: 20 },
    kospi: { base: 2500, volatility: 100 },
    kosdaq: { base: 850, volatility: 50 },
    nasdaq: { base: 19500, volatility: 300 },
    sp500: { base: 6000, volatility: 100 },
    gold: { base: 2650, volatility: 80 },
    silver: { base: 31, volatility: 2 },
    gasoline: { base: 1700, volatility: 50 },
    diesel: { base: 1600, volatility: 50 },
    kbrealestate: { base: 25, volatility: 0.5 },  // 강남 30평 아파트 25억원 기준
    bitcoin: { base: 97000, volatility: 5000 },
    ethereum: { base: 3500, volatility: 300 },
    bonds: { base: 4.2, volatility: 0.3 },
    bonds2y: { base: 4.5, volatility: 0.2 },
    bokrate: { base: 3.0, volatility: 0 },  // 한국 기준금리 현재 3.0%
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

function formatChangePoints(id: AssetType, price: number, change: number, previousClose?: number): { points: number; display: string } {
  let points = 0;
  
  if (id === 'feargreed') {
    points = change;
  } else if (previousClose && previousClose > 0) {
    points = price - previousClose;
  } else if (change !== 0 && change > -100) {
    const previousPrice = price / (1 + change / 100);
    points = price - previousPrice;
  } else if (change !== 0) {
    points = change;
  }
  
  const isIndex = ['kospi', 'kosdaq', 'nasdaq', 'sp500'].includes(id);
  const isCurrency = ['usdkrw', 'jpykrw', 'cnykrw', 'eurkrw'].includes(id);
  const isBonds = ['bonds', 'bonds2y', 'bokrate'].includes(id);
  const isCrypto = ['bitcoin', 'ethereum'].includes(id);
  
  let display = '';
  const sign = points >= 0 ? '+' : '';
  
  if (id === 'feargreed') {
    display = `${sign}${Math.round(points)}점`;
  } else if (isIndex) {
    display = `${sign}${points.toFixed(2)}pt`;
  } else if (isCurrency) {
    if (id === 'jpykrw') {
      display = `${sign}${points.toFixed(2)}원`;
    } else {
      display = `${sign}${points.toFixed(0)}원`;
    }
  } else if (isBonds) {
    display = `${sign}${points.toFixed(2)}%p`;
  } else if (isCrypto) {
    display = `${sign}$${Math.abs(points).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  } else if (id === 'gold' || id === 'silver') {
    const krwPointsPerDon = points * cachedUsdKrw * (3.75 / 31.1035);
    display = `${sign}${Math.round(krwPointsPerDon).toLocaleString('ko-KR')}원`;
  } else if (id === 'gasoline' || id === 'diesel') {
    display = `${sign}${Math.round(points)}원`;
  } else if (id === 'kbrealestate') {
    // 강남 아파트는 억원 단위로 표시
    display = `${sign}${(points * 1000).toFixed(0)}만원`;
  } else {
    display = `${sign}${points.toFixed(2)}`;
  }
  
  return { points, display };
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
    
    let priceForDisplay = data.price;
    let chartData = data.chartData;
    
    if (id === 'jpykrw') {
      priceForDisplay = data.price * 100;
      if (chartData) {
        chartData = chartData.map(d => ({ ...d, price: d.price * 100 }));
      }
    }
    
    const { points, display } = formatChangePoints(id, priceForDisplay, data.change, data.previousClose);
    const status = config.getStatus(priceForDisplay, data.change);
    
    const assetData: AssetData = {
      id,
      name: config.name,
      category: config.category,
      price: priceForDisplay,
      priceDisplay: config.formatPrice(data.price),
      change: data.change,
      changePoints: points,
      changePointsDisplay: display,
      status,
      message: config.messages[status],
      advice: config.advice,
      chartData,
    };
    
    if (config.formatBuyPrice) {
      assetData.buyPrice = data.price * 0.97;
      assetData.buyPriceDisplay = config.formatBuyPrice(data.price);
    }
    if (config.formatSellPrice) {
      assetData.sellPrice = data.price * 1.03;
      assetData.sellPriceDisplay = config.formatSellPrice(data.price);
    }
    
    assets.push(assetData);
  }

  return assets;
}

export async function fetchRealMarketData(): Promise<AssetData[]> {
  const rawData = await fetchAllMarketData();
  return convertToAssetData(rawData);
}
