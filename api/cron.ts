import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node'; // ★ 여기 추가됨

// Vercel Serverless Function (Vite/Node.js 환경)
// ★ req, res에 타입을 지정해줘야 빌드 에러가 안 납니다.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 보안 체크
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('Unauthorized');
  }

  // 2. Supabase 클라이언트 설정
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase environment variables missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- Helper Functions ---
  // process.env가 undefined일 수 있으므로 string으로 변환하거나 예외 처리
  const getEnv = (key: string): string => process.env[key] || process.env[`VITE_${key}`] || '';

  async function fetchWithTimeout(url: string, timeout = 8000) {
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

  // --- API Fetchers ---

  // 1. 환율 (ExchangeRate-API)
  async function fetchExchangeRates() {
    try {
      const res = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Exchange fetch failed', e);
      return null;
    }
  }

  // 2. 야후 파이낸스
  async function fetchYahoo(symbol: string) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=5d`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      const result = data.chart?.result?.[0];
      
      if (!result) return null;

      const meta = result.meta;
      const currentPrice = meta.regularMarketPrice;
      const previousClose = meta.previousClose || meta.regularMarketPreviousClose;
      
      return {
        price: currentPrice,
        change: previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0,
        previousClose,
      };
    } catch (e) {
      console.error(`Yahoo ${symbol} failed`, e);
      return null;
    }
  }

  // 3. 코인
  async function fetchCrypto(id: string) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=krw&include_24hr_change=true`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        price: data[id]?.krw,
        change: data[id]?.krw_24h_change
      };
    } catch (e) {
      console.error(`Crypto ${id} failed`, e);
      return null;
    }
  }

  // 4. 오피넷
  async function fetchFuel() {
    const apiKey = getEnv('OPINET_API_KEY');
    if (!apiKey || apiKey === 'DEMO_KEY') return null;
    
    try {
      const url = `https://www.opinet.co.kr/api/avgAllPrice.do?out=json&code=${apiKey}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      const result = data.RESULT?.OIL;
      
      if (!Array.isArray(result)) return null;
      
      const gasoline = result.find((i: any) => i.PRODCD === 'B027');
      const diesel = result.find((i: any) => i.PRODCD === 'D047');
      
      return {
        gasoline: gasoline ? parseFloat(gasoline.PRICE) : null,
        diesel: diesel ? parseFloat(diesel.PRICE) : null
      };
    } catch (e) {
      console.error('Fuel failed', e);
      return null;
    }
  }

  // 5. 부동산
  async function fetchRealEstate() {
    const apiKey = getEnv('REB_API_KEY');
    if (!apiKey) return null;

    try {
      const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?STATBL_ID=A_2024_00900&DTACYCLE_CD=YY&WRTTIME_IDTFR_ID=2022&Type=json&serviceKey=${apiKey}`;
      const res = await fetchWithTimeout(url, 10000);
      if (!res.ok) return null;
      const data = await res.json();
      const items = data.SttsApiTblData?.[1]?.row;
      
      if (!items) return null;

      let target = items.find((i: any) => i.CLS_NM === '전국' || i.CLS_FULLNM?.startsWith('전국'));
      if (!target) target = items.find((i: any) => i.CLS_FULLNM?.startsWith('서울'));
      
      if (!target) return null;
      
      const priceIndex = parseFloat(target.DTA_VAL);
      const gangnamPrice = (priceIndex / 100) * 25;

      return { price: gangnamPrice, originalIndex: priceIndex };
    } catch (e) {
      console.error('RealEstate failed', e);
      return null;
    }
  }

  // 6. ECOS
  async function fetchECOS(statCode: string, itemCode: string, cycle = 'M') {
    const apiKey = getEnv('ECOS_API_KEY');
    if (!apiKey) return null;

    const today = new Date();
    let startDate, endDate;
    
    if (cycle === 'D') {
      const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = today.toISOString().slice(0,10).replace(/-/g, '');
      startDate = start.toISOString().slice(0,10).replace(/-/g, '');
    } else {
      endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
      const startYear = today.getFullYear() - 1;
      startDate = `${startYear}${String(today.getMonth() + 1).padStart(2, '0')}`;
    }

    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/${statCode}/${cycle}/${startDate}/${endDate}/${itemCode}`;
    
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      const rows = data.StatisticSearch?.row;
      if (!rows || rows.length === 0) return null;
      
      const latest = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : null;
      
      const price = parseFloat(latest.DATA_VALUE);
      const prevPrice = prev ? parseFloat(prev.DATA_VALUE) : price;
      
      return { price, change: price - prevPrice };
    } catch (e) {
      console.error(`ECOS ${itemCode} failed`, e);
      return null;
    }
  }

  // --- Main Execution ---
  try {
    console.log("Cron 작업 시작...");

    const [
      exchange,
      usdkrw,
      dowjones, kospi, kosdaq, nasdaq, sp500,
      gold, silver,
      btc, eth,
      fuel,
      realEstate,
      bokRate,
      bond3y, bond10y,
      usBond10y, usBond2y,
      cpi, ppi, ccsi
    ] = await Promise.all([
      fetchExchangeRates(),
      fetchYahoo('KRW=X'),
      fetchYahoo('^DJI'), fetchYahoo('^KS11'), fetchYahoo('^KQ11'), fetchYahoo('^IXIC'), fetchYahoo('^GSPC'),
      fetchYahoo('GC=F'), fetchYahoo('SI=F'),
      fetchCrypto('bitcoin'), fetchCrypto('ethereum'),
      fetchFuel(),
      fetchRealEstate(),
      fetchECOS('722Y001', '0101000', 'M'),
      fetchECOS('817Y002', '010200000', 'D'),
      fetchECOS('817Y002', '010210000', 'D'),
      fetchYahoo('^TNX'), fetchYahoo('^IRX'),
      fetchECOS('901Y009', '0', 'M'),
      fetchECOS('901Y010', '0', 'M'),
      fetchECOS('511Y002', 'FME/99988', 'M')
    ]);

    const usdPrice = exchange?.rates?.KRW || usdkrw?.price || 1400;

    const updates: any[] = [
      { category: 'usdkrw', payload: { price: usdPrice, change: usdkrw?.change }, updated_at: new Date() },
      { category: 'jpykrw', payload: { price: (usdPrice / (exchange?.rates?.JPY || 1)) * 100 }, updated_at: new Date() },
      { category: 'eurkrw', payload: { price: usdPrice / (exchange?.rates?.EUR || 1) }, updated_at: new Date() },
      { category: 'kospi', payload: kospi, updated_at: new Date() },
      { category: 'kosdaq', payload: kosdaq, updated_at: new Date() },
      { category: 'nasdaq', payload: nasdaq, updated_at: new Date() },
      { category: 'dowjones', payload: dowjones, updated_at: new Date() },
      { category: 'sp500', payload: sp500, updated_at: new Date() },
      { category: 'gold', payload: gold, updated_at: new Date() },
      { category: 'silver', payload: silver, updated_at: new Date() },
      { category: 'gasoline', payload: { price: fuel?.gasoline }, updated_at: new Date() },
      { category: 'diesel', payload: { price: fuel?.diesel }, updated_at: new Date() },
      { category: 'bitcoin', payload: btc, updated_at: new Date() },
      { category: 'ethereum', payload: eth, updated_at: new Date() },
      { category: 'kbrealestate', payload: realEstate, updated_at: new Date() },
      { category: 'bokrate', payload: bokRate, updated_at: new Date() },
      { category: 'bonds', payload: usBond10y, updated_at: new Date() },
      { category: 'bonds2y', payload: usBond2y, updated_at: new Date() },
      { category: 'krbond3y', payload: bond3y, updated_at: new Date() },
      { category: 'krbond10y', payload: bond10y, updated_at: new Date() },
      { category: 'cpi', payload: cpi, updated_at: new Date() },
      { category: 'ppi', payload: ppi, updated_at: new Date() },
      { category: 'ccsi', payload: ccsi, updated_at: new Date() },
    ];

    const validUpdates = updates.filter(u => u.payload && (u.payload.price !== undefined && u.payload.price !== null));

    const { error } = await supabase
      .from('market_data')
      .upsert(validUpdates);

    if (error) throw error;

    console.log("Cron 업데이트 완료:", validUpdates.length, "개 항목");
    return res.status(200).json({ message: 'Market data updated', count: validUpdates.length });

  } catch (error: any) {
    console.error("Cron 에러:", error);
    return res.status(500).json({ error: error.message });
  }
}
