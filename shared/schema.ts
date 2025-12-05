import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type WeatherStatus = 'sunny' | 'rainy' | 'cloudy' | 'thunder';

export type AssetType = 
  | 'usdkrw' | 'jpykrw' | 'cnykrw' | 'eurkrw'
  | 'feargreed' | 'kospi' | 'kosdaq' | 'sp500'
  | 'gold' | 'silver' | 'gasoline' | 'diesel' | 'kbrealestate'
  | 'bitcoin' | 'ethereum'
  | 'bonds' | 'bonds2y';

export type AssetCategory = 'currency' | 'index' | 'commodity' | 'crypto' | 'bonds';

export interface AssetData {
  id: AssetType;
  name: string;
  category: AssetCategory;
  price: number;
  priceDisplay: string;
  buyPrice?: number;
  buyPriceDisplay?: string;
  sellPrice?: number;
  sellPriceDisplay?: string;
  change: number;
  changePoints: number;
  changePointsDisplay: string;
  status: WeatherStatus;
  message: string;
  advice: string;
  chartData?: { time: string; price: number }[];
}

export interface MarketDataResponse {
  assets: AssetData[];
  generatedAt: string;
}

export const assetCategories: Record<AssetCategory, { name: string; emoji: string }> = {
  currency: { name: '환율', emoji: '💱' },
  index: { name: '주가지수', emoji: '📈' },
  commodity: { name: '원자재', emoji: '🪙' },
  crypto: { name: '암호화폐', emoji: '₿' },
  bonds: { name: '금리/채권', emoji: '📊' },
};

export const defaultAssets: AssetType[] = ['usdkrw', 'kospi', 'gold', 'bitcoin', 'bonds'];

export const assetDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['currency', 'index', 'commodity', 'crypto', 'bonds']),
  price: z.number(),
  priceDisplay: z.string(),
  buyPrice: z.number().optional(),
  buyPriceDisplay: z.string().optional(),
  sellPrice: z.number().optional(),
  sellPriceDisplay: z.string().optional(),
  change: z.number(),
  changePoints: z.number(),
  changePointsDisplay: z.string(),
  status: z.enum(['sunny', 'rainy', 'cloudy', 'thunder']),
  message: z.string(),
  advice: z.string(),
  chartData: z.array(z.object({
    time: z.string(),
    price: z.number(),
  })).optional(),
});

export const marketDataResponseSchema = z.object({
  assets: z.array(assetDataSchema),
  generatedAt: z.string(),
});
