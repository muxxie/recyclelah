import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Leaf, 
  LayoutDashboard, 
  MapPin, 
  LogOut, 
  Truck, 
  History,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isCollector = user.role === 'collector';

  const links = isCollector ? [
    { href: "/collector", label: "Available Jobs", icon: LayoutDashboard },
    { href: "/collector/my-jobs", label: "My Jobs", icon: Truck },
    { href: "/facilities", label: "Facilities", icon: MapPin },
  ] : [
    { href: "/dashboard", label: "New Request", icon: LayoutDashboard },
    { href: "/history", label: "History", icon: History },
    { href: "/market", label: "Market Prices", icon: Leaf },
  ];

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-50">
        <div className="flex items-center gap-2 text-primary font-bold text-xl font-display">
          <Leaf className="w-6 h-6 fill-primary" />
          RecycleLah!
        </div>
        <Button variant="ghost" size="icon" onClick={toggleMenu}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-16 left-0 right-0 bg-white border-b shadow-lg z-40 p-4 space-y-2"
          >
            {links.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}>
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location === link.href ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 hover:bg-muted'}`}>
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </div>
              </Link>
            ))}
            <div className="pt-4 mt-2 border-t">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r h-screen sticky top-0 p-6">
        <div className="flex items-center gap-2 text-primary font-bold text-2xl font-display mb-8">
          <Leaf className="w-8 h-8 fill-primary" />
          RecycleLah!
        </div>

        <nav className="space-y-2 flex-1">
          {links.map(link => (
            <Link key={link.href} href={link.href}>
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${location === link.href ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <link.icon className="w-5 h-5" />
                <span className="font-medium">{link.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="pt-6 border-t mt-auto">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:border-destructive/30"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto page-transition p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
