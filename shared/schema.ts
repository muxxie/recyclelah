import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const itemTypes = ["plastic", "paper", "metal", "ewaste", "glass", "other"] as const;
export const jobStatus = ["pending", "accepted", "in_progress", "completed", "cancelled", "verified"] as const;
export const walletTransactionTypes = ["topup", "escrow_lock", "escrow_release", "payout", "commission", "withdrawal"] as const;

import { users } from "./models/auth";

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  acceptedMaterials: jsonb("accepted_materials").$type<string[]>(),
  phone: text("phone"),
  operatingHours: text("operating_hours"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketPrices = pgTable("market_prices", {
  id: serial("id").primaryKey(),
  materialType: text("material_type", { enum: itemTypes }).notNull().unique(),
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  collectorId: varchar("collector_id").references(() => users.id),
  facilityId: integer("facility_id").references(() => facilities.id),
  itemTypes: jsonb("item_types").$type<string[]>().notNull(),
  estimatedWeight: integer("estimated_weight").notNull(),
  actualWeight: integer("actual_weight"),
  photos: jsonb("photos").$type<string[]>(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  isImmediate: boolean("is_immediate").default(true),
  scheduledTime: timestamp("scheduled_time"),
  status: text("status", { enum: jobStatus }).default("pending").notNull(),
  totalPayout: decimal("total_payout", { precision: 10, scale: 2 }),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }),
  escrowAmount: decimal("escrow_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: walletTransactionTypes }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  relatedRequestId: integer("related_request_id").references(() => requests.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  requestsAsSeller: many(requests, { relationName: "sellerRequests" }),
  requestsAsCollector: many(requests, { relationName: "collectorRequests" }),
  walletTransactions: many(walletTransactions),
}));

export const requestsRelations = relations(requests, ({ one, many }) => ({
  seller: one(users, { fields: [requests.sellerId], references: [users.id], relationName: "sellerRequests" }),
  collector: one(users, { fields: [requests.collectorId], references: [users.id], relationName: "collectorRequests" }),
  facility: one(facilities, { fields: [requests.facilityId], references: [facilities.id] }),
  walletTransactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  user: one(users, { fields: [walletTransactions.userId], references: [users.id] }),
  request: one(requests, { fields: [walletTransactions.relatedRequestId], references: [requests.id] }),
}));

export const insertRequestSchema = createInsertSchema(requests).omit({ 
  id: true, createdAt: true, completedAt: true, status: true,
  actualWeight: true, totalPayout: true, commissionAmount: true,
  collectorId: true, facilityId: true, escrowAmount: true, sellerId: true
});
export const insertFacilitySchema = createInsertSchema(facilities).omit({ id: true, createdAt: true });
export const insertMarketPriceSchema = createInsertSchema(marketPrices).omit({ id: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, balance: true, isOnline: true, verificationStatus: true });

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^(\+?6?0)\d{8,10}$/, "Enter a valid Malaysian phone number (e.g. 0121234567)"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["seller", "collector"]),
  vehicleType: z.string().optional(),
  icFrontPhoto: z.string().min(1, "IC front photo is required"),
  icBackPhoto: z.string().min(1, "IC back photo is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });

export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Facility = typeof facilities.$inferSelect;
export type MarketPrice = typeof marketPrices.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type InsertMarketPrice = z.infer<typeof insertMarketPriceSchema>;
