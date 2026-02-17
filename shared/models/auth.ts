import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, text, decimal } from "drizzle-orm/pg-core";

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
  icFrontPhoto: text("ic_front_photo"),
  icBackPhoto: text("ic_back_photo"),
  verificationStatus: varchar("verification_status", { length: 20 }).default("unverified").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
