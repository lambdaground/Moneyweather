// 1. .js 확장자 제거 (TypeScript 환경)
import app, { setupApp } from "../server/index";
// 2. Vercel 전용 타입 불러오기 (any 대신 사용)
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Serverless Function Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 요청이 들어오면 먼저 라우트가 등록되었는지 확인하고 등록합니다.
  await setupApp();
  
  // 2. Express 앱이 요청을 처리하도록 넘깁니다.
  app(req, res);
}
