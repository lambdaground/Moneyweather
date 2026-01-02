// server/cron-job.ts
import { createClient } from '@supabase/supabase-js';

export async function runCronJob(isManualRun: boolean = false) {
  // 1. Supabase 설정
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 환경변수 누락 (SERVICE_ROLE_KEY 확인 필요)');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const getEnv = (key: string): string => process.env[key] || process.env[`VITE_${key}`] || '';

  // --- Helper: Fetch with Timeout ---
  async function fetchWithTimeout(url: string, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // --- Data Fetchers ---
  async function fetchExchangeRates() {
    try {
      const res = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

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
      return { price: currentPrice, change: previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0 };
    } catch (e) { return null; }
  }

  async function fetchCrypto(id: string) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=krw&include_24hr_change=true`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      return { price: data[id]?.krw, change: data[id]?.krw_24h_change };
    } catch (e) { return null; }
  }

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
      return { gasoline: gasoline ? parseFloat(gasoline.PRICE) : null, diesel: diesel ? parseFloat(diesel.PRICE) : null };
    } catch (e) { return null; }
  }

  async function fetchRealEstate() {
    const apiKey = getEnv('REB_API_KEY');
    if (!apiKey) return null;
    try {
      const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?STATBL_ID=A_2024_00900&DTACYCLE_CD=YY&WRTTIME_IDTFR_ID=2022&Type=json&serviceKey=${apiKey}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      const items = data.SttsApiTblData?.[1]?.row;
      if (!items) return null;
      let target = items.find((i: any) => i.CLS_NM === '전국' || i.CLS_FULLNM?.startsWith('전국'));
      if (!target) target = items.find((i: any) => i.CLS_FULLNM?.startsWith('서울'));
      if (!target) return null;
      const priceIndex = parseFloat(target.DTA_VAL);
      const gangnamPrice = (priceIndex / 100) * 25;
      return { price: gangnamPrice };
    } catch (e) { return null; }
  }

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
    } catch (e) { return null; }
  }

  // --- Main Execution ---
  console.log("Cron 작업 로직 시작...");
  const results = await Promise.allSettled([
    fetchExchangeRates(),
    fetchYahoo('KRW=X'),
    fetchYahoo('^DJI'), fetchYahoo('^KS11'), fetchYahoo('^KQ11'), fetchYahoo('^IXIC'), fetchYahoo('^GSPC'),
    fetchYahoo('GC=F'), fetchYahoo('SI=F'),
    fetchCrypto('bitcoin'), fetchCrypto('ethereum'),
    fetchFuel(), fetchRealEstate(),
    fetchECOS('722Y001', '0101000', 'M'),
    fetchECOS('817Y002', '010200000', 'D'), fetchECOS('817Y002', '010210000', 'D'),
    fetchYahoo('^TNX'), fetchYahoo('^IRX'),
    fetchECOS('901Y009', '0', 'M'), fetchECOS('901Y010', '0', 'M'), fetchECOS('511Y002', 'FME/99988', 'M')
  ]);

  const getData = (index: number) => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<any>).value : null;
  const [exchange, usdkrw, dowjones, kospi, kosdaq, nasdaq, sp500, gold, silver, btc, eth, fuel, realEstate, bokRate, bond3y, bond10y, usBond10y, usBond2y, cpi, ppi, ccsi] 
    = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(getData);

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

  const validUpdates = updates.filter(u => u.payload && typeof u.payload.price === 'number');
  if (validUpdates.length > 0) {
    await supabase.from('market_data').upsert(validUpdates);
  }
  return { count: validUpdates.length };
}
