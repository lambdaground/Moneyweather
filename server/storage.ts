// server/storage.ts
import { type User, type InsertUser, type MarketDataResponse } from "../shared/schema";
import { randomUUID } from "crypto";
// 데이터 변환 함수만 가져옵니다 (API 호출 함수는 이제 안 씁니다!)
import { convertToAssetData } from "./realMarketData"; 
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 연결
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 환경변수 체크
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase 환경변수가 없습니다. .env 파일을 확인하세요.");
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getMarketData(): Promise<MarketDataResponse>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
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

  // 🔥 핵심: 외부 API 대신 Supabase DB에서 읽어오기
  async getMarketData(): Promise<MarketDataResponse> {
    try {
      // 1. Supabase에서 데이터 긁어오기
      const { data: rows, error } = await supabase
        .from('market_data')
        .select('*');

      if (error) {
        console.error("Supabase 조회 에러:", error);
        return { assets: [], generatedAt: new Date().toISOString() };
      }

      if (!rows || rows.length === 0) {
        console.log("DB가 비어있습니다. (Cron Job을 실행해주세요)");
        return { assets: [], generatedAt: new Date().toISOString() };
      }

      // 2. DB 데이터를 convertToAssetData가 좋아하는 모양(RawMarketData)으로 조립
      const rawData: any = {};
      
      rows.forEach((row: any) => {
        // row.category 예: 'usdkrw', 'bitcoin'
        // row.payload 예: { price: 1400, change: 0.5 }
        rawData[row.category] = row.payload;
      });

      // 3. 날씨/조언 등 문구 생성 (convertToAssetData 재활용)
      const assets = convertToAssetData(rawData);

      return {
        assets,
        generatedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Storage Error:', error);
      return { assets: [], generatedAt: new Date().toISOString() };
    }
  }
}

export const storage = new MemStorage();
