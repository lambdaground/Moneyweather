// api/index.ts
import app, { setupApp } from '../server/index'; 

// Vercel이 실행하는 핸들러 함수
export default async function handler(req: any, res: any) {
  // 1. 요청이 들어오면, 가장 먼저 라우트 설정을 완료하기 위해 기다립니다.
  await setupApp(); 
  
  // 2. 설정이 끝난 꽉 찬 app에게 요청을 넘깁니다.
  app(req, res);
}
