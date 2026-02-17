import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, text, decimal, serial, integer } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey(), 
  email: varchar("email").unique(),
  username: varchar("username").unique(),
  password: text("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).default("seller").notNull(),
  phone: varchar("phone", { length: 20 }),
  vehicleType: varchar("vehicle_type", { length: 50 }),
  isOnline: boolean("is_online").default(false),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  googleId: varchar("google_id").unique(),
  gender: varchar("gender", { length: 10 }),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  icNumber: text("ic_number"),
  icHash: text("ic_hash"),
  icFrontPhoto: text("ic_front_photo"),
  icBackPhoto: text("ic_back_photo"),
  icFrontUrl: text("ic_front_url"),
  icBackUrl: text("ic_back_url"),
  verificationStatus: varchar("verification_status", { length: 20 }).default("unverified").notNull(),
  verificationNotes: text("verification_notes"),
  banned: boolean("banned").default(false).notNull(),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const otpVerifications = pgTable("otp_verifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  target: varchar("target", { length: 100 }).notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
