// server/routes.ts

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runCronJob } from "./cron-job"; // ★ 이 파일이 있어야 합니다!

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
   // 👉 이 로그를 추가해주세요!
  console.log("🛠️ [DEBUG] 라우트 등록 시작! /api/cron 포함됨?");
  
  // 1. 일반 데이터 조회 (기존에 잘 되던 것)
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

  // 2. ★ [누락된 부분] Cron 작업 주소 등록 ★
  app.get("/api/cron", async (req, res) => {
    try {
      // 보안 체크 (수동 실행 키 or Vercel 헤더)
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const { key } = req.query;
      const isManualRun = key === 'debug1234';

      if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isManualRun) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log("🔄 Cron Job 요청 받음 (Express)");
      
      // 실제 크론 로직 실행
      const result = await runCronJob(isManualRun); 
      
      res.json({ message: "Success", ...result });

    } catch (error: any) {
      console.error("Cron Job Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

