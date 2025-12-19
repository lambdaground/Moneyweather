import express from 'express';
import { createServer } from 'http';
import { registerRoutes } from '../server/routes.js';

const app = express();
const server = createServer(app);

// JSON 데이터 해석 설정
app.use(express.json());

// 우리가 만들었던 API 라우트 연결
// (주의: registerRoutes가 비동기 함수라 .then으로 처리)
registerRoutes(server, app).catch((err) => {
  console.error('Failed to register routes:', err);
});

// Vercel은 app을 내보내면 알아서 서버로 실행해 줍니다.
export default app;
