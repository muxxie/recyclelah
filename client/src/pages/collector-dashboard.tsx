import { useRequests, useAcceptRequest, useCompleteRequest } from "@/hooks/use-requests";
import { useFacilities } from "@/hooks/use-market-data";
import { useAuth } from "@/hooks/use-auth";
import { RequestCard } from "@/components/request-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Wallet, Zap, Package, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { VerificationBanner, useIsVerified } from "@/components/verification-banner";

function CompleteJobDialog({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate, isPending } = useCompleteRequest();
  const { data: facilities } = useFacilities();

  const form = useForm({
    defaultValues: { actualWeight: 0, facilityId: "", verifiedTypes: [] as string[] },
    resolver: zodResolver(
      z.object({
        actualWeight: z.coerce.number().min(0.1),
        facilityId: z.coerce.number().min(1),
        verifiedTypes: z.array(z.string()).optional(),
      })
    ),
  });

  const onSubmit = (data: any) => {
    if (!requestId) return;
    mutate(
      { id: requestId, data: { actualWeight: data.actualWeight, facilityId: data.facilityId, verifiedTypes: data.verifiedTypes || [] } },
      { onSuccess: () => { onOpenChange(false); form.reset(); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Job</DialogTitle>
          <DialogDescription>Verify the collected materials</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="actualWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual Weight (kg)</FormLabel>
                  <FormControl>
                    <Input data-testid="input-actual-weight" type="number" step="0.1" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="facilityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drop-off Facility</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                    <FormControl>
                      <SelectTrigger data-testid="select-facility">
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {facilities?.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <Button data-testid="button-complete-job" type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Completing..." : "Complete & Verify"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectorDashboard() {
  const { user } = useAuth();
  const { data: requests, isLoading } = useRequests();
  const { mutate: acceptRequest } = useAcceptRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isVerified = useIsVerified();

  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [completeJobId, setCompleteJobId] = useState<number | null>(null);

  const toggleOnline = useCallback(async (checked: boolean) => {
    setIsOnline(checked);
    try {
      await apiRequest("POST", "/api/users/status", { isOnline: checked });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      setIsOnline(!checked);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  }, [queryClient, toast]);

  const startJob = useCallback(async (id: number) => {
    try {
      await apiRequest("POST", `/api/requests/${id}/start`);
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "Job Started", description: "Navigate to pickup location" });
    } catch {
      toast({ title: "Error", description: "Failed to start job", variant: "destructive" });
    }
  }, [queryClient, toast]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const availableJobs = requests?.filter((r) => r.status === "pending") || [];
  const myJobs = requests?.filter((r) => (r.status === "accepted" || r.status === "in_progress") && r.collectorId === user?.id) || [];
  const completedJobs = requests?.filter((r) => r.status === "completed" && r.collectorId === user?.id) || [];

  return (
    <div className="space-y-6">
      <VerificationBanner />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-collector-welcome">
            Collector Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Vehicle: {user?.vehicleType || "Not set"}</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-md border">
          <span className={`text-sm font-medium ${isOnline ? "text-primary" : "text-muted-foreground"}`} data-testid="text-online-status">
            {isOnline ? "Online" : "Offline"}
          </span>
          <Switch data-testid="switch-online" checked={isOnline} onCheckedChange={toggleOnline} disabled={!isVerified} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="w-3.5 h-3.5" />
              Balance
            </div>
            <p className="text-lg md:text-xl font-bold font-display" data-testid="text-collector-balance">
              RM {Number(user?.balance || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Zap className="w-3.5 h-3.5" />
              Available
            </div>
            <p className="text-lg md:text-xl font-bold font-display">{availableJobs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Package className="w-3.5 h-3.5" />
              Active
            </div>
            <p className="text-lg md:text-xl font-bold font-display">{myJobs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Completed
            </div>
            <p className="text-lg md:text-xl font-bold font-display">{completedJobs.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="available" data-testid="tab-available">Available ({availableJobs.length})</TabsTrigger>
          <TabsTrigger value="my-jobs" data-testid="tab-my-jobs">My Jobs ({myJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableJobs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm" data-testid="text-no-available">
              No jobs available in your area right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableJobs.map((req) => (
                <RequestCard key={req.id} request={req} role="collector" onAccept={(id) => acceptRequest(id)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-jobs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myJobs.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                role="collector"
                onStart={req.status === "accepted" ? (id) => startJob(id) : undefined}
                onComplete={req.status === "in_progress" ? (id) => setCompleteJobId(id) : undefined}
              />
            ))}
            {myJobs.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground text-sm" data-testid="text-no-jobs">
                You haven't accepted any jobs yet.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CompleteJobDialog requestId={completeJobId} open={!!completeJobId} onOpenChange={(open) => !open && setCompleteJobId(null)} />
    </div>
  );
}
