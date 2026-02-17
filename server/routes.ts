import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertRequestSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.users.toggleStatus.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { isOnline } = req.body;
    const user = await storage.updateUserStatus(userId, isOnline);
    res.json(user);
  });

  app.post(api.users.updateLocation.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { latitude, longitude } = req.body;
    await storage.updateUserLocation(userId, String(latitude), String(longitude));
    res.sendStatus(200);
  });

  app.post(api.requests.create.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const data = insertRequestSchema.parse(req.body);
      const request = await storage.createRequest({
        ...data,
        sellerId: userId,
        status: "pending",
        itemTypes: data.itemTypes || [],
      });
      res.status(201).json(request);
    } catch (e) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  app.get(api.requests.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).send();

    if (user.role === "collector") {
      const available = await storage.getAvailableRequests();
      const myJobs = await storage.getCollectorRequests(userId);
      return res.json([...available, ...myJobs]);
    } else {
      const myRequests = await storage.getRequestsBySeller(userId);
      return res.json(myRequests);
    }
  });

  app.get(api.requests.get.path, isAuthenticated, async (req, res) => {
    const request = await storage.getRequest(Number(req.params.id));
    if (!request) return res.status(404).json({ message: "Not found" });
    res.json(request);
  });

  app.post(api.requests.accept.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'collector') return res.status(403).send();

    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    if (!request) return res.status(404).json({ message: "Not found" });
    if (request.status !== "pending") return res.status(400).json({ message: "Job already taken" });
    
    const updated = await storage.updateRequestStatus(id, "accepted", userId);
    res.json(updated);
  });

  app.post(api.requests.complete.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'collector') return res.status(403).send();

    const id = Number(req.params.id);
    const { actualWeight, facilityId, verifiedTypes } = req.body;
    
    let pricePerKg = 0;
    if (verifiedTypes && verifiedTypes.length > 0) {
       const marketPrice = await storage.getMarketPrice(verifiedTypes[0]);
       if (marketPrice) pricePerKg = Number(marketPrice.pricePerKg);
    }
    
    const totalValue = Number(actualWeight) * pricePerKg;
    const commission = totalValue * 0.20;
    
    const updated = await storage.completeRequest(
      id, Number(actualWeight), facilityId, String(totalValue), String(commission)
    );
    res.json(updated);
  });

  app.get(api.facilities.list.path, async (req, res) => {
    res.json(await storage.getFacilities());
  });

  app.get(api.prices.list.path, async (req, res) => {
    res.json(await storage.getMarketPrices());
  });

  app.get(api.admin.stats.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') return res.status(403).send();
    res.json(await storage.getStats());
  });

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
}
