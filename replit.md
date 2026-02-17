# RecycleLah!

## Overview

RecycleLah! is a full-stack web application that connects people who want to recycle items (Sellers) with gig workers who pick up recyclables (Collectors) — similar to Uber/Grab but for recycling. Sellers can request immediate or scheduled recycling pickups, while Collectors can go online, accept nearby jobs, pick up items, and submit them to recycling facilities. The app includes market pricing for recyclable materials, facility listings, job tracking, and a commission-based payout system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state (data fetching, caching, mutations)
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming. Eco-friendly green color palette. Mobile-first responsive design with a sidebar layout on desktop and hamburger menu on mobile.
- **Fonts**: Inter (body) and Outfit (display/headings) from Google Fonts
- **Animations**: Framer Motion for transitions and micro-interactions
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend

- **Framework**: Express.js running on Node.js with TypeScript (executed via tsx)
- **HTTP Server**: Node's built-in `http.createServer` wrapping Express
- **Authentication**: Replit OpenID Connect (OIDC) integration via Passport.js with session-based auth stored in PostgreSQL. The auth system uses `openid-client` and `passport` with `connect-pg-simple` for session storage.
- **API Design**: RESTful JSON API under `/api/` prefix. Routes are defined in `server/routes.ts` with a shared route contract in `shared/routes.ts` that defines paths, methods, input schemas, and response schemas using Zod.
- **Middleware**: JSON body parsing, URL-encoded body parsing, request logging for API routes, error handling middleware

### Shared Code (`shared/`)

- **Schema**: Drizzle ORM table definitions in `shared/schema.ts` and `shared/models/auth.ts`. These define the database schema and are the single source of truth for both DB operations and type inference.
- **Route Contract**: `shared/routes.ts` defines the API contract with Zod schemas for inputs and responses, used by both client and server.
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod` (`createInsertSchema`)

### Database

- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-orm/node-postgres` driver
- **Connection**: `pg.Pool` with connection string from `DATABASE_URL`
- **Schema Management**: `drizzle-kit push` for schema migrations (`npm run db:push`)
- **Tables**:
  - `users` — stores both sellers and collectors with role, location, online status, balance
  - `sessions` — PostgreSQL-backed session storage for authentication
  - `requests` — pickup requests with status lifecycle (pending → accepted → in_progress → completed → verified → cancelled)
  - `facilities` — recycling center locations with accepted material types
  - `market_prices` — current pricing per kg for each material type (plastic, paper, metal, ewaste, glass, other)

### Build System

- **Development**: Vite dev server with HMR proxied through Express
- **Production Build**: Custom `script/build.ts` that runs Vite build for client and esbuild for server, outputting to `dist/`. Server bundle is CommonJS (`dist/index.cjs`), client assets go to `dist/public/`.
- **Scripts**: `dev` (development), `build` (production build), `start` (production serve), `check` (TypeScript check), `db:push` (push schema to DB)

### Key Design Patterns

- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts all database operations, with `DatabaseStorage` as the PostgreSQL implementation. This makes it possible to swap storage backends.
- **Upsert Pattern**: Users are upserted on authentication (create if new, update if existing) to handle OIDC login flows.
- **Seed Data**: Facilities and market prices support seeding via `seedFacilities()` and `seedMarketPrices()` methods that only insert if tables are empty.
- **Role-Based Views**: The frontend renders different dashboards based on user role (`seller` vs `collector`). Routing guards redirect unauthorized users.

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required. Connection via `DATABASE_URL` environment variable. Used for all data storage and session management.
- **Replit Auth (OIDC)**: Authentication provider using Replit's OpenID Connect. Requires `ISSUER_URL` (defaults to `https://replit.com/oidc`), `REPL_ID`, and `SESSION_SECRET` environment variables.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit**: ORM and migration tooling for PostgreSQL
- **express** + **express-session**: HTTP server and session management
- **passport** + **openid-client**: Authentication via OIDC
- **connect-pg-simple**: PostgreSQL session store
- **@tanstack/react-query**: Server state management on client
- **react-hook-form** + **zod**: Form handling and validation
- **shadcn/ui** (Radix UI primitives): UI component library
- **framer-motion**: Animations
- **wouter**: Client-side routing
- **date-fns**: Date formatting
- **tailwindcss**: Utility-first CSS

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Secret for session encryption (required)
- `REPL_ID` — Replit environment identifier (required for auth)
- `ISSUER_URL` — OIDC issuer URL (optional, defaults to Replit's)
- `PORT` — Server port (optional, defaults to 5000)