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
import MarketPage from "@/pages/market-page";
import FacilitiesPage from "@/pages/facilities-page";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return (
    <LayoutShell>
      <Switch>
        <Route path="/">{user ? (user.role === "collector" ? <Redirect to="/collector" /> : <Redirect to="/dashboard" />) : <AuthPage />}</Route>
        <Route path="/dashboard">{!user ? <Redirect to="/" /> : <SellerDashboard />}</Route>
        <Route path="/history">{!user ? <Redirect to="/" /> : <SellerDashboard />}</Route>
        <Route path="/collector">{!user || user.role !== "collector" ? <Redirect to="/" /> : <CollectorDashboard />}</Route>
        <Route path="/collector/my-jobs">{!user || user.role !== "collector" ? <Redirect to="/" /> : <CollectorDashboard />}</Route>
        <Route path="/market" component={MarketPage} />
        <Route path="/facilities" component={FacilitiesPage} />
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
