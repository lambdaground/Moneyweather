import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel 무료 요금제 타임아웃 방지 (최대 60초)
export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 보안 체크 (자동 실행 vs 수동 실행)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const { key } = req.query;
  const isManualRun = key === 'debug1234'; // 수동 실행 키

  // 키도 없고, Vercel Cron 헤더도 없으면 차단
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isManualRun) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Supabase 클라이언트 설정
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // ★ 중요: 쓰기 권한이 있는 Service Role Key 사용
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)");
    return res.status(500).json({ error: 'Supabase environment variables missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- Helper Functions ---
  const getEnv = (key: string): string => process.env[key] || process.env[`VITE_${key}`] || '';

  // 타임아웃 및 차단 방지용 Fetch 함수
  async function fetchWithTimeout(url: string, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          // 브라우저인 척 속이는 헤더 (Yahoo 등 차단 방지)
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // --- API Fetchers ---

  // 1. 환율
  async function fetchExchangeRates() {
    try {
      const res = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.json();
    } catch (e: any) {
      console.error(`[Fail] Exchange: ${e.message}`);
      return null;
    }
  }

  // 2. 야후 파이낸스 (주식, 지수, 원자재, 채권)
  async function fetchYahoo(symbol: string) {
    try {
      // 차트 데이터까지 가져옴 (가격 정확도 높음)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=5d`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const result = data.chart?.result?.[0];
      
      if (!result) throw new Error('No Data');

      const meta = result.meta;
      const currentPrice = meta.regularMarketPrice;
      const previousClose = meta.previousClose || meta.regularMarketPreviousClose;
      
      return {
        price: currentPrice,
        change: previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0,
        previousClose,
      };
    } catch (e: any) {
      console.error(`[Fail] Yahoo(${symbol}): ${e.message}`);
      return null;
    }
  }

  // 3. 코인 (CoinGecko)
  async function fetchCrypto(id: string) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=krw&include_24hr_change=true`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return {
        price: data[id]?.krw,
        change: data[id]?.krw_24h_change
      };
    } catch (e: any) {
      console.error(`[Fail] Crypto(${id}): ${e.message}`);
      return null;
    }
  }

  // 4. 오피넷 (유가 - API 키 필요)
  async function fetchFuel() {
    const apiKey = getEnv('OPINET_API_KEY');
    if (!apiKey || apiKey === 'DEMO_KEY') return null;
    
    try {
      const url = `https://www.opinet.co.kr/api/avgAllPrice.do?out=json&code=${apiKey}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const result = data.RESULT?.OIL;
      
      if (!Array.isArray(result)) throw new Error('Invalid Data');
      
      const gasoline = result.find((i: any) => i.PRODCD === 'B027');
      const diesel = result.find((i: any) => i.PRODCD === 'D047');
      
      return {
        gasoline: gasoline ? parseFloat(gasoline.PRICE) : null,
        diesel: diesel ? parseFloat(diesel.PRICE) : null
      };
    } catch (e: any) {
      console.error(`[Fail] Fuel: ${e.message}`);
      return null;
    }
  }

  // 5. 부동산 (공공데이터포털 - API 키 필요)
  async function fetchRealEstate() {
    const apiKey = getEnv('REB_API_KEY');
    if (!apiKey) return null;

    try {
      const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?STATBL_ID=A_2024_00900&DTACYCLE_CD=YY&WRTTIME_IDTFR_ID=2022&Type=json&serviceKey=${apiKey}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const items = data.SttsApiTblData?.[1]?.row;
      
      if (!items) throw new Error('No Items');

      let target = items.find((i: any) => i.CLS_NM === '전국' || i.CLS_FULLNM?.startsWith('전국'));
      if (!target) target = items.find((i: any) => i.CLS_FULLNM?.startsWith('서울'));
      
      if (!target) return null;
      
      const priceIndex = parseFloat(target.DTA_VAL);
      const gangnamPrice = (priceIndex / 100) * 25; // 단순 환산 로직

      return { price: gangnamPrice, originalIndex: priceIndex };
    } catch (e: any) {
      console.error(`[Fail] RealEstate: ${e.message}`);
      return null;
    }
  }

  // 6. ECOS (한국은행 - API 키 필요)
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
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const rows = data.StatisticSearch?.row;
      if (!rows || rows.length === 0) throw new Error('No Data');
      
      const latest = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : null;
      
      const price = parseFloat(latest.DATA_VALUE);
      const prevPrice = prev ? parseFloat(prev.DATA_VALUE) : price;
      
      return { price, change: price - prevPrice };
    } catch (e: any) {
      console.error(`[Fail] ECOS(${itemCode}): ${e.message}`);
      return null;
    }
  }

  // --- Main Execution ---
  try {
    console.log("Cron 작업 시작... (Max Duration: 60s)");

    // 모든 API를 병렬로 호출하되, 하나가 실패해도 멈추지 않음 (allSettled)
    const results = await Promise.allSettled([
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

    // 결과 값 추출 Helper
    const getData = (index: number) => 
      results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<any>).value : null;

    // 순서대로 변수에 할당
    const [
      exchange, usdkrw,
      dowjones, kospi, kosdaq, nasdaq, sp500,
      gold, silver,
      btc, eth,
      fuel,
      realEstate,
      bokRate,
      bond3y, bond10y,
      usBond10y, usBond2y,
      cpi, ppi, ccsi
    ] = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(getData);

    // 환율 기준값 (API 실패 시 1400원 fallback)
    const usdPrice = exchange?.rates?.KRW || usdkrw?.price || 1400;

    // DB에 저장할 데이터 목록 구성
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

    // 유효한 데이터만 필터링 (price가 있는 것만)
    const validUpdates = updates.filter(u => 
      u.payload && 
      (typeof u.payload.price === 'number' && !isNaN(u.payload.price))
    );

    if (validUpdates.length === 0) {
      console.error("모든 API 호출 실패: 저장할 데이터가 없습니다.");
      return res.status(200).json({ message: 'No data to update', log: 'All fetches failed' });
    }

    // Supabase에 저장 (Upsert: 있으면 수정, 없으면 생성)
    const { error } = await supabase
      .from('market_data')
      .upsert(validUpdates);

    if (error) {
      console.error("Supabase 저장 실패:", error);
      throw error; // 에러를 던져서 catch 블록으로 이동
    }

    console.log(`Cron 완료: 총 ${validUpdates.length}개 항목 저장 성공`);
    return res.status(200).json({ message: 'Success', count: validUpdates.length });

  } catch (error: any) {
    console.error("Critical Cron Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
