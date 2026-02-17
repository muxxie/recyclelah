import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { Loader2 } from "lucide-react";
import AuthPage from "@/pages/auth-page";
import SellerDashboard from "@/pages/seller-dashboard";
import CollectorDashboard from "@/pages/collector-dashboard";
import WalletPage from "@/pages/wallet-page";
import MarketPage from "@/pages/market-page";
import FacilitiesPage from "@/pages/facilities-page";
import TrackingPage from "@/pages/tracking-page";
import AdminDashboard from "@/pages/admin-dashboard";
import VerifyPage from "@/pages/verify-page";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const isAdminRole = user?.role === "admin" || user?.role === "super_admin";
  const homeRedirect = !user ? "/" : isAdminRole ? "/admin" : user.role === "collector" ? "/collector" : "/dashboard";

  return (
    <LayoutShell>
      <Switch>
        <Route path="/">
          {user ? <Redirect to={homeRedirect} /> : <AuthPage />}
        </Route>
        <Route path="/dashboard">
          {!user ? <Redirect to="/" /> : isAdminRole ? <Redirect to="/admin" /> : <SellerDashboard />}
        </Route>
        <Route path="/collector">
          {!user ? <Redirect to="/" /> : user.role !== "collector" ? <Redirect to={homeRedirect} /> : <CollectorDashboard />}
        </Route>
        <Route path="/wallet">
          {!user ? <Redirect to="/" /> : <WalletPage />}
        </Route>
        <Route path="/tracking/:id">
          {!user ? <Redirect to="/" /> : <TrackingPage />}
        </Route>
        <Route path="/admin">
          {!user ? <Redirect to="/" /> : !isAdminRole ? <Redirect to={homeRedirect} /> : <AdminDashboard />}
        </Route>
        <Route path="/market">
          {!user ? <Redirect to="/" /> : <MarketPage />}
        </Route>
        <Route path="/facilities">
          {!user ? <Redirect to="/" /> : <FacilitiesPage />}
        </Route>
        <Route path="/verify">
          {!user ? <Redirect to="/" /> : <VerifyPage />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </LayoutShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
