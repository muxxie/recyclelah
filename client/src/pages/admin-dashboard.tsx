import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Package, DollarSign, TrendingUp, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import type { User } from "@shared/models/auth";
import type { Request, WalletTransaction, MarketPrice } from "@shared/schema";

function StatsCards({ stats }: { stats: any }) {
  const cards = [
    { label: "Total Jobs", value: stats.totalJobs, icon: Package, fmt: (v: number) => String(v) },
    { label: "Total Weight", value: stats.totalWeight, icon: Scale, fmt: (v: number) => `${v.toFixed(1)} kg` },
    { label: "Total Payout", value: stats.totalPayout, icon: DollarSign, fmt: (v: number) => `RM ${v.toFixed(2)}` },
    { label: "Commission (20%)", value: stats.totalCommission, icon: TrendingUp, fmt: (v: number) => `RM ${v.toFixed(2)}` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <c.icon className="w-3.5 h-3.5" />
              {c.label}
            </div>
            <p className="text-lg md:text-xl font-bold font-display" data-testid={`text-stat-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
              {c.fmt(c.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsersTab() {
  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role Updated" });
    },
  });

  if (isLoading) return <Loader2 className="animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-2">
      {users?.map((u) => (
        <Card key={u.id}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" data-testid={`text-user-name-${u.id}`}>
                {u.firstName ? `${u.firstName} ${u.lastName || ""}` : u.username || u.email || u.id}
              </p>
              <p className="text-xs text-muted-foreground truncate">{u.email || "No email"}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Badge variant="outline" className="text-xs capitalize">{u.role}</Badge>
              <p className="text-xs font-medium">RM {Number(u.balance || 0).toFixed(2)}</p>
              <Select defaultValue={u.role} onValueChange={(role) => updateRole.mutate({ id: u.id, role })}>
                <SelectTrigger className="w-28" data-testid={`select-role-${u.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Seller</SelectItem>
                  <SelectItem value="collector">Collector</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RequestsTab() {
  const { data: requests, isLoading } = useQuery<Request[]>({ queryKey: ["/api/admin/requests"] });

  if (isLoading) return <Loader2 className="animate-spin text-primary mx-auto" />;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-blue-100 text-blue-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-2">
      {requests?.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">Job #{r.id}</p>
                <Badge variant="outline" className={`text-[10px] ${statusColors[r.status] || ""}`}>
                  {r.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{r.address}</p>
              <p className="text-xs text-muted-foreground">
                {r.itemTypes?.join(", ")} - Est. {r.estimatedWeight}kg
                {r.actualWeight ? ` / Actual ${r.actualWeight}kg` : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              {r.totalPayout && (
                <p className="text-sm font-bold text-primary">RM {Number(r.totalPayout).toFixed(2)}</p>
              )}
              {r.commissionAmount && (
                <p className="text-[10px] text-muted-foreground">Commission: RM {Number(r.commissionAmount).toFixed(2)}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {r.createdAt ? format(new Date(r.createdAt), "PP") : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
      {(!requests || requests.length === 0) && (
        <div className="text-center py-10 text-sm text-muted-foreground">No requests yet</div>
      )}
    </div>
  );
}

function PricesTab() {
  const { data: prices, isLoading } = useQuery<MarketPrice[]>({ queryKey: ["/api/prices"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const updatePrice = useMutation({
    mutationFn: async ({ id, pricePerKg }: { id: number; pricePerKg: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/prices/${id}`, { pricePerKg });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      setEditingId(null);
      toast({ title: "Price Updated" });
    },
  });

  if (isLoading) return <Loader2 className="animate-spin text-primary mx-auto" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {prices?.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-4">
            <p className="text-sm font-medium capitalize mb-2">{p.materialType}</p>
            {editingId === p.id ? (
              <div className="flex gap-2">
                <Input
                  data-testid={`input-price-${p.id}`}
                  type="number"
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={() => updatePrice.mutate({ id: p.id, pricePerKg: editValue })} data-testid={`button-save-price-${p.id}`}>
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold font-display text-primary">RM {Number(p.pricePerKg).toFixed(2)}/kg</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingId(p.id); setEditValue(String(p.pricePerKg)); }}
                  data-testid={`button-edit-price-${p.id}`}
                >
                  Edit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TransactionsTab() {
  const { data: transactions, isLoading } = useQuery<WalletTransaction[]>({ queryKey: ["/api/admin/transactions"] });

  if (isLoading) return <Loader2 className="animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-2">
      {transactions?.map((tx) => (
        <Card key={tx.id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
              <p className="text-xs text-muted-foreground">
                User: {tx.userId.substring(0, 8)}... | {tx.createdAt ? format(new Date(tx.createdAt), "PPp") : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {Number(tx.amount) >= 0 ? "+" : ""}RM {Math.abs(Number(tx.amount)).toFixed(2)}
              </p>
              <Badge variant="outline" className="text-[10px] capitalize">{tx.type.replace("_", " ")}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      {(!transactions || transactions.length === 0) && (
        <div className="text-center py-10 text-sm text-muted-foreground">No transactions yet</div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats"] });

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-admin-title">Admin Dashboard</h1>

      <StatsCards stats={stats || { totalJobs: 0, totalWeight: 0, totalPayout: 0, totalCommission: 0 }} />

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="users" data-testid="tab-admin-users">
            <Users className="w-4 h-4 mr-1 hidden sm:inline" />
            Users
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-admin-requests">
            <Package className="w-4 h-4 mr-1 hidden sm:inline" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="prices" data-testid="tab-admin-prices">
            <DollarSign className="w-4 h-4 mr-1 hidden sm:inline" />
            Prices
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-admin-transactions">
            <TrendingUp className="w-4 h-4 mr-1 hidden sm:inline" />
            Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="prices"><PricesTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
