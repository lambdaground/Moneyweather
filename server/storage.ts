import { type User, type InsertUser, type AssetData, type MarketDataResponse } from "@shared/schema";
import { randomUUID } from "crypto";
import { generateMarketData } from "./marketData";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getMarketData(): Promise<MarketDataResponse>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cachedMarketData: MarketDataResponse | null;
  private lastGenerated: number;
  private readonly cacheLifetime = 30000; // 30 seconds cache

  constructor() {
    this.users = new Map();
    this.cachedMarketData = null;
    this.lastGenerated = 0;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getMarketData(): Promise<MarketDataResponse> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cachedMarketData && (now - this.lastGenerated) < this.cacheLifetime) {
      return this.cachedMarketData;
    }

    // Generate new data
    const assets = generateMarketData();
    this.cachedMarketData = {
      assets,
      generatedAt: new Date().toISOString(),
    };
    this.lastGenerated = now;

    return this.cachedMarketData;
  }
}

export const storage = new MemStorage();
