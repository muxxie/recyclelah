import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { users } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await authStorage.getUser(userId);
      if (!user && req.user.claims.email) {
        const [byEmail] = await db.select().from(users).where(eq(users.email, req.user.claims.email));
        user = byEmail;
      }
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.phoneVerified && user.emailVerified && user.verificationStatus !== "verified") {
        await db.update(users).set({ verificationStatus: "verified" }).where(eq(users.id, user.id));
        user = { ...user, verificationStatus: "verified" };
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
