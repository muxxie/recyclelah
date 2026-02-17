import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Package, DollarSign, TrendingUp, Scale, ShieldCheck, ShieldX, ShieldAlert, Eye, Ban, Search, Crown, UserPlus, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"><ShieldCheck className="w-3 h-3 mr-1" />Verified</Badge>;
  if (status === "rejected") return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"><ShieldX className="w-3 h-3 mr-1" />Rejected</Badge>;
  if (status === "pending") return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"><ShieldAlert className="w-3 h-3 mr-1" />Pending</Badge>;
  return <Badge variant="outline" className="text-[10px]">Unverified</Badge>;
}

function UsersTab() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [icDetails, setIcDetails] = useState<any>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [banDialogUser, setBanDialogUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterVerification, setFilterVerification] = useState("all");

  const promoteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/promote`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User promoted to Admin" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const demoteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/demote`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Admin demoted to regular user" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const verifyUser = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/verify`, { status, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setViewingUser(null);
      setIcDetails(null);
      toast({ title: "Verification Updated" });
    },
  });

  const banUser = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/ban`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setBanDialogUser(null);
      setBanReason("");
      toast({ title: "User Banned" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to ban user", description: error.message, variant: "destructive" });
    }
  });

  const unbanUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/unban`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Unbanned" });
    },
  });

  if (isLoading) return <Loader2 className="animate-spin text-primary mx-auto" />;

  const filtered = users?.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      (u.firstName && u.firstName.toLowerCase().includes(term)) ||
      (u.lastName && u.lastName.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.includes(term)) ||
      (u.icNumber && u.icNumber.includes(term));
    const matchesRole = filterRole === "all" || u.role === filterRole;
    const matchesVerification = filterVerification === "all" || u.verificationStatus === filterVerification;
    return matchesSearch && matchesRole && matchesVerification;
  }) || [];

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, IC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-32" data-testid="select-filter-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="seller">Seller</SelectItem>
              <SelectItem value="collector">Collector</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVerification} onValueChange={setFilterVerification}>
            <SelectTrigger className="w-36" data-testid="select-filter-verification">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? "s" : ""} found</p>

        {filtered.map((u) => (
          <Card key={u.id} className={u.banned ? "border-red-300 dark:border-red-800" : ""}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate" data-testid={`text-user-name-${u.id}`}>
                    {u.firstName ? `${u.firstName} ${u.lastName || ""}` : u.username || u.email || u.id}
                  </p>
                  {u.banned && (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                      <Ban className="w-3 h-3 mr-1" />Banned
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">{u.email || "No email"}</p>
                  {u.phone && <p className="text-xs text-muted-foreground">| {u.phone}</p>}
                </div>
                {u.banned && u.banReason && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Reason: {u.banReason}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <VerificationBadge status={u.verificationStatus} />
                {u.role === "super_admin" ? (
                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800">
                    <Crown className="w-3 h-3 mr-1" />Super Admin
                  </Badge>
                ) : u.role === "admin" ? (
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                    <ShieldCheck className="w-3 h-3 mr-1" />Admin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs capitalize">{u.role}</Badge>
                )}
                <p className="text-xs font-medium">RM {Number(u.balance || 0).toFixed(2)}</p>
                {(u.icFrontPhoto || u.icBackPhoto || u.icFrontUrl || u.icBackUrl || u.verificationStatus === "pending") && (
                  <Button size="icon" variant="outline" onClick={async () => {
                    setViewingUser(u);
                    setVerifyNotes("");
                    try {
                      const res = await fetch(`/api/admin/users/${u.id}/ic`);
                      if (res.ok) setIcDetails(await res.json());
                    } catch {}
                  }} data-testid={`button-view-ic-${u.id}`}>
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                {u.role !== "super_admin" && (
                  <>
                    {u.banned ? (
                      <Button size="sm" variant="outline" onClick={() => unbanUser.mutate(u.id)} disabled={unbanUser.isPending} data-testid={`button-unban-${u.id}`}>
                        Unban
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 dark:border-red-800" onClick={() => { setBanDialogUser(u); setBanReason(""); }} data-testid={`button-ban-${u.id}`}>
                        <Ban className="w-3 h-3 mr-1" /> Ban
                      </Button>
                    )}
                  </>
                )}
                {isSuperAdmin && u.role !== "super_admin" && (
                  <>
                    {u.role === "admin" ? (
                      <Button size="sm" variant="outline" onClick={() => demoteUser.mutate(u.id)} disabled={demoteUser.isPending} data-testid={`button-demote-${u.id}`}>
                        <UserMinus className="w-3 h-3 mr-1" /> Remove Admin
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 dark:border-blue-800" onClick={() => promoteUser.mutate(u.id)} disabled={promoteUser.isPending} data-testid={`button-promote-${u.id}`}>
                        <UserPlus className="w-3 h-3 mr-1" /> Make Admin
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!viewingUser} onOpenChange={() => { setViewingUser(null); setIcDetails(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>IC Verification - {viewingUser?.firstName} {viewingUser?.lastName}</DialogTitle>
            <DialogDescription>Review the user's Malaysian IC photos for identity verification</DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{viewingUser.firstName} {viewingUser.lastName}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium truncate">{viewingUser.email}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{viewingUser.phone || "N/A"}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">IC Number (Decrypted)</p>
                  <p className="font-medium font-mono" data-testid="text-ic-number">
                    {icDetails?.icNumber || icDetails?.maskedIc || "Loading..."}
                  </p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize">{viewingUser.gender || "N/A"}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">Phone Verified</p>
                  <p className="font-medium">{viewingUser.phoneVerified ? "Yes" : "No"}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">Email Verified</p>
                  <p className="font-medium">{viewingUser.emailVerified ? "Yes" : "No"}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <VerificationBadge status={viewingUser.verificationStatus} />
                </div>
              </div>

              {icDetails?.verificationNotes && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Previous Admin Notes</p>
                  <p className="text-sm">{icDetails.verificationNotes}</p>
                </div>
              )}

              {(icDetails?.icFrontUrl || viewingUser.icFrontPhoto) && (
                <div>
                  <p className="text-sm font-medium mb-1">IC Front (MyKad)</p>
                  <img
                    src={icDetails?.icFrontUrl || viewingUser.icFrontPhoto}
                    alt="IC Front"
                    className="w-full rounded-md border"
                    data-testid="img-ic-front"
                  />
                </div>
              )}
              {(icDetails?.icBackUrl || viewingUser.icBackPhoto) && (
                <div>
                  <p className="text-sm font-medium mb-1">IC Back (MyKad)</p>
                  <img
                    src={icDetails?.icBackUrl || viewingUser.icBackPhoto}
                    alt="IC Back"
                    className="w-full rounded-md border"
                    data-testid="img-ic-back"
                  />
                </div>
              )}

              {viewingUser.verificationStatus !== "verified" && (
                <div className="space-y-3 pt-2">
                  <div>
                    <p className="text-sm font-medium mb-1">Verification Notes</p>
                    <Textarea
                      placeholder="Add notes about this verification (optional)..."
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      data-testid="input-verify-notes"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 border-red-200 dark:border-red-800"
                      onClick={() => verifyUser.mutate({ id: viewingUser.id, status: "rejected", notes: verifyNotes } as any)}
                      disabled={verifyUser.isPending}
                      data-testid="button-reject-ic"
                    >
                      <ShieldX className="w-4 h-4 mr-2" /> Reject
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => verifyUser.mutate({ id: viewingUser.id, status: "verified", notes: verifyNotes } as any)}
                      disabled={verifyUser.isPending}
                      data-testid="button-approve-ic"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" /> Approve
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!banDialogUser} onOpenChange={() => setBanDialogUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Ban {banDialogUser?.firstName} {banDialogUser?.lastName} ({banDialogUser?.email}). They will not be able to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Reason for ban</p>
              <Textarea
                placeholder="Enter reason for banning this user..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                data-testid="input-ban-reason"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setBanDialogUser(null)} data-testid="button-cancel-ban">
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => banDialogUser && banUser.mutate({ id: banDialogUser.id, reason: banReason })}
                disabled={banUser.isPending}
                data-testid="button-confirm-ban"
              >
                {banUser.isPending ? "Banning..." : "Confirm Ban"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
              <div className="flex items-center justify-between gap-2">
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
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats"] });

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-admin-title">
          {isSuperAdmin ? "Super Admin Dashboard" : "Admin Dashboard"}
        </h1>
        {isSuperAdmin && (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800">
            <Crown className="w-3 h-3 mr-1" />Super Admin
          </Badge>
        )}
      </div>

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
