import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Leaf,
  LayoutDashboard,
  MapPin,
  LogOut,
  Truck,
  Wallet,
  BarChart3,
  Menu,
  X,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return <div className="min-h-screen bg-background">{children}</div>;

  const isAdmin = user.role === "admin" || user.role === "super_admin";
  const isCollector = user.role === "collector";

  const links = isAdmin
    ? [
        { href: "/admin", label: "Dashboard", icon: ShieldCheck },
        { href: "/market", label: "Market Prices", icon: TrendingUp },
        { href: "/facilities", label: "Facilities", icon: MapPin },
      ]
    : isCollector
    ? [
        { href: "/collector", label: "Dashboard", icon: LayoutDashboard },
        { href: "/wallet", label: "Wallet", icon: Wallet },
        { href: "/facilities", label: "Facilities", icon: MapPin },
        { href: "/market", label: "Prices", icon: TrendingUp },
      ]
    : [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/wallet", label: "Wallet", icon: Wallet },
        { href: "/market", label: "Prices", icon: TrendingUp },
        { href: "/facilities", label: "Facilities", icon: MapPin },
      ];

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <header className="md:hidden flex items-center justify-between p-3 bg-card border-b sticky top-0 z-50">
        <div className="flex items-center gap-2 text-primary font-bold text-lg font-display">
          <Leaf className="w-5 h-5 fill-primary" />
          RecycleLah!
        </div>
        <Button variant="ghost" size="icon" onClick={toggleMenu} data-testid="button-mobile-menu">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden fixed top-[52px] left-0 right-0 bg-card border-b shadow-lg z-40 p-3 space-y-1"
          >
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}>
                <div
                  className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                    location === link.href ? "bg-primary/10 text-primary font-semibold" : "text-foreground/70"
                  }`}
                  data-testid={`link-mobile-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </div>
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t">
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive"
                onClick={() => logoutMutation.mutate()}
                data-testid="button-mobile-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden md:flex flex-col w-56 bg-card border-r h-screen sticky top-0 p-4">
        <div className="flex items-center gap-2 text-primary font-bold text-xl font-display mb-6">
          <Leaf className="w-6 h-6 fill-primary" />
          RecycleLah!
        </div>

        <nav className="space-y-1 flex-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all cursor-pointer text-sm ${
                  location === link.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover-elevate"
                }`}
                data-testid={`link-sidebar-${link.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <link.icon className="w-4 h-4" />
                <span className="font-medium">{link.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="pt-4 border-t mt-auto space-y-3">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              {(user.firstName || user.username || "U").substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-xs truncate" data-testid="text-sidebar-username">
                {user.firstName || user.username}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">{user.role === "super_admin" ? "Super Admin" : user.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => logoutMutation.mutate()}
            data-testid="button-sidebar-logout"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto page-transition p-4 md:p-6 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
