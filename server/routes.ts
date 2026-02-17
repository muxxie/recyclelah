
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertUserSchema, insertRequestSchema } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";

const SessionStore = MemoryStore(session);

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      role: string;
    }
    interface Request {
      user?: User;
      isAuthenticated(): boolean;
      login(user: User, done: (err: any) => void): void;
      logout(done: (err: any) => void): void;
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Session Setup
  app.use(session({
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: { secure: false } // Set to true in production with HTTPS
  }));

  // Mock Passport-like auth middleware (simple custom impl for speed as requested)
  app.use((req, res, next) => {
    if (req.session && (req.session as any).user) {
      req.user = (req.session as any).user;
    }
    req.isAuthenticated = () => !!req.user;
    req.login = (user, done) => {
      (req.session as any).user = user;
      done(null);
    };
    req.logout = (done) => {
      (req.session as any).user = null;
      req.session.destroy(done);
    };
    next();
  });

  // === AUTH ===
  
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const existing = await storage.getUserByUsername(data.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(data);
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after register" });
        return res.status(201).json(user);
      });
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.login(user, (err) => {
      if (err) return res.status(500).json({ message: "Login failed" });
      return res.status(200).json(user);
    });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).send();
    }
  });

  // === USER STATUS (Collector) ===
  
  app.post(api.users.toggleStatus.path, async (req, res) => {
    if (!req.user) return res.status(401).send();
    const { isOnline } = req.body;
    const user = await storage.updateUserStatus(req.user.id, isOnline);
    // Update session user to reflect change
    (req.session as any).user = user;
    res.json(user);
  });

  app.post(api.users.updateLocation.path, async (req, res) => {
    if (!req.user) return res.status(401).send();
    const { latitude, longitude } = req.body;
    await storage.updateUserLocation(req.user.id, String(latitude), String(longitude));
    res.sendStatus(200);
  });

  // === REQUESTS ===

  app.post(api.requests.create.path, async (req, res) => {
    if (!req.user) return res.status(401).send();
    const data = insertRequestSchema.parse(req.body);
    const request = await storage.createRequest({
      ...data,
      sellerId: req.user.id,
      status: "pending",
      itemTypes: data.itemTypes || [],
    });
    res.status(201).json(request);
  });

  app.get(api.requests.list.path, async (req, res) => {
    if (!req.user) return res.status(401).send();
    
    if (req.user.role === "collector") {
      // Collectors see pending requests (available) AND their accepted requests
      // For now, let's just return available + my active jobs
      const available = await storage.getAvailableRequests();
      const myJobs = await storage.getCollectorRequests(req.user.id);
      // Combine and dedup if needed, or endpoint could support a filter query
      // For simplicity, returning all relevant to context.
      // Ideally query param ?filter=available vs ?filter=mine
      
      // Let's just return all relevant for now and let frontend filter, 
      // or standard 'available' list.
      // Re-reading spec: "Receive job alerts" -> "Available jobs" list
      return res.json([...available, ...myJobs]);
    } else {
      // Seller sees their own requests
      const myRequests = await storage.getRequestsBySeller(req.user.id);
      return res.json(myRequests);
    }
  });

  app.get(api.requests.get.path, async (req, res) => {
    const request = await storage.getRequest(Number(req.params.id));
    if (!request) return res.status(404).json({ message: "Not found" });
    res.json(request);
  });

  app.post(api.requests.accept.path, async (req, res) => {
    if (!req.user || req.user.role !== 'collector') return res.status(403).send();
    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    
    if (!request) return res.status(404).json({ message: "Not found" });
    if (request.status !== "pending") return res.status(400).json({ message: "Job already taken" });
    
    const updated = await storage.updateRequestStatus(id, "accepted", req.user.id);
    res.json(updated);
  });

  app.post(api.requests.complete.path, async (req, res) => {
    if (!req.user || req.user.role !== 'collector') return res.status(403).send();
    const id = Number(req.params.id);
    const { actualWeight, facilityId, verifiedTypes } = req.body;
    
    // Calculate payout
    // Payout = weight * price of verified types
    // Simplified: Use the first verified type or average? Spec says "item type". 
    // Assuming primary type for calculation.
    
    // In a real app we'd sum up multiple types. Let's pick the first one from verifiedTypes for price.
    let pricePerKg = 0;
    if (verifiedTypes && verifiedTypes.length > 0) {
       const marketPrice = await storage.getMarketPrice(verifiedTypes[0]);
       if (marketPrice) {
         pricePerKg = Number(marketPrice.pricePerKg);
       }
    }
    
    const totalValue = Number(actualWeight) * pricePerKg;
    const commission = totalValue * 0.20;
    const sellerPayout = totalValue - commission; // Wait, spec says "Collector receives full payout... App takes 20% commission".
    // Usually: Center pays Collector $100. Collector owes App $20. Collector pays Seller $?
    // Spec: "Seller receives payout instantly via 'collector credit'".
    // Let's simplify:
    // Total Payout recorded is the total value of goods.
    // Commission is 20%.
    
    const updated = await storage.completeRequest(
      id, 
      String(actualWeight), 
      facilityId, 
      String(totalValue), 
      String(commission)
    );
    
    res.json(updated);
  });

  // === INFO ===

  app.get(api.facilities.list.path, async (req, res) => {
    const list = await storage.getFacilities();
    res.json(list);
  });

  app.get(api.prices.list.path, async (req, res) => {
    const list = await storage.getMarketPrices();
    res.json(list);
  });

  app.get(api.admin.stats.path, async (req, res) => {
    // Simple admin check
    if (!req.user || req.user.role !== 'admin') {
      // Allow for demo purposes if no admin exists? No, secure it.
      // But we can create a default admin.
       return res.status(403).send();
    }
    const stats = await storage.getStats();
    res.json(stats);
  });

  // === SEED DATA ===
  await seedData();

  return httpServer;
}

async function seedData() {
  await storage.seedFacilities([
    { name: "Green Earth Recycling", address: "123 Eco Lane", latitude: "3.1390", longitude: "101.6869", acceptedMaterials: ["plastic", "paper", "metal"] },
    { name: "City Scrap Metal", address: "45 Industrial Blvd", latitude: "3.1400", longitude: "101.6900", acceptedMaterials: ["metal", "ewaste"] },
  ]);
  
  await storage.seedMarketPrices([
    { materialType: "plastic", pricePerKg: "1.50" },
    { materialType: "paper", pricePerKg: "0.80" },
    { materialType: "metal", pricePerKg: "4.00" },
    { materialType: "ewaste", pricePerKg: "10.00" },
    { materialType: "glass", pricePerKg: "0.50" },
  ]);
  
  // Create a default admin if none exists
  if (!await storage.getUserByUsername("admin")) {
    await storage.createUser({
      username: "admin",
      password: "admin123", // In a real app, hash this!
      role: "admin",
      phone: "000-0000",
      address: "HQ",
      isOnline: false,
      balance: "0",
      latitude: "0",
      longitude: "0",
      vehicleType: null
    });
  }
}
