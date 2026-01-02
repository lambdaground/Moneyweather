// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runCronJob } from "./cron-job"; // ★ 방금 만든 파일 import

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // 1. 일반 데이터 조회 (Supabase DB 읽기)
  app.get("/api/market", async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      const data = await storage.getMarketData();
      res.json(data);
    } catch (error) {
      console.error("Error fetching market data:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // 2. ★ 중요: Cron 작업 엔드포인트 (Express가 직접 처리!)
  app.get("/api/cron", async (req, res) => {
    try {
      // 보안 체크: 수동 실행 키(?key=debug1234) 또는 Vercel Cron 헤더 확인
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const { key } = req.query;
      const isManualRun = key === 'debug1234';

      if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isManualRun) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log("🔄 Cron Job 요청 받음 (Express)");
      const result = await runCronJob(isManualRun); // 실제 데이터 수집 실행
      res.json({ message: "Success", ...result });

    } catch (error: any) {
      console.error("Cron Job Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
