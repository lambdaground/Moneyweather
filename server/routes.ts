import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // 1. 데이터 조회 (빠른 속도를 위해 캐싱 적용)
  app.get("/api/market", async (req, res) => {
    try {
      // ⚡️ 핵심: Vercel CDN에 60초간 저장하고, 5분간은 옛날 데이터라도 빨리 보여주기
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      
      const data = await storage.getMarketData();
      res.json(data);
    } catch (error) {
      console.error("Error fetching market data:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // 2. 데이터 강제 갱신 (Cron Job용)
  // ⚠️ 중요: Vercel Cron은 GET 요청을 보내므로 app.post -> app.get으로 변경!
  app.get("/api/market/refresh", async (req, res) => {
    try {
      console.log("🔄 Cron Job Triggered: Market Data Refresh started...");
      
      const data = await storage.refreshMarketData();
      res.json(data);
    } catch (error) {
      console.error("Error refreshing market data:", error);
      res.status(500).json({ error: "Failed to refresh market data" });
    }
  });

  return httpServer;
}
