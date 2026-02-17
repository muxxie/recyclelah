
import { 
  users, requests, facilities, marketPrices,
  type User, type InsertUser, 
  type Request, type InsertRequest,
  type Facility, type InsertFacility,
  type MarketPrice, type InsertMarketPrice
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, isOnline: boolean): Promise<User>;
  updateUserLocation(id: number, lat: string, lng: string): Promise<void>;
  
  // Requests
  createRequest(request: InsertRequest): Promise<Request>;
  getRequest(id: number): Promise<Request | undefined>;
  getRequestsBySeller(sellerId: number): Promise<Request[]>;
  getAvailableRequests(): Promise<Request[]>; // For collectors
  getCollectorRequests(collectorId: number): Promise<Request[]>;
  updateRequestStatus(id: number, status: string, collectorId?: number): Promise<Request>;
  completeRequest(id: number, actualWeight: string, facilityId: number, totalPayout: string, commission: string): Promise<Request>;
  
  // Facilities & Prices
  getFacilities(): Promise<Facility[]>;
  getMarketPrices(): Promise<MarketPrice[]>;
  getMarketPrice(type: string): Promise<MarketPrice | undefined>;
  
  // Admin
  getStats(): Promise<{
    totalJobs: number;
    totalWeight: number;
    totalPayout: number;
    totalCommission: number;
  }>;

  // Seeding support
  seedFacilities(facilities: InsertFacility[]): Promise<void>;
  seedMarketPrices(prices: InsertMarketPrice[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStatus(id: number, isOnline: boolean): Promise<User> {
    const [user] = await db.update(users)
      .set({ isOnline })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserLocation(id: number, latitude: string, longitude: string): Promise<void> {
    await db.update(users)
      .set({ latitude, longitude })
      .where(eq(users.id, id));
  }

  async createRequest(request: InsertRequest): Promise<Request> {
    const [req] = await db.insert(requests).values(request).returning();
    return req;
  }

  async getRequest(id: number): Promise<Request | undefined> {
    const [req] = await db.select().from(requests).where(eq(requests.id, id));
    return req;
  }

  async getRequestsBySeller(sellerId: number): Promise<Request[]> {
    return db.select()
      .from(requests)
      .where(eq(requests.sellerId, sellerId))
      .orderBy(desc(requests.createdAt));
  }

  async getAvailableRequests(): Promise<Request[]> {
    return db.select()
      .from(requests)
      .where(eq(requests.status, "pending"))
      .orderBy(desc(requests.createdAt));
  }

  async getCollectorRequests(collectorId: number): Promise<Request[]> {
    return db.select()
      .from(requests)
      .where(eq(requests.collectorId, collectorId))
      .orderBy(desc(requests.createdAt));
  }

  async updateRequestStatus(id: number, status: any, collectorId?: number): Promise<Request> {
    const updates: any = { status };
    if (collectorId !== undefined) {
      updates.collectorId = collectorId;
    }
    const [req] = await db.update(requests)
      .set(updates)
      .where(eq(requests.id, id))
      .returning();
    return req;
  }

  async completeRequest(
    id: number, 
    actualWeight: string, 
    facilityId: number, 
    totalPayout: string, 
    commissionAmount: string
  ): Promise<Request> {
    const [req] = await db.update(requests)
      .set({
        status: "completed",
        actualWeight,
        facilityId,
        totalPayout,
        commissionAmount,
        completedAt: new Date(),
      })
      .where(eq(requests.id, id))
      .returning();
    return req;
  }

  async getFacilities(): Promise<Facility[]> {
    return db.select().from(facilities);
  }

  async getMarketPrices(): Promise<MarketPrice[]> {
    return db.select().from(marketPrices);
  }

  async getMarketPrice(type: string): Promise<MarketPrice | undefined> {
    const [price] = await db.select().from(marketPrices).where(eq(marketPrices.materialType, type as any));
    return price;
  }

  async getStats() {
    // This is a simple aggregation. For large datasets, use count(), sum() in SQL.
    const completedRequests = await db.select().from(requests).where(eq(requests.status, "completed"));
    
    const totalJobs = completedRequests.length;
    const totalWeight = completedRequests.reduce((sum, req) => sum + Number(req.actualWeight || 0), 0);
    const totalPayout = completedRequests.reduce((sum, req) => sum + Number(req.totalPayout || 0), 0);
    const totalCommission = completedRequests.reduce((sum, req) => sum + Number(req.commissionAmount || 0), 0);

    return {
      totalJobs,
      totalWeight,
      totalPayout,
      totalCommission
    };
  }

  async seedFacilities(data: InsertFacility[]): Promise<void> {
    if ((await this.getFacilities()).length === 0) {
      await db.insert(facilities).values(data);
    }
  }

  async seedMarketPrices(data: InsertMarketPrice[]): Promise<void> {
    if ((await this.getMarketPrices()).length === 0) {
      await db.insert(marketPrices).values(data);
    }
  }
}

export const storage = new DatabaseStorage();
