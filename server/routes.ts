import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertRequestSchema, registerSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const locationSubscribers = new Map<number, Set<WebSocket>>();

function getSuperAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
}

function isSuperAdminEmail(email: string): boolean {
  return getSuperAdminEmails().includes(email.toLowerCase());
}

function isAdminOrAbove(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const wss = new WebSocketServer({ server: httpServer, path: "/ws/tracking" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const requestId = Number(url.searchParams.get("requestId"));
    const role = url.searchParams.get("role");

    if (!requestId) {
      ws.close();
      return;
    }

    if (!locationSubscribers.has(requestId)) {
      locationSubscribers.set(requestId, new Set());
    }
    locationSubscribers.get(requestId)!.add(ws);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "location_update" && role === "collector") {
          const subscribers = locationSubscribers.get(requestId);
          if (subscribers) {
            const broadcast = JSON.stringify({
              type: "collector_location",
              latitude: msg.latitude,
              longitude: msg.longitude,
              timestamp: Date.now(),
            });
            subscribers.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(broadcast);
              }
            });
          }
        }
      } catch {}
    });

    ws.on("close", () => {
      const subscribers = locationSubscribers.get(requestId);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) locationSubscribers.delete(requestId);
      }
    });
  });

  // ===== REGISTRATION & LOGIN =====
  app.post("/api/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const existingPhone = await storage.getUserByPhone(data.phone);
      if (existingPhone) {
        return res.status(400).json({ message: "An account with this phone number already exists" });
      }

      const normalizedIc = data.icNumber.replace(/[-\s]/g, "");
      const existingIc = await storage.getUserByIcNumber(normalizedIc);
      if (existingIc) {
        return res.status(400).json({ message: "An account with this IC number already exists" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const userId = crypto.randomUUID();

      const assignedRole = isSuperAdminEmail(data.email) ? "super_admin" : data.role;

      const user = await storage.createUser({
        id: userId,
        email: data.email,
        username: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: assignedRole,
        phone: data.phone,
        vehicleType: data.vehicleType || null,
        icNumber: normalizedIc,
        icFrontPhoto: data.icFrontPhoto,
        icBackPhoto: data.icBackPhoto,
        verificationStatus: "pending",
      });
      const safeUser = { ...user, password: undefined };
      (req as any).login({ claims: { sub: userId, email: data.email, first_name: data.firstName, last_name: data.lastName } }, (err: any) => {
        if (err) return res.status(500).json({ message: "Registration succeeded but auto-login failed" });
        res.status(201).json(safeUser);
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors?.[0]?.message || "Invalid input" });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.banned) {
        return res.status(403).json({ message: `Your account has been banned.${user.banReason ? ` Reason: ${user.banReason}` : ""}` });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (isSuperAdminEmail(email) && user.role !== "super_admin") {
        await storage.updateUserRole(user.id, "super_admin");
        user.role = "super_admin";
      }

      const safeUser = { ...user, password: undefined };
      (req as any).login({ claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName } }, (err: any) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json(safeUser);
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ===== ADMIN: Verify user IC =====
  app.post("/api/admin/users/:id/verify", isAuthenticated, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const admin = await storage.getUser(adminId);
    if (!admin || !isAdminOrAbove(admin.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { status } = req.body;
    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'verified' or 'rejected'" });
    }
    const user = await storage.updateUserVerification(req.params.id, status);
    res.json(user);
  });

  // ===== ADMIN: Ban/Unban user =====
  app.post("/api/admin/users/:id/ban", isAuthenticated, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const admin = await storage.getUser(adminId);
    if (!admin || !isAdminOrAbove(admin.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.role === "super_admin") {
      return res.status(400).json({ message: "Cannot ban a super admin" });
    }
    if (targetUser.role === "admin" && admin.role !== "super_admin") {
      return res.status(400).json({ message: "Only super admin can ban admins" });
    }
    const { reason } = req.body;
    const updated = await storage.updateUserBan(req.params.id, true, reason || "Banned by admin");
    res.json(updated);
  });

  app.post("/api/admin/users/:id/unban", isAuthenticated, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const admin = await storage.getUser(adminId);
    if (!admin || !isAdminOrAbove(admin.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.updateUserBan(req.params.id, false);
    res.json(updated);
  });

  // ===== SUPER ADMIN: Promote/Demote admin =====
  app.post("/api/admin/users/:id/promote", isAuthenticated, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const admin = await storage.getUser(adminId);
    if (!admin || admin.role !== "super_admin") {
      return res.status(403).json({ message: "Only super admin can promote users to admin" });
    }
    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.role === "super_admin") {
      return res.status(400).json({ message: "Cannot modify super admin role" });
    }
    const updated = await storage.updateUserRole(req.params.id, "admin");
    res.json(updated);
  });

  app.post("/api/admin/users/:id/demote", isAuthenticated, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const admin = await storage.getUser(adminId);
    if (!admin || admin.role !== "super_admin") {
      return res.status(403).json({ message: "Only super admin can demote admins" });
    }
    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.role === "super_admin") {
      return res.status(400).json({ message: "Cannot demote a super admin" });
    }
    if (targetUser.role !== "admin") {
      return res.status(400).json({ message: "User is not an admin" });
    }
    const demoteTo = req.body.role || "seller";
    if (!["seller", "collector"].includes(demoteTo)) {
      return res.status(400).json({ message: "Can only demote to seller or collector" });
    }
    const updated = await storage.updateUserRole(req.params.id, demoteTo);
    res.json(updated);
  });

  app.post("/api/users/status", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { isOnline } = req.body;
    const user = await storage.updateUserStatus(userId, isOnline);
    res.json(user);
  });

  app.post("/api/users/location", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { latitude, longitude } = req.body;
    await storage.updateUserLocation(userId, String(latitude), String(longitude));
    res.sendStatus(200);
  });

  app.post("/api/requests", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const data = insertRequestSchema.parse(req.body);
      const request = await storage.createRequest({
        ...data,
        sellerId: userId,
        itemTypes: data.itemTypes || [],
      });
      res.status(201).json(request);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Invalid request data" });
    }
  });

  app.get("/api/requests", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).send();

    if (user.role === "collector") {
      const available = await storage.getAvailableRequests();
      const myJobs = await storage.getCollectorRequests(userId);
      const ids = new Set(myJobs.map(j => j.id));
      const combined = [...myJobs, ...available.filter(a => !ids.has(a.id))];
      return res.json(combined);
    } else {
      return res.json(await storage.getRequestsBySeller(userId));
    }
  });

  app.get("/api/requests/:id", isAuthenticated, async (req, res) => {
    const request = await storage.getRequest(Number(req.params.id));
    if (!request) return res.status(404).json({ message: "Not found" });
    res.json(request);
  });

  app.post("/api/requests/:id/accept", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.role !== "collector") return res.status(403).send();

    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    if (!request) return res.status(404).json({ message: "Not found" });
    if (request.status !== "pending") return res.status(400).json({ message: "Job already taken" });

    const updated = await storage.updateRequestStatus(id, "accepted", userId);
    res.json(updated);
  });

  app.post("/api/requests/:id/start", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    if (!request || request.collectorId !== userId) return res.status(403).send();
    if (request.status !== "accepted") return res.status(400).json({ message: "Cannot start this job" });

    const updated = await storage.updateRequestStatus(id, "in_progress");
    res.json(updated);
  });

  app.post("/api/requests/:id/complete", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.role !== "collector") return res.status(403).send();

    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    if (!request) return res.status(404).json({ message: "Not found" });
    
    const { actualWeight, facilityId, verifiedTypes } = req.body;

    const prices = await storage.getMarketPrices();
    const types = verifiedTypes && verifiedTypes.length > 0 ? verifiedTypes : (request.itemTypes || []);
    let avgPrice = 0;
    if (types.length > 0) {
      const totalPrice = types.reduce((sum: number, t: string) => {
        const p = prices.find(mp => mp.materialType === t);
        return sum + (p ? Number(p.pricePerKg) : 0);
      }, 0);
      avgPrice = totalPrice / types.length;
    }

    const totalValue = Number(actualWeight) * avgPrice;
    const commission = totalValue * 0.20;
    const sellerPayout = totalValue * 0.80;

    const updated = await storage.completeRequest(
      id, Number(actualWeight), facilityId, String(totalValue.toFixed(2)), String(commission.toFixed(2))
    );

    if (request.sellerId) {
      await storage.updateUserBalance(request.sellerId, sellerPayout);
      await storage.createWalletTransaction({
        userId: request.sellerId,
        type: "payout",
        amount: String(sellerPayout.toFixed(2)),
        description: `Payout for request #${id}`,
        relatedRequestId: id,
      });
    }

    await storage.updateUserBalance(userId, totalValue - commission);
    await storage.createWalletTransaction({
      userId: userId,
      type: "payout",
      amount: String((totalValue - commission).toFixed(2)),
      description: `Earnings for job #${id}`,
      relatedRequestId: id,
    });

    await storage.createWalletTransaction({
      userId: userId,
      type: "commission",
      amount: String((-commission).toFixed(2)),
      description: `Platform commission (20%) for job #${id}`,
      relatedRequestId: id,
    });

    res.json(updated);
  });

  app.post("/api/requests/:id/cancel", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    if (!request) return res.status(404).json({ message: "Not found" });
    if (request.sellerId !== userId && request.collectorId !== userId) return res.status(403).send();
    if (request.status === "completed" || request.status === "cancelled") {
      return res.status(400).json({ message: "Cannot cancel this request" });
    }
    const updated = await storage.updateRequestStatus(id, "cancelled");
    res.json(updated);
  });

  app.get("/api/facilities", async (_req, res) => {
    res.json(await storage.getFacilities());
  });

  app.get("/api/prices", async (_req, res) => {
    res.json(await storage.getMarketPrices());
  });

  app.post("/api/wallet/topup", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Invalid amount" });

    const user = await storage.updateUserBalance(userId, Number(amount));
    await storage.createWalletTransaction({
      userId,
      type: "topup",
      amount: String(Number(amount).toFixed(2)),
      description: "Wallet top-up via FPX",
    });
    res.json(user);
  });

  app.post("/api/wallet/withdraw", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { amount } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).send();
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Invalid amount" });
    if (Number(user.balance) < Number(amount)) return res.status(400).json({ message: "Insufficient balance" });

    await storage.updateUserBalance(userId, -Number(amount));
    await storage.createWalletTransaction({
      userId,
      type: "withdrawal",
      amount: String((-Number(amount)).toFixed(2)),
      description: "Withdrawal to bank account",
    });
    const updated = await storage.getUser(userId);
    res.json(updated);
  });

  app.get("/api/wallet/transactions", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getWalletTransactions(userId));
  });

  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || !isAdminOrAbove(user.role)) return res.status(403).send();
    res.json(await storage.getStats());
  });

  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || !isAdminOrAbove(user.role)) return res.status(403).send();
    res.json(await storage.getAllUsers());
  });

  app.get("/api/admin/requests", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || !isAdminOrAbove(user.role)) return res.status(403).send();
    res.json(await storage.getAllRequests());
  });

  app.get("/api/admin/transactions", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || !isAdminOrAbove(user.role)) return res.status(403).send();
    res.json(await storage.getAllWalletTransactions());
  });

  app.patch("/api/admin/users/:id/role", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.role !== "super_admin") return res.status(403).json({ message: "Only super admin can change roles" });
    const { role } = req.body;
    if (!["seller", "collector", "admin", "super_admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    if (role === "super_admin") return res.status(400).json({ message: "Cannot assign super_admin role through this endpoint" });
    const updated = await storage.updateUserRole(req.params.id, role);
    res.json(updated);
  });

  app.patch("/api/admin/prices/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || !isAdminOrAbove(user.role)) return res.status(403).send();
    const { pricePerKg } = req.body;
    if (!pricePerKg || Number(pricePerKg) < 0) return res.status(400).json({ message: "Invalid price" });
    const updated = await storage.updateMarketPrice(Number(req.params.id), String(pricePerKg));
    res.json(updated);
  });

  await seedData();
  return httpServer;
}

async function seedData() {
  await storage.seedFacilities([
    { name: "Green Earth Recycling", address: "123 Eco Lane, Kuala Lumpur", latitude: "3.1390", longitude: "101.6869", acceptedMaterials: ["plastic", "paper", "metal"], phone: "+60 3-2181 1234", operatingHours: "Mon-Sat 8am-6pm" },
    { name: "City Scrap Metal", address: "45 Industrial Blvd, Petaling Jaya", latitude: "3.1400", longitude: "101.6900", acceptedMaterials: ["metal", "ewaste"], phone: "+60 3-7960 5678", operatingHours: "Mon-Fri 9am-5pm" },
    { name: "EcoWaste Solutions", address: "88 Green Road, Shah Alam", latitude: "3.0733", longitude: "101.5185", acceptedMaterials: ["plastic", "paper", "glass", "other"], phone: "+60 3-5510 9012", operatingHours: "Daily 7am-7pm" },
    { name: "TechRecycle Hub", address: "12 Digital Ave, Cyberjaya", latitude: "2.9213", longitude: "101.6538", acceptedMaterials: ["ewaste", "metal"], phone: "+60 3-8312 3456", operatingHours: "Mon-Fri 10am-6pm" },
  ]);
  await storage.seedMarketPrices([
    { materialType: "plastic", pricePerKg: "1.50" },
    { materialType: "paper", pricePerKg: "0.80" },
    { materialType: "metal", pricePerKg: "4.00" },
    { materialType: "ewaste", pricePerKg: "10.00" },
    { materialType: "glass", pricePerKg: "0.50" },
    { materialType: "other", pricePerKg: "0.30" },
  ]);
}
