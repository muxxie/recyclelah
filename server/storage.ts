import { users, requests, facilities, marketPrices, walletTransactions, otpVerifications, type User, type UpsertUser, type Request, type InsertRequest, type Facility, type InsertFacility, type MarketPrice, type InsertMarketPrice, type WalletTransaction, type InsertWalletTransaction, type OtpVerification } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, ne, lt } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByIcNumber(icNumber: string): Promise<User | undefined>;
  getUserByIcHash(icHash: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User>;
  updateUserVerification(id: string, status: string, notes?: string): Promise<User>;
  updateUserStatus(id: string, isOnline: boolean): Promise<User>;
  updateUserLocation(id: string, lat: string, lng: string): Promise<void>;
  updateUserRole(id: string, role: string): Promise<User>;
  updateUserBan(id: string, banned: boolean, banReason?: string): Promise<User>;
  getAllUsers(): Promise<User[]>;

  createOtp(data: { userId: string; type: string; target: string; otpHash: string; expiresAt: Date }): Promise<OtpVerification>;
  getLatestOtp(userId: string, type: string, target: string): Promise<OtpVerification | undefined>;
  markOtpVerified(id: number): Promise<void>;
  incrementOtpAttempts(id: number): Promise<void>;

  createRequest(request: any): Promise<Request>;
  getRequest(id: number): Promise<Request | undefined>;
  getRequestsBySeller(sellerId: string): Promise<Request[]>;
  getAvailableRequests(): Promise<Request[]>;
  getCollectorRequests(collectorId: string): Promise<Request[]>;
  getAllRequests(): Promise<Request[]>;
  updateRequestStatus(id: number, status: string, collectorId?: string): Promise<Request>;
  completeRequest(id: number, actualWeight: number, facilityId: number, totalPayout: string, commission: string): Promise<Request>;
  updateRequestEscrow(id: number, escrowAmount: string): Promise<Request>;

  getFacilities(): Promise<Facility[]>;
  getMarketPrices(): Promise<MarketPrice[]>;
  getMarketPrice(type: string): Promise<MarketPrice | undefined>;
  updateMarketPrice(id: number, pricePerKg: string): Promise<MarketPrice>;

  getWalletTransactions(userId: string): Promise<WalletTransaction[]>;
  getAllWalletTransactions(): Promise<WalletTransaction[]>;
  createWalletTransaction(tx: InsertWalletTransaction): Promise<WalletTransaction>;
  updateUserBalance(userId: string, amount: number): Promise<User>;

  getStats(): Promise<{ totalJobs: number; totalWeight: number; totalPayout: number; totalCommission: number; totalCollectorEarnings: number }>;
  seedFacilities(facilities: any[]): Promise<void>;
  seedMarketPrices(prices: any[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    return (await db.select().from(users).where(eq(users.id, id)))[0];
  }

  async getUserByUsername(username: string) {
    return (await db.select().from(users).where(eq(users.username, username)))[0];
  }

  async getUserByEmail(email: string) {
    return (await db.select().from(users).where(eq(users.email, email)))[0];
  }

  async getUserByPhone(phone: string) {
    return (await db.select().from(users).where(eq(users.phone, phone)))[0];
  }

  async getUserByIcNumber(icNumber: string) {
    return (await db.select().from(users).where(eq(users.icNumber, icNumber)))[0];
  }

  async getUserByIcHash(icHash: string) {
    return (await db.select().from(users).where(eq(users.icHash, icHash)))[0];
  }

  async getUserByGoogleId(googleId: string) {
    return (await db.select().from(users).where(eq(users.googleId, googleId)))[0];
  }

  async createUser(userData: UpsertUser) {
    return (await db.insert(users).values(userData).returning())[0];
  }

  async updateUser(id: string, data: Partial<UpsertUser>) {
    return (await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning())[0];
  }

  async updateUserVerification(id: string, status: string, notes?: string) {
    return (await db.update(users).set({ verificationStatus: status, verificationNotes: notes || null, updatedAt: new Date() }).where(eq(users.id, id)).returning())[0];
  }

  async upsertUser(userData: UpsertUser) {
    return (await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: { ...userData, updatedAt: new Date() }
    }).returning())[0];
  }

  async updateUserStatus(id: string, isOnline: boolean) {
    return (await db.update(users).set({ isOnline }).where(eq(users.id, id)).returning())[0];
  }

  async updateUserLocation(id: string, latitude: string, longitude: string) {
    await db.update(users).set({ latitude, longitude }).where(eq(users.id, id));
  }

  async updateUserRole(id: string, role: string) {
    return (await db.update(users).set({ role }).where(eq(users.id, id)).returning())[0];
  }

  async updateUserBan(id: string, banned: boolean, banReason?: string) {
    return (await db.update(users).set({ banned, banReason: banReason || null, updatedAt: new Date() }).where(eq(users.id, id)).returning())[0];
  }

  async getAllUsers() {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createRequest(request: any) {
    return (await db.insert(requests).values(request).returning())[0];
  }

  async getRequest(id: number) {
    return (await db.select().from(requests).where(eq(requests.id, id)))[0];
  }

  async getRequestsBySeller(sellerId: string) {
    return db.select().from(requests).where(eq(requests.sellerId, sellerId)).orderBy(desc(requests.createdAt));
  }

  async getAvailableRequests() {
    return db.select().from(requests).where(eq(requests.status, "pending")).orderBy(desc(requests.createdAt));
  }

  async getCollectorRequests(collectorId: string) {
    return db.select().from(requests).where(eq(requests.collectorId, collectorId)).orderBy(desc(requests.createdAt));
  }

  async getAllRequests() {
    return db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async updateRequestStatus(id: number, status: any, collectorId?: string) {
    return (await db.update(requests).set({ status, ...(collectorId && { collectorId }) }).where(eq(requests.id, id)).returning())[0];
  }

  async completeRequest(id: number, actualWeight: number, facilityId: number, totalPayout: string, commissionAmount: string) {
    return (await db.update(requests).set({
      status: "completed",
      actualWeight,
      facilityId,
      totalPayout,
      commissionAmount,
      completedAt: new Date()
    }).where(eq(requests.id, id)).returning())[0];
  }

  async updateRequestEscrow(id: number, escrowAmount: string) {
    return (await db.update(requests).set({ escrowAmount }).where(eq(requests.id, id)).returning())[0];
  }

  async getFacilities() {
    return db.select().from(facilities);
  }

  async getMarketPrices() {
    return db.select().from(marketPrices);
  }

  async getMarketPrice(type: string) {
    return (await db.select().from(marketPrices).where(eq(marketPrices.materialType, type as any)))[0];
  }

  async updateMarketPrice(id: number, pricePerKg: string) {
    return (await db.update(marketPrices).set({ pricePerKg, updatedAt: new Date() }).where(eq(marketPrices.id, id)).returning())[0];
  }

  async getWalletTransactions(userId: string) {
    return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt));
  }

  async getAllWalletTransactions() {
    return db.select().from(walletTransactions).orderBy(desc(walletTransactions.createdAt));
  }

  async createWalletTransaction(tx: InsertWalletTransaction) {
    return (await db.insert(walletTransactions).values(tx).returning())[0];
  }

  async updateUserBalance(userId: string, amount: number) {
    return (await db.update(users).set({
      balance: sql`CAST(COALESCE(${users.balance}, '0') AS DECIMAL) + ${amount}`
    }).where(eq(users.id, userId)).returning())[0];
  }

  async getStats() {
    const reqs = await db.select().from(requests).where(eq(requests.status, "completed"));
    const totalJobs = reqs.length;
    const totalWeight = reqs.reduce((s, r) => s + Number(r.actualWeight || 0), 0);
    const totalPayout = reqs.reduce((s, r) => s + Number(r.totalPayout || 0), 0);
    const totalCommission = reqs.reduce((s, r) => s + Number(r.commissionAmount || 0), 0);
    const totalCollectorEarnings = totalPayout - totalCommission;
    return { totalJobs, totalWeight, totalPayout, totalCommission, totalCollectorEarnings };
  }

  async createOtp(data: { userId: string; type: string; target: string; otpHash: string; expiresAt: Date }) {
    return (await db.insert(otpVerifications).values(data).returning())[0];
  }

  async getLatestOtp(userId: string, type: string, target: string) {
    const results = await db.select().from(otpVerifications)
      .where(and(
        eq(otpVerifications.userId, userId),
        eq(otpVerifications.type, type),
        eq(otpVerifications.target, target),
      ))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);
    return results[0];
  }

  async markOtpVerified(id: number) {
    await db.update(otpVerifications).set({ verified: true }).where(eq(otpVerifications.id, id));
  }

  async incrementOtpAttempts(id: number) {
    await db.update(otpVerifications).set({
      attempts: sql`${otpVerifications.attempts} + 1`
    }).where(eq(otpVerifications.id, id));
  }

  async seedFacilities(data: any[]) {
    if ((await this.getFacilities()).length === 0) await db.insert(facilities).values(data);
  }

  async seedMarketPrices(data: any[]) {
    if ((await this.getMarketPrices()).length === 0) await db.insert(marketPrices).values(data);
  }
}

export const storage = new DatabaseStorage();
