import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1. Supabase 관리자 권한으로 접속 (쓰기 권한 필요하므로 SERVICE_ROLE_KEY 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 2. 캐싱 안 함 설정 (항상 최신 데이터를 가져오기 위해)
export const dynamic = 'force-dynamic';

export async function GET(request) {
  // 3. 보안 체크: Vercel Cron이 보낸 요청이 맞는지 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log("데이터 수집 시작...");

    // 4. 외부 API들 한꺼번에 호출 (Promise.all로 병렬 처리)
    // ★ 아래 fetch 주소들을 님 코드에 있는 실제 주소로 바꾸세요!
    const [exchangeData, coinData, stockData] = await Promise.all([
      fetch('https://api.exchangerate-api.com/v4/latest/KRW').then(res => res.json()), // 예시: 환율
      fetch('https://api.coingecko.com/api/v3/simple/price...').then(res => res.json()), // 예시: 코인
      fetch('https://yahoo-finance...').then(res => res.json()), // 예시: 주식
    ]);

    // 5. Supabase에 저장할 데이터 정리
    // category는 테이블의 'primary key'이므로, 이 이름으로 계속 덮어씌워집니다.
    const updates = [
      { category: 'exchange', payload: exchangeData, updated_at: new Date() },
      { category: 'coin', payload: coinData, updated_at: new Date() },
      { category: 'stock', payload: stockData, updated_at: new Date() },
    ];

    // 6. DB에 저장 (upsert: 없으면 생성, 있으면 업데이트)
    const { error } = await supabase
      .from('market_data')
      .upsert(updates);

    if (error) throw error;

    console.log("데이터 업데이트 완료!");
    return NextResponse.json({ message: 'Data updated successfully!' });

  } catch (error) {
    console.error("에러 발생:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
