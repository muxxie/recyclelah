
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === ENUMS ===
export const userRoles = ["seller", "collector", "admin"] as const;
export const itemTypes = ["plastic", "paper", "metal", "ewaste", "glass", "other"] as const;
export const jobStatus = ["pending", "accepted", "in_progress", "completed", "cancelled", "verified"] as const;

// === TABLES ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // For simple auth as requested
  role: text("role", { enum: userRoles }).default("seller").notNull(),
  phone: text("phone"),
  vehicleType: text("vehicle_type"), // For collectors
  isOnline: boolean("is_online").default(false), // For collectors
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  acceptedMaterials: jsonb("accepted_materials").$type<string[]>(), // Array of itemTypes
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
  sellerId: integer("seller_id").references(() => users.id).notNull(),
  collectorId: integer("collector_id").references(() => users.id), // Nullable initially
  facilityId: integer("facility_id").references(() => facilities.id), // Nullable until verified
  
  // Item details
  itemTypes: jsonb("item_types").$type<string[]>().notNull(), // Array of types in this request
  estimatedWeight: decimal("estimated_weight", { precision: 10, scale: 2 }).notNull(),
  actualWeight: decimal("actual_weight", { precision: 10, scale: 2 }), // Set upon verification
  photos: jsonb("photos").$type<string[]>(), // Array of photo URLs
  
  // Location
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  
  // Scheduling
  isImmediate: boolean("is_immediate").default(true),
  scheduledTime: timestamp("scheduled_time"),
  
  // Status & Financials
  status: text("status", { enum: jobStatus }).default("pending").notNull(),
  totalPayout: decimal("total_payout", { precision: 10, scale: 2 }), // Calculated later
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }), // 20%
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  requestsAsSeller: many(requests, { relationName: "sellerRequests" }),
  requestsAsCollector: many(requests, { relationName: "collectorRequests" }),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  seller: one(users, {
    fields: [requests.sellerId],
    references: [users.id],
    relationName: "sellerRequests",
  }),
  collector: one(users, {
    fields: [requests.collectorId],
    references: [users.id],
    relationName: "collectorRequests",
  }),
  facility: one(facilities, {
    fields: [requests.facilityId],
    references: [facilities.id],
  }),
}));

// === ZOD SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, balance: true });
export const insertRequestSchema = createInsertSchema(requests).omit({ 
  id: true, 
  createdAt: true, 
  completedAt: true,
  status: true,
  actualWeight: true,
  totalPayout: true,
  commissionAmount: true,
  collectorId: true,
  facilityId: true
});
export const insertFacilitySchema = createInsertSchema(facilities).omit({ id: true, createdAt: true });
export const insertMarketPriceSchema = createInsertSchema(marketPrices).omit({ id: true, updatedAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Facility = typeof facilities.$inferSelect;
export type MarketPrice = typeof marketPrices.$inferSelect;
