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

export function parseIcBirthDate(icNumber: string): Date | null {
  const cleaned = icNumber.replace(/[-\s]/g, "");
  if (cleaned.length < 6) return null;
  const yy = parseInt(cleaned.substring(0, 2), 10);
  const mm = parseInt(cleaned.substring(2, 4), 10);
  const dd = parseInt(cleaned.substring(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const currentYear = new Date().getFullYear() % 100;
  const century = yy <= currentYear ? 2000 : 1900;
  const fullYear = century + yy;
  const date = new Date(fullYear, mm - 1, dd);
  if (date.getFullYear() !== fullYear || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return date;
}

export function parseIcGender(icNumber: string): "male" | "female" | null {
  const cleaned = icNumber.replace(/[-\s]/g, "");
  if (cleaned.length < 12) return null;
  const lastDigit = parseInt(cleaned.charAt(11), 10);
  return lastDigit % 2 === 0 ? "female" : "male";
}

export function parseIcStateCode(icNumber: string): string | null {
  const cleaned = icNumber.replace(/[-\s]/g, "");
  if (cleaned.length < 8) return null;
  const code = cleaned.substring(6, 8);
  const states: Record<string, string> = {
    "01": "Johor", "02": "Kedah", "03": "Kelantan", "04": "Melaka",
    "05": "Negeri Sembilan", "06": "Pahang", "07": "Pulau Pinang", "08": "Perak",
    "09": "Perlis", "10": "Selangor", "11": "Terengganu", "12": "Sabah",
    "13": "Sarawak", "14": "W.P. Kuala Lumpur", "15": "W.P. Labuan",
    "16": "W.P. Putrajaya", "21": "Johor", "22": "Johor", "23": "Kedah",
    "24": "Kedah", "25": "Kelantan", "26": "Kelantan", "27": "Melaka",
    "28": "Negeri Sembilan", "29": "Pahang", "30": "Pahang", "31": "Perak",
    "32": "Perak", "33": "Perlis", "34": "Pulau Pinang", "35": "Pulau Pinang",
    "36": "Sabah", "37": "Sabah", "38": "Sarawak", "39": "Sarawak",
    "40": "Selangor", "41": "Selangor", "42": "Terengganu", "43": "Terengganu",
    "44": "W.P. Kuala Lumpur", "45": "W.P. Kuala Lumpur", "46": "W.P. Labuan",
    "47": "W.P. Putrajaya", "48": "Sabah", "49": "Sabah",
    "50": "W.P. Kuala Lumpur", "51": "W.P. Kuala Lumpur", "52": "W.P. Kuala Lumpur",
    "53": "W.P. Kuala Lumpur", "54": "W.P. Kuala Lumpur", "55": "W.P. Kuala Lumpur",
    "56": "W.P. Kuala Lumpur", "57": "W.P. Kuala Lumpur", "58": "W.P. Kuala Lumpur",
    "59": "W.P. Kuala Lumpur",
    "60": "Born abroad", "61": "Born abroad", "62": "Born abroad",
    "63": "Born abroad", "64": "Born abroad", "65": "Born abroad",
    "66": "Born abroad", "67": "Born abroad", "68": "Born abroad",
    "69": "Born abroad", "70": "Born abroad", "71": "Born abroad",
    "72": "Born abroad", "73": "Born abroad", "74": "Born abroad",
    "75": "Born abroad", "76": "Born abroad", "77": "Born abroad",
    "78": "Born abroad", "79": "Born abroad",
    "82": "Born abroad", "83": "Born abroad",
  };
  return states[code] || null;
}

export function getAgeFromBirthDate(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^(\+?6?0)\d{8,10}$/, "Enter a valid Malaysian phone number (e.g. 0121234567)"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["seller", "collector"]),
  vehicleType: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  icNumber: z.string()
    .refine((val) => {
      const cleaned = val.replace(/[-\s]/g, "");
      return cleaned.length === 12 && /^\d{12}$/.test(cleaned);
    }, "IC number must be 12 digits in format YYMMDD-XX-XXXX")
    .refine((val) => {
      const birthDate = parseIcBirthDate(val);
      return birthDate !== null;
    }, "Invalid birth date in IC number")
    .refine((val) => {
      const birthDate = parseIcBirthDate(val);
      if (!birthDate) return false;
      return getAgeFromBirthDate(birthDate) >= 18;
    }, "You must be at least 18 years old to register"),
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
