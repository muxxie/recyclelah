import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertRequestSchema, registerSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { encryptText, decryptText, isEncrypted, maskIcNumber } from "./utils/encryption";
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
      const icLookupHash = crypto.createHash("sha256").update(normalizedIc).digest("hex");
      const existingIcByHash = await storage.getUserByIcHash(icLookupHash);
      const existingIcByPlain = await storage.getUserByIcNumber(normalizedIc);
      if (existingIcByHash || existingIcByPlain) {
        return res.status(400).json({ message: "An account with this IC number already exists" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const userId = crypto.randomUUID();

      const assignedRole = isSuperAdminEmail(data.email) ? "super_admin" : data.role;

      const encryptedIc = encryptText(normalizedIc);

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
        gender: data.gender || null,
        icNumber: encryptedIc,
        icHash: icLookupHash,
        icFrontPhoto: data.icFrontPhoto,
        icBackPhoto: data.icBackPhoto,
        verificationStatus: "pending",
      });
      const safeUser = { ...user, password: undefined };
      const sessionUser = {
        claims: { sub: userId, email: data.email, first_name: data.firstName, last_name: data.lastName },
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
      };
      (req as any).login(sessionUser, (err: any) => {
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
      const sessionUser = {
        claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName },
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
      };
      (req as any).login(sessionUser, (err: any) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json(safeUser);
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ===== OTP: Send verification code =====
  app.post("/api/otp/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type, target } = req.body;

      if (!type || !target) {
        return res.status(400).json({ message: "Type and target are required" });
      }
      if (!["phone", "email"].includes(type)) {
        return res.status(400).json({ message: "Type must be 'phone' or 'email'" });
      }
      if (type === "phone" && !/^\+?\d{10,15}$/.test(target.replace(/[\s-]/g, ""))) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }
      if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const existing = await storage.getLatestOtp(userId, type, target);
      if (existing && !existing.verified) {
        const timeSinceSent = Date.now() - new Date(existing.createdAt!).getTime();
        if (timeSinceSent < 60000) {
          return res.status(429).json({ message: "Please wait before requesting a new code", retryAfter: Math.ceil((60000 - timeSinceSent) / 1000) });
        }
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await storage.createOtp({ userId, type, target, otpHash, expiresAt });

      if (type === "phone") {
        try {
          const { sendWhatsAppOtp } = await import("./services/twilio");
          const sent = await sendWhatsAppOtp(target, otp);
          if (!sent) {
            console.log(`[OTP-WhatsApp] Twilio failed, code for ${target}: ${otp}`);
          }
        } catch (err: any) {
          console.log(`[OTP-WhatsApp] Twilio not available, code for ${target}: ${otp} — ${err.message}`);
        }
      } else {
        console.log(`[OTP-Email] Code for ${target}: ${otp} (SendGrid integration pending)`);
      }

      res.json({ message: "Verification code sent", expiresIn: 600 });
    } catch (error: any) {
      console.error("OTP send error:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/otp/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type, target, code } = req.body;

      if (!type || !target || !code) {
        return res.status(400).json({ message: "Type, target, and code are required" });
      }

      const otp = await storage.getLatestOtp(userId, type, target);
      if (!otp) {
        return res.status(400).json({ message: "No verification code found. Please request a new one." });
      }

      if (otp.verified) {
        return res.status(400).json({ message: "This code has already been used" });
      }

      if (new Date() > new Date(otp.expiresAt)) {
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }

      if ((otp.attempts || 0) >= 5) {
        return res.status(400).json({ message: "Too many attempts. Please request a new code." });
      }

      await storage.incrementOtpAttempts(otp.id);

      const valid = await bcrypt.compare(code, otp.otpHash);
      if (!valid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      await storage.markOtpVerified(otp.id);

      if (type === "phone") {
        await storage.updateUser(userId, { phoneVerified: true });
      } else if (type === "email") {
        await storage.updateUser(userId, { emailVerified: true });
      }

      const updatedUser = await storage.getUser(userId);

      if (updatedUser && updatedUser.phoneVerified && updatedUser.emailVerified && updatedUser.verificationStatus !== "verified") {
        await storage.updateUser(userId, { verificationStatus: "verified" });
        const fullyVerified = await storage.getUser(userId);
        return res.json({ message: "Account fully verified! You now have full access.", user: { ...fullyVerified, password: undefined }, accountVerified: true });
      }

      res.json({ message: "Verified successfully", user: { ...updatedUser, password: undefined }, accountVerified: false });
    } catch (error: any) {
      console.error("OTP verify error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.get("/api/otp/status", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      verificationStatus: user.verificationStatus,
      accountVerified: user.verificationStatus === "verified",
    });
  });

  // ===== IC Upload via Object Storage =====
  app.post("/api/ic/upload-url", isAuthenticated, async (req: any, res) => {
    try {
      const { side, contentType } = req.body;
      if (!side || !["front", "back"].includes(side)) {
        return res.status(400).json({ message: "Side must be 'front' or 'back'" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({ uploadURL, objectPath, side });
    } catch (error: any) {
      console.error("IC upload URL error:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.post("/api/ic/save-urls", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { icFrontUrl, icBackUrl } = req.body;

      const updateData: any = {};
      if (icFrontUrl) updateData.icFrontUrl = icFrontUrl;
      if (icBackUrl) updateData.icBackUrl = icBackUrl;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "At least one URL is required" });
      }

      const user = await storage.updateUser(userId, updateData);
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("IC save URLs error:", error);
      res.status(500).json({ message: "Failed to save IC URLs" });
    }
  });

  // ===== ADMIN: Get user IC details (decrypted) =====
  app.get("/api/admin/users/:id/ic", isAuthenticated, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const admin = await storage.getUser(adminId);
    if (!admin || !isAdminOrAbove(admin.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let decryptedIc = user.icNumber || "";
    if (decryptedIc && isEncrypted(decryptedIc)) {
      decryptedIc = decryptText(decryptedIc);
    }

    res.json({
      icNumber: decryptedIc,
      maskedIc: maskIcNumber(decryptedIc),
      icFrontPhoto: user.icFrontPhoto,
      icBackPhoto: user.icBackPhoto,
      icFrontUrl: user.icFrontUrl,
      icBackUrl: user.icBackUrl,
      verificationStatus: user.verificationStatus,
      verificationNotes: user.verificationNotes,
    });
  });

  // ===== ADMIN: Verify user IC =====
  app.post("/api/admin/users/:id/verify", isAuthenticated, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const admin = await storage.getUser(adminId);
    if (!admin || !isAdminOrAbove(admin.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { status, notes } = req.body;
    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'verified' or 'rejected'" });
    }
    const user = await storage.updateUserVerification(req.params.id, status, notes);
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
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.verificationStatus !== "verified") {
      return res.status(403).json({ message: "Account not verified. Please complete phone and email verification first.", requiresVerification: true });
    }
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
    if (user.verificationStatus !== "verified") {
      return res.status(403).json({ message: "Account not verified. Please complete phone and email verification first.", requiresVerification: true });
    }

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
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.verificationStatus !== "verified") {
      return res.status(403).json({ message: "Account not verified. Please complete phone and email verification first.", requiresVerification: true });
    }
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Invalid amount" });

    const topupUser = await storage.updateUserBalance(userId, Number(amount));
    await storage.createWalletTransaction({
      userId,
      type: "topup",
      amount: String(Number(amount).toFixed(2)),
      description: "Wallet top-up via FPX",
    });
    res.json(topupUser);
  });

  app.post("/api/wallet/withdraw", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).send();
    if (user.verificationStatus !== "verified") {
      return res.status(403).json({ message: "Account not verified. Please complete phone and email verification first.", requiresVerification: true });
    }
    const { amount } = req.body;
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

  registerObjectStorageRoutes(app);

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
