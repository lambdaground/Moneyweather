import type { AssetData, AssetType, WeatherStatus, AssetCategory } from "@shared/schema";

interface RawMarketData {
  usdkrw: { price: number; change: number } | null;
  jpykrw: { price: number; change: number } | null;
  cnykrw: { price: number; change: number } | null;
  eurkrw: { price: number; change: number } | null;
  dowjones: { price: number; change: number; chartData?: any[] } | null;
  kospi: { price: number; change: number; chartData?: any[] } | null;
  kosdaq: { price: number; change: number; chartData?: any[] } | null;
  nasdaq: { price: number; change: number; chartData?: any[] } | null;
  sp500: { price: number; change: number; chartData?: any[] } | null;
  gold: { price: number; change: number } | null;
  silver: { price: number; change: number } | null;
  gasoline: { price: number; change: number } | null;
  diesel: { price: number; change: number } | null;
  kbrealestate: { price: number; change: number } | null;
  bitcoin: { price: number; change: number } | null;
  ethereum: { price: number; change: number } | null;
  bonds: { price: number; change: number; previousClose?: number } | null;
  bonds2y: { price: number; change: number; previousClose?: number } | null;
  bokrate: { price: number; change: number } | null;
  krbond3y: { price: number; change: number } | null;
  krbond10y: { price: number; change: number } | null;
  yieldspread: { price: number; change: number } | null;
  cpi: { price: number; change: number } | null;
  ppi: { price: number; change: number } | null;
  ccsi: { price: number; change: number } | null;
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
    rates.usdkrw = {
      price: usdkrwPrice,
      change: previousRates.usdkrw
        ? parseFloat((((usdkrwPrice - previousRates.usdkrw) / previousRates.usdkrw) * 100).toFixed(2))
        : 0,
      previousClose: previousRates.usdkrw || usdkrwPrice
    };
    previousRates.usdkrw = usdkrwPrice;

    if (jpyPerUsd) {
      const jpykrwPrice = krwPerUsd / jpyPerUsd;
      rates.jpykrw = {
        price: jpykrwPrice,
        change: previousRates.jpykrw
          ? parseFloat((((jpykrwPrice - previousRates.jpykrw) / previousRates.jpykrw) * 100).toFixed(2))
          : 0,
        previousClose: previousRates.jpykrw || jpykrwPrice
      };
      previousRates.jpykrw = jpykrwPrice;
    }

    if (cnyPerUsd) {
      const cnykrwPrice = krwPerUsd / cnyPerUsd;
      rates.cnykrw = {
        price: cnykrwPrice,
        change: previousRates.cnykrw
          ? parseFloat((((cnykrwPrice - previousRates.cnykrw) / previousRates.cnykrw) * 100).toFixed(2))
          : 0,
        previousClose: previousRates.cnykrw || cnykrwPrice
      };
      previousRates.cnykrw = cnykrwPrice;
    }

    if (eurPerUsd) {
      const eurkrwPrice = krwPerUsd / eurPerUsd;
      rates.eurkrw = {
        price: eurkrwPrice,
        change: previousRates.eurkrw
          ? parseFloat((((eurkrwPrice - previousRates.eurkrw) / previousRates.eurkrw) * 100).toFixed(2))
          : 0,
        previousClose: previousRates.eurkrw || eurkrwPrice
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
        acc + parseFloat(item.DTA_VAL),
        0
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
    // ECOS API: 한국은행 기준금리 통계표 코드 722Y001, 항목코드 0101000
    // 최근 2개월 데이터 조회 (월별)
    const today = new Date();
    const endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const startYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const startMonth = today.getMonth() === 0 ? 12 : today.getMonth();
    const startDate = `${startYear}${String(startMonth).padStart(2, '0')}`;

    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/722Y001/M/${startDate}/${endDate}/0101000`;

    console.log('Fetching BOK base rate from ECOS API:', url.replace(apiKey, '***'));
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) {
      console.log('ECOS API not accessible, status:', response.status);
      return null;
    }

    const data = await response.json();

    // API 응답 구조 확인
    if (!data.StatisticSearch || data.StatisticSearch.RESULT) {
      const result = data.StatisticSearch?.RESULT;
      console.log('ECOS API error:', result?.MESSAGE || 'Unknown error');
      return null;
    }

    const searchResult = data.StatisticSearch.row;

    if (!searchResult || !Array.isArray(searchResult) || searchResult.length === 0) {
      console.log('No data in ECOS API response');
      return null;
    }

    // 가장 최신 데이터
    const latestRow = searchResult[searchResult.length - 1];
    const currentRate = parseFloat(latestRow.DATA_VALUE);

    if (isNaN(currentRate)) {
      console.log('Invalid data value:', latestRow.DATA_VALUE);
      return null;
    }

    let change = 0;
    if (searchResult.length >= 2) {
      const previousRow = searchResult[searchResult.length - 2];
      const previousRate = parseFloat(previousRow.DATA_VALUE);
      if (!isNaN(previousRate)) {
        change = currentRate - previousRate;
      }
    } else if (previousBokRate !== null) {
      change = currentRate - previousBokRate;
    }

    previousBokRate = currentRate;

    console.log('BOK Base Rate fetched:', {
      rate: currentRate.toFixed(2) + '%',
      change: change.toFixed(2) + '%p',
      period: latestRow.TIME
    });

    return {
      price: currentRate,
      change: parseFloat(change.toFixed(2))
    };
  } catch (error) {
    console.log('ECOS API error:', error);
    return null;
  }
}

// 국고채 금리 조회 (3년물/10년물)
async function fetchKoreanBondRate(itemCode: string, name: string): Promise<{ price: number; change: number } | null> {
  const apiKey = process.env.ECOS_API_KEY;

  if (!apiKey) {
    console.log(`ECOS API key not configured, using mock data for ${name}`);
    return null;
  }

  try {
    const today = new Date();
    const endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDateStr = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`;

    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/30/817Y002/D/${startDateStr}/${endDate}/${itemCode}`;

    console.log(`Fetching ${name} from ECOS API...`);
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) {
      console.log(`ECOS API for ${name} not accessible, status:`, response.status);
      return null;
    }

    const data = await response.json();

    if (!data.StatisticSearch || data.StatisticSearch.RESULT) {
      console.log(`ECOS API error for ${name}:`, data.StatisticSearch?.RESULT?.MESSAGE || 'Unknown error');
      return null;
    }

    const rows = data.StatisticSearch.row;
    if (!rows || rows.length === 0) {
      console.log(`No data for ${name}`);
      return null;
    }

    const latestRow = rows[rows.length - 1];
    const currentRate = parseFloat(latestRow.DATA_VALUE);

    let change = 0;
    if (rows.length >= 2) {
      const previousRow = rows[rows.length - 2];
      const previousRate = parseFloat(previousRow.DATA_VALUE);
      if (!isNaN(previousRate)) {
        change = currentRate - previousRate;
      }
    }

    console.log(`${name} fetched:`, { rate: currentRate.toFixed(2) + '%', change: change.toFixed(3) + '%p' });

    return { price: currentRate, change: parseFloat(change.toFixed(3)) };
  } catch (error) {
    console.log(`ECOS API error for ${name}:`, error);
    return null;
  }
}

// 소비자물가지수(CPI) 조회
async function fetchCPI(): Promise<{ price: number; change: number } | null> {
  const apiKey = process.env.ECOS_API_KEY;

  if (!apiKey) {
    console.log('ECOS API key not configured, using mock data for CPI');
    return null;
  }

  try {
    const today = new Date();
    const endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const startYear = today.getMonth() <= 1 ? today.getFullYear() - 1 : today.getFullYear();
    const startMonth = today.getMonth() <= 1 ? 12 + today.getMonth() : today.getMonth();
    const startDate = `${startYear}${String(startMonth).padStart(2, '0')}`;

    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/901Y009/M/${startDate}/${endDate}/0`;

    console.log('Fetching CPI from ECOS API...');
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.StatisticSearch || data.StatisticSearch.RESULT) return null;

    const rows = data.StatisticSearch.row;
    if (!rows || rows.length === 0) return null;

    const latestRow = rows[rows.length - 1];
    const currentValue = parseFloat(latestRow.DATA_VALUE);

    let change = 0;
    if (rows.length >= 2) {
      const previousRow = rows[rows.length - 2];
      const previousValue = parseFloat(previousRow.DATA_VALUE);
      if (!isNaN(previousValue)) {
        change = ((currentValue - previousValue) / previousValue) * 100;
      }
    }

    console.log('CPI fetched:', { value: currentValue.toFixed(2), change: change.toFixed(2) + '%' });

    return { price: currentValue, change: parseFloat(change.toFixed(2)) };
  } catch (error) {
    console.log('ECOS API error for CPI:', error);
    return null;
  }
}

// 생산자물가지수(PPI) 조회
async function fetchPPI(): Promise<{ price: number; change: number } | null> {
  const apiKey = process.env.ECOS_API_KEY;

  if (!apiKey) {
    console.log('ECOS API key not configured, using mock data for PPI');
    return null;
  }

  try {
    const today = new Date();
    const endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const startYear = today.getMonth() <= 1 ? today.getFullYear() - 1 : today.getFullYear();
    const startMonth = today.getMonth() <= 1 ? 12 + today.getMonth() : today.getMonth();
    const startDate = `${startYear}${String(startMonth).padStart(2, '0')}`;

    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/901Y010/M/${startDate}/${endDate}/0`;

    console.log('Fetching PPI from ECOS API...');
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.StatisticSearch || data.StatisticSearch.RESULT) return null;

    const rows = data.StatisticSearch.row;
    if (!rows || rows.length === 0) return null;

    const latestRow = rows[rows.length - 1];
    const currentValue = parseFloat(latestRow.DATA_VALUE);

    let change = 0;
    if (rows.length >= 2) {
      const previousRow = rows[rows.length - 2];
      const previousValue = parseFloat(previousRow.DATA_VALUE);
      if (!isNaN(previousValue)) {
        change = ((currentValue - previousValue) / previousValue) * 100;
      }
    }

    console.log('PPI fetched:', { value: currentValue.toFixed(2), change: change.toFixed(2) + '%' });

    return { price: currentValue, change: parseFloat(change.toFixed(2)) };
  } catch (error) {
    console.log('ECOS API error for PPI:', error);
    return null;
  }
}

// 소비자심리지수(CCSI) 조회
async function fetchCCSI(): Promise<{ price: number; change: number } | null> {
  const apiKey = process.env.ECOS_API_KEY;

  if (!apiKey) {
    console.log('ECOS API key not configured, using mock data for CCSI');
    return null;
  }

  try {
    const today = new Date();
    const endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const startYear = today.getMonth() <= 1 ? today.getFullYear() - 1 : today.getFullYear();
    const startMonth = today.getMonth() <= 1 ? 12 + today.getMonth() : today.getMonth();
    const startDate = `${startYear}${String(startMonth).padStart(2, '0')}`;

    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/511Y002/M/${startDate}/${endDate}/FME/99988`;

    console.log('Fetching CCSI from ECOS API...');
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.StatisticSearch || data.StatisticSearch.RESULT) return null;

    const rows = data.StatisticSearch.row;
    if (!rows || rows.length === 0) return null;

    const latestRow = rows[rows.length - 1];
    const currentValue = parseFloat(latestRow.DATA_VALUE);

    let change = 0;
    if (rows.length >= 2) {
      const previousRow = rows[rows.length - 2];
      const previousValue = parseFloat(previousRow.DATA_VALUE);
      if (!isNaN(previousValue)) {
        change = currentValue - previousValue;
      }
    }

    console.log('CCSI fetched:', { value: currentValue.toFixed(1), change: change.toFixed(1) + 'pt' });

    return { price: currentValue, change: parseFloat(change.toFixed(1)) };
  } catch (error) {
    console.log('ECOS API error for CCSI:', error);
    return null;
  }
}

export async function fetchAllMarketData(): Promise<RawMarketData> {
  const [
    exchangeRates,
    dowjones,
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
    krbond3y,
    krbond10y,
    cpi,
    ppi,
    ccsi,
  ] = await Promise.all([
    fetchExchangeRates(),
    fetchYahooFinance('^DJI'),
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
    fetchKoreanBondRate('010200000', '국고채 3년물'),
    fetchKoreanBondRate('010210000', '국고채 10년물'),
    fetchCPI(),
    fetchPPI(),
    fetchCCSI(),
  ]);

  // 장단기 금리차 계산 (10년물 - 3년물)
  let yieldspread: { price: number; change: number } | null = null;
  if (krbond10y && krbond3y) {
    const spread = krbond10y.price - krbond3y.price;
    const prevSpread = (krbond10y.price - krbond10y.change) - (krbond3y.price - krbond3y.change);
    const spreadChange = spread - prevSpread;
    yieldspread = { price: spread, change: parseFloat(spreadChange.toFixed(3)) };
    console.log('Yield spread calculated:', { spread: spread.toFixed(3) + '%p', change: spreadChange.toFixed(3) + '%p' });
  }

  return {
    usdkrw: exchangeRates?.usdkrw ?? null,
    jpykrw: exchangeRates?.jpykrw ?? null,
    cnykrw: exchangeRates?.cnykrw ?? null,
    eurkrw: exchangeRates?.eurkrw ?? null,
    dowjones,
    kospi,
    kosdaq,
    nasdaq,
    sp500,
    gold,
    silver,
    gasoline: koreanFuel?.gasoline ?? null,
    diesel: koreanFuel?.diesel ?? null,
    kbrealestate,
    bitcoin,
    ethereum,
    bonds: bonds10y,
    bonds2y,
    bokrate,
    krbond3y,
    krbond10y,
    yieldspread,
    cpi,
    ppi,
    ccsi,
  };
}

function getCurrencyStatus(price: number, lowThreshold: number, highThreshold: number): WeatherStatus {
  if (price > highThreshold) return 'rainy';
  if (price < lowThreshold) return 'sunny';
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

function getRealEstateStatus(change: number): WeatherStatus {
  if (Math.abs(change) > 2) return 'thunder';
  if (change > 0.5) return 'sunny';
  if (change < -0.5) return 'rainy';
  return 'cloudy';
}

function getFuelStatus(price: number, lowThreshold: number, highThreshold: number): WeatherStatus {
  if (price > highThreshold) return 'rainy';
  if (price < lowThreshold) return 'sunny';
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
    name: '미국 달러 (전일 종가)',
    category: 'currency',
    getStatus: (price) => getCurrencyStatus(price, 1350, 1400),
    formatPrice: (p) => `${p.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} KRW`,
    messages: {
      sunny: '해외직구 타이밍! 달러가 저렴해요.',
      rainy: '달러가 비싸요! 환전은 미루세요.',
      cloudy: '환율이 잠잠해요. 큰 변화가 없네요.',
      thunder: '환율이 요동치고 있어요!',
    },
    advice: '전일 마감 환율(종가) 기준이에요. 실시간 환율과 다를 수 있어요. 환율이 높을 땐 수출 기업 주식이 좋을 수 있어요! 반대로 환율이 낮을 땐 해외여행이나 직구가 유리해요.',
  },
  jpykrw: {
    name: '일본 엔화',
    category: 'currency',
    getStatus: (price) => getCurrencyStatus(price * 100, 900, 950), // 100엔 기준으로 비교
    formatPrice: (p) => `${(p * 100).toFixed(2)} KRW/100엔`, // 1엔 -> 100엔 기준으로 변환
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
  krbond3y: {
    name: '국고채 3년',
    category: 'bonds',
    getStatus: (_, change) => getBondsStatus(change),
    formatPrice: (p) => `${p.toFixed(2)}%`,
    messages: {
      sunny: '3년물 금리가 올랐어요!',
      rainy: '3년물 금리가 내렸어요.',
      cloudy: '3년물 금리가 안정적이에요.',
      thunder: '3년물 금리가 급변하고 있어요!',
    },
    advice: '국고채 3년물은 기업들이 돈을 빌릴 때(회사채) 기준이 되는 금리예요. 단기~중기 경제 상황을 반영해요.',
  },
  krbond10y: {
    name: '국고채 10년',
    category: 'bonds',
    getStatus: (_, change) => getBondsStatus(change),
    formatPrice: (p) => `${p.toFixed(2)}%`,
    messages: {
      sunny: '10년물 금리가 올랐어요!',
      rainy: '10년물 금리가 내렸어요.',
      cloudy: '10년물 금리가 안정적이에요.',
      thunder: '10년물 금리가 급변하고 있어요!',
    },
    advice: '국고채 10년물은 장기적인 경제 성장 전망을 보여줘요. 주택담보대출 금리와도 연관이 있어요.',
  },
  yieldspread: {
    name: '장단기 금리차',
    category: 'bonds',
    getStatus: (price, change) => {
      if (price < 0) return 'thunder';  // 역전 발생
      if (price < 0.2) return 'rainy';  // 역전 임박
      if (change > 0.05) return 'sunny';
      if (change < -0.05) return 'rainy';
      return 'cloudy';
    },
    formatPrice: (p) => `${p >= 0 ? '+' : ''}${p.toFixed(2)}%p`,
    messages: {
      sunny: '금리차가 확대되고 있어요.',
      rainy: '금리차가 축소되고 있어요. 주의!',
      cloudy: '금리차가 안정적이에요.',
      thunder: '금리 역전! 경기 침체 신호!',
    },
    advice: '10년물 금리 - 3년물 금리 차이예요. 이 차이가 마이너스가 되면(역전되면) 경기 침체가 올 신호라고 해석해요. 아주 고급진 지표랍니다!',
  },
  cpi: {
    name: '소비자물가',
    category: 'index',
    getStatus: (price, change) => {
      if (change > 0.5) return 'rainy';   // 물가 상승 = 나쁨
      if (change < -0.2) return 'sunny';  // 물가 하락 = 좋음
      return 'cloudy';
    },
    formatPrice: (p) => `${p.toFixed(1)}`,
    messages: {
      sunny: '물가가 안정되고 있어요!',
      rainy: '물가가 오르고 있어요. 장바구니가 무거워요.',
      cloudy: '물가가 안정적이에요.',
      thunder: '물가가 급등하고 있어요!',
    },
    advice: '"내 월급 빼고 다 오른다"를 숫자로 확인하는 지표예요. 마트에서 사는 물건 가격의 변동을 나타내는 인플레이션 지표입니다.',
  },
  ppi: {
    name: '생산자물가',
    category: 'index',
    getStatus: (price, change) => {
      if (change > 0.5) return 'rainy';
      if (change < -0.2) return 'sunny';
      return 'cloudy';
    },
    formatPrice: (p) => `${p.toFixed(1)}`,
    messages: {
      sunny: '생산 비용이 안정되고 있어요!',
      rainy: '생산 비용이 오르고 있어요.',
      cloudy: '생산 비용이 안정적이에요.',
      thunder: '생산 비용이 급등하고 있어요!',
    },
    advice: '공장에서 물건을 만들 때 드는 비용이에요. PPI가 오르면 나중에 소비자물가(CPI)도 따라 오를 수 있어요.',
  },
  ccsi: {
    name: '소비자심리',
    category: 'index',
    getStatus: (price, change) => {
      if (price >= 110) return 'sunny';   // 강한 낙관
      if (price >= 100) return 'cloudy';  // 낙관
      if (price >= 90) return 'rainy';    // 비관
      return 'thunder';                    // 강한 비관
    },
    formatPrice: (p) => `${p.toFixed(0)}점`,
    messages: {
      sunny: '소비자들이 낙관적이에요! 지갑을 열 준비!',
      rainy: '소비자들이 조심스러워요. 지갑을 닫는 중.',
      cloudy: '소비자 심리가 보통이에요.',
      thunder: '소비자 심리가 얼어붙었어요!',
    },
    advice: '사람들의 마음(심리)을 숫자로 나타낸 거예요. 100 이상이면 "경기가 좋아질 것 같아 지갑을 열자!", 100 미만이면 "먹고살기 힘들어 지갑 닫자"예요. 주식이나 부동산 시장의 선행 지표로 쓰여요.',
  },
  dowjones: {
    name: '다우존스',
    category: 'index',
    getStatus: (_, change) => getIndexStatus(change),
    formatPrice: (p) => `${p.toLocaleString('en-US', { maximumFractionDigits: 2 })} pt`,
    messages: {
      sunny: '다우존스가 상승세입니다!',
      rainy: '다우존스가 하락세입니다.',
      cloudy: '다우존스가 안정적인 흐름을 보입니다.',
      thunder: '다우존스가 크게 움직이고 있습니다!',
    },
    advice: '다우존스 지수는 미국 대표 30개 우량 기업의 주가 평균으로, 미국 경제의 전반적인 건전성을 나타내는 지표입니다.',
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
    bokrate: { base: 3.0, volatility: 0 },
    krbond3y: { base: 2.8, volatility: 0.1 },
    krbond10y: { base: 3.1, volatility: 0.1 },
    yieldspread: { base: 0.3, volatility: 0.05 },
    cpi: { base: 113, volatility: 0.5 },
    ppi: { base: 118, volatility: 0.5 },
    ccsi: { base: 100, volatility: 5 },
    dowjones: { base: 38000, volatility: 200 },
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

  if (previousClose && previousClose > 0) {
    points = price - previousClose;
  } else if (change !== 0 && change > -100) {
    const previousPrice = price / (1 + change / 100);
    points = price - previousPrice;
  } else if (change !== 0) {
    points = change;
  }

  const isIndex = ['kospi', 'kosdaq', 'nasdaq', 'sp500', 'dowjones'].includes(id);
  const isCurrency = ['usdkrw', 'jpykrw', 'cnykrw', 'eurkrw'].includes(id);
  const isBonds = ['bonds', 'bonds2y', 'bokrate', 'krbond3y', 'krbond10y', 'yieldspread'].includes(id);
  const isCrypto = ['bitcoin', 'ethereum'].includes(id);

  let display = '';
  const sign = points >= 0 ? '+' : '';

  if (isIndex) {
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
    const config = assetConfigs[id];
    const data = rawData[id];

    if (!data) {
      console.log(`No data available for ${id}, using mock data.`);
      const mockData = generateMockData(id);
      const { points, display } = formatChangePoints(id, mockData.price, mockData.change);
      const status = config.getStatus(mockData.price, mockData.change);
      const assetData: AssetData = {
        id,
        name: config.name,
        category: config.category,
        price: mockData.price,
        priceDisplay: config.formatPrice(mockData.price),
        change: mockData.change,
        changePoints: points,
        changePointsDisplay: display,
        status,
        message: config.messages[status],
        advice: config.advice,
        chartData: undefined,
      };

      if (config.formatBuyPrice) {
        assetData.buyPrice = mockData.price * 0.97;
        assetData.buyPriceDisplay = config.formatBuyPrice(mockData.price);
      }
      if (config.formatSellPrice) {
        assetData.sellPrice = mockData.price * 1.03;
        assetData.sellPriceDisplay = config.formatSellPrice(mockData.price);
      }

      assets.push(assetData);
      continue;
    }

    let priceForDisplay = data.price;
    let chartData = (data as any).chartData;

    if (id === 'jpykrw') {
      priceForDisplay = data.price * 100;
      if (chartData) {
        chartData = chartData.map((d: { time: string; price: number }) => ({ ...d, price: d.price * 100 }));
      }
    }

    const { points, display } = formatChangePoints(id, priceForDisplay, data.change, (data as any).previousClose);
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