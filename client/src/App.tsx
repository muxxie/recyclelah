import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";

import AuthPage from "@/pages/auth-page";
import SellerDashboard from "@/pages/seller-dashboard";
import CollectorDashboard from "@/pages/collector-dashboard";
import MarketPage from "@/pages/market-page";
import FacilitiesPage from "@/pages/facilities-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <LayoutShell>
      <Switch>
        <Route path="/" component={AuthPage} />
        <Route path="/dashboard" component={SellerDashboard} />
        <Route path="/history" component={SellerDashboard} />
        <Route path="/collector" component={CollectorDashboard} />
        <Route path="/collector/my-jobs" component={CollectorDashboard} />
        <Route path="/market" component={MarketPage} />
        <Route path="/facilities" component={FacilitiesPage} />
        <Route component={NotFound} />
      </Switch>
    </LayoutShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
