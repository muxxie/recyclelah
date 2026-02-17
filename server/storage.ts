import { users, requests, facilities, marketPrices, type User, type UpsertUser, type Request, type InsertRequest, type Facility, type InsertFacility, type MarketPrice, type InsertMarketPrice } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStatus(id: string, isOnline: boolean): Promise<User>;
  updateUserLocation(id: string, lat: string, lng: string): Promise<void>;
  createRequest(request: InsertRequest): Promise<Request>;
  getRequest(id: number): Promise<Request | undefined>;
  getRequestsBySeller(sellerId: string): Promise<Request[]>;
  getAvailableRequests(): Promise<Request[]>; 
  getCollectorRequests(collectorId: string): Promise<Request[]>;
  updateRequestStatus(id: number, status: string, collectorId?: string): Promise<Request>;
  completeRequest(id: number, actualWeight: number, facilityId: number, totalPayout: string, commission: string): Promise<Request>;
  getFacilities(): Promise<Facility[]>;
  getMarketPrices(): Promise<MarketPrice[]>;
  getMarketPrice(type: string): Promise<MarketPrice | undefined>;
  getStats(): Promise<{ totalJobs: number; totalWeight: number; totalPayout: number; totalCommission: number; }>;
  seedFacilities(facilities: InsertFacility[]): Promise<void>;
  seedMarketPrices(prices: InsertMarketPrice[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) { return (await db.select().from(users).where(eq(users.id, id)))[0]; }
  async getUserByUsername(username: string) { return (await db.select().from(users).where(eq(users.username, username)))[0]; }
  async upsertUser(userData: UpsertUser) { return (await db.insert(users).values(userData).onConflictDoUpdate({ target: users.id, set: { ...userData, updatedAt: new Date() } }).returning())[0]; }
  async updateUserStatus(id: string, isOnline: boolean) { return (await db.update(users).set({ isOnline }).where(eq(users.id, id)).returning())[0]; }
  async updateUserLocation(id: string, latitude: string, longitude: string) { await db.update(users).set({ latitude, longitude }).where(eq(users.id, id)); }
  async createRequest(request: InsertRequest) { return (await db.insert(requests).values(request).returning())[0]; }
  async getRequest(id: number) { return (await db.select().from(requests).where(eq(requests.id, id)))[0]; }
  async getRequestsBySeller(sellerId: string) { return db.select().from(requests).where(eq(requests.sellerId, sellerId)).orderBy(desc(requests.createdAt)); }
  async getAvailableRequests() { return db.select().from(requests).where(eq(requests.status, "pending")).orderBy(desc(requests.createdAt)); }
  async getCollectorRequests(collectorId: string) { return db.select().from(requests).where(eq(requests.collectorId, collectorId)).orderBy(desc(requests.createdAt)); }
  async updateRequestStatus(id: number, status: any, collectorId?: string) { return (await db.update(requests).set({ status, ...(collectorId && { collectorId }) }).where(eq(requests.id, id)).returning())[0]; }
  async completeRequest(id: number, actualWeight: number, facilityId: number, totalPayout: string, commissionAmount: string) { return (await db.update(requests).set({ status: "completed", actualWeight, facilityId, totalPayout, commissionAmount, completedAt: new Date() }).where(eq(requests.id, id)).returning())[0]; }
  async getFacilities() { return db.select().from(facilities); }
  async getMarketPrices() { return db.select().from(marketPrices); }
  async getMarketPrice(type: string) { return (await db.select().from(marketPrices).where(eq(marketPrices.materialType, type as any)))[0]; }
  async getStats() { const reqs = await db.select().from(requests).where(eq(requests.status, "completed")); return { totalJobs: reqs.length, totalWeight: reqs.reduce((s, r) => s + Number(r.actualWeight || 0), 0), totalPayout: reqs.reduce((s, r) => s + Number(r.totalPayout || 0), 0), totalCommission: reqs.reduce((s, r) => s + Number(r.commissionAmount || 0), 0) }; }
  async seedFacilities(data: InsertFacility[]) { if ((await this.getFacilities()).length === 0) await db.insert(facilities).values(data); }
  async seedMarketPrices(data: InsertMarketPrice[]) { if ((await this.getMarketPrices()).length === 0) await db.insert(marketPrices).values(data); }
}
export const storage = new DatabaseStorage();
