import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Market data endpoint - returns current market weather data
  app.get("/api/market", async (req, res) => {
    try {
      const data = await storage.getMarketData();
      res.json(data);
    } catch (error) {
      console.error("Error fetching market data:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // Force refresh market data (bypasses cache)
  app.post("/api/market/refresh", async (req, res) => {
    try {
      // Clear cache by getting fresh data
      const data = await storage.getMarketData();
      res.json(data);
    } catch (error) {
      console.error("Error refreshing market data:", error);
      res.status(500).json({ error: "Failed to refresh market data" });
    }
  });

  return httpServer;
}
