
import { z } from 'zod';
import { insertUserSchema, insertRequestSchema, insertFacilitySchema, insertMarketPriceSchema, registerSchema, users, requests, facilities, marketPrices } from './schema';

// ============================================
// API CONTRACT
// ============================================

export const api = {
  // Auth
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register' as const,
      input: registerSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ email: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.void(),
      },
    }
  },
  
  // Users (Collector specific)
  users: {
    toggleStatus: {
      method: 'POST' as const,
      path: '/api/users/status' as const,
      input: z.object({ isOnline: z.boolean() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
      },
    },
    updateLocation: {
      method: 'POST' as const,
      path: '/api/users/location' as const,
      input: z.object({ latitude: z.number(), longitude: z.number() }),
      responses: {
        200: z.void(),
      },
    }
  },

  // Requests
  requests: {
    create: {
      method: 'POST' as const,
      path: '/api/requests' as const,
      input: insertRequestSchema,
      responses: {
        201: z.custom<typeof requests.$inferSelect>(),
      },
    },
    list: { // For sellers (my requests) or collectors (available requests)
      method: 'GET' as const,
      path: '/api/requests' as const,
      responses: {
        200: z.array(z.custom<typeof requests.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/requests/:id' as const,
      responses: {
        200: z.custom<typeof requests.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    accept: { // For collectors
      method: 'POST' as const,
      path: '/api/requests/:id/accept' as const,
      responses: {
        200: z.custom<typeof requests.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    complete: { // For collectors (verify & submit)
      method: 'POST' as const,
      path: '/api/requests/:id/complete' as const,
      input: z.object({
        actualWeight: z.number(),
        facilityId: z.number(),
        verifiedTypes: z.array(z.string()),
      }),
      responses: {
        200: z.custom<typeof requests.$inferSelect>(),
      },
    }
  },

  // Facilities
  facilities: {
    list: {
      method: 'GET' as const,
      path: '/api/facilities' as const,
      responses: {
        200: z.array(z.custom<typeof facilities.$inferSelect>()),
      },
    },
  },

  // Market Prices
  prices: {
    list: {
      method: 'GET' as const,
      path: '/api/prices' as const,
      responses: {
        200: z.array(z.custom<typeof marketPrices.$inferSelect>()),
      },
    },
  },

  // Admin
  admin: {
    stats: {
      method: 'GET' as const,
      path: '/api/admin/stats' as const,
      responses: {
        200: z.object({
          totalJobs: z.number(),
          totalWeight: z.number(),
          totalPayout: z.number(), // To sellers
          totalCollectorEarnings: z.number(), // Total paid out to collector (which includes their share) - wait, spec says "Collector receives full payout... App takes 20%".
          // Re-reading spec: "Payout = (market price * weight). Collector receives full payout instantly. App takes 20% commission automatically. Seller receives payout instantly via collector credit"
          // This implies the Collector PAYS the seller? Or the platform pays?
          // "Seller receives payout instantly via 'collector credit' (simulated)" -> sounds like Collector pays Seller?
          // Let's assume: Platform calculates total value. 
          // 80% goes to Seller. 20% commission to Platform.
          // OR: Collector pays Seller cash? 
          // "Collector credit" usually means an in-app wallet.
          // Let's stick to the prompt's stats:
          // - Total jobs completed
          // - Total kg collected
          // - Total payout to sellers
          // - Total payout to collectors
          // - Total commission earned (20%)
          totalCommission: z.number(),
        }),
      },
    }
  }
};

// ============================================
// HELPERS
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
