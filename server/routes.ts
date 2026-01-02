import type { Express } from "express";
import { createServer, type Server } from "http";
// 1. .js 확장자 제거 (TypeScript/Vite 환경 호환성)
import { storage } from "./storage"; 

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // 1. 데이터 조회 API (프론트엔드가 데이터를 가져가는 곳)
  app.get("/api/market", async (req, res) => {
    try {
      // 캐시 설정: 60초 유지, 5분간은 만료된 데이터라도 일단 보여줌
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      
      const data = await storage.getMarketData();
      res.json(data);
    } catch (error) {
      console.error("Error fetching market data:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // 2. [삭제 권장] 데이터 강제 갱신 라우트
  // 설명: 우리는 이미 'api/cron.ts'라는 더 강력한 자동 수집기를 만들었습니다.
  // 이 코드는 놔둬도 상관없지만, 헷갈리지 않게 주석 처리하거나 지우는 게 좋습니다.
  /*
  app.get("/api/market/refresh", async (req, res) => {
    try {
      console.log("Manual Refresh Triggered...");
      const data = await storage.refreshMarketData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Refresh failed" });
    }
  });
  */

  return httpServer;
}
