import app, { setupApp } from "../server/index.js";

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  // 1. 요청이 들어오면 먼저 라우트가 등록되었는지 확인하고 등록합니다.
  await setupApp();
  
  // 2. Express 앱이 요청을 처리하도록 넘깁니다.
  app(req, res);
}
