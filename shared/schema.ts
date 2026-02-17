import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const itemTypes = ["plastic", "paper", "metal", "ewaste", "glass", "other"] as const;
export const jobStatus = ["pending", "accepted", "in_progress", "completed", "cancelled", "verified"] as const;

import { users } from "./models/auth";

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  acceptedMaterials: jsonb("accepted_materials").$type<string[]>(),
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
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const usersRelations = relations(users, ({ many }) => ({
  requestsAsSeller: many(requests, { relationName: "sellerRequests" }),
  requestsAsCollector: many(requests, { relationName: "collectorRequests" }),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  seller: one(users, { fields: [requests.sellerId], references: [users.id], relationName: "sellerRequests" }),
  collector: one(users, { fields: [requests.collectorId], references: [users.id], relationName: "collectorRequests" }),
  facility: one(facilities, { fields: [requests.facilityId], references: [facilities.id] }),
}));

export const insertRequestSchema = createInsertSchema(requests).omit({ 
  id: true, createdAt: true, completedAt: true, status: true,
  actualWeight: true, totalPayout: true, commissionAmount: true,
  collectorId: true, facilityId: true
});
export const insertFacilitySchema = createInsertSchema(facilities).omit({ id: true, createdAt: true });
export const insertMarketPriceSchema = createInsertSchema(marketPrices).omit({ id: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, balance: true });

export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Facility = typeof facilities.$inferSelect;
export type MarketPrice = typeof marketPrices.$inferSelect;
