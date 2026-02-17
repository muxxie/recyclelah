import { useRequests, useCreateRequest } from "@/hooks/use-requests";
import { useAuth } from "@/hooks/use-auth";
import { RequestCard } from "@/components/request-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2, Wallet, Package, Clock, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRequestSchema, itemTypes } from "@shared/schema";
import { useGeolocation } from "@/hooks/use-geo";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Link } from "wouter";
import { VerificationBanner, useIsVerified } from "@/components/verification-banner";

function CreateRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateRequest();
  const { location } = useGeolocation();

  const form = useForm<z.infer<typeof insertRequestSchema>>({
    resolver: zodResolver(insertRequestSchema),
    defaultValues: {
      itemTypes: [],
      estimatedWeight: 5,
      address: "",
      latitude: "3.14",
      longitude: "101.68",
      isImmediate: true,
    },
  });

  useEffect(() => {
    if (location) {
      form.setValue("latitude", String(location.lat));
      form.setValue("longitude", String(location.lng));
      form.setValue("address", "Current Location (Detected)");
    }
  }, [location, form]);

  const onSubmit = (data: z.infer<typeof insertRequestSchema>) => {
    mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Request Pickup</DialogTitle>
          <DialogDescription>What would you like to recycle today?</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="itemTypes"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Materials</FormLabel>
                    <FormMessage />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {itemTypes.map((type) => (
                      <FormField
                        key={type}
                        control={form.control}
                        name="itemTypes"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                data-testid={`checkbox-material-${type}`}
                                checked={field.value?.includes(type)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), type])
                                    : field.onChange(field.value?.filter((v) => v !== type));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal capitalize cursor-pointer">{type}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimatedWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Weight: {field.value} kg</FormLabel>
                  <FormControl>
                    <Slider
                      data-testid="slider-weight"
                      min={1}
                      max={50}
                      step={1}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pickup Address</FormLabel>
                  <FormControl>
                    <Input data-testid="input-address" placeholder="Enter address..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button data-testid="button-submit-request" type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const { data: requests, isLoading } = useRequests();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isVerified = useIsVerified();

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const activeRequests = requests?.filter(r => r.status !== "completed" && r.status !== "cancelled") || [];
  const completedRequests = requests?.filter(r => r.status === "completed") || [];
  const totalEarnings = completedRequests.reduce((s, r) => s + Number(r.totalPayout || 0) * 0.8, 0);

  return (
    <div className="space-y-6">
      <VerificationBanner />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground" data-testid="text-welcome">
            Welcome, {user?.firstName || user?.username}
          </h1>
          <p className="text-muted-foreground text-sm">Manage your recycling pickups</p>
        </div>
        <Button data-testid="button-new-request" onClick={() => setIsDialogOpen(true)} className="gap-2" disabled={!isVerified}>
          <Plus className="w-4 h-4" />
          New Request
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="w-3.5 h-3.5" />
              Balance
            </div>
            <p className="text-lg md:text-xl font-bold font-display" data-testid="text-balance">
              RM {Number(user?.balance || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              Active
            </div>
            <p className="text-lg md:text-xl font-bold font-display" data-testid="text-active-count">{activeRequests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Package className="w-3.5 h-3.5" />
              Completed
            </div>
            <p className="text-lg md:text-xl font-bold font-display" data-testid="text-completed-count">{completedRequests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Earnings
            </div>
            <p className="text-lg md:text-xl font-bold font-display text-primary" data-testid="text-earnings">
              RM {totalEarnings.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <CreateRequestDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />

      <section>
        <h2 className="text-lg font-bold mb-3 font-display">Active Requests</h2>
        {activeRequests.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-md bg-muted/30" data-testid="text-no-active">
            <p className="text-muted-foreground text-sm">No active requests. Start recycling today!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRequests.map(req => (
              <RequestCard key={req.id} request={req} role="seller" />
            ))}
          </div>
        )}
      </section>

      {completedRequests.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3 font-display text-muted-foreground">History</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
            {completedRequests.slice(0, 6).map(req => (
              <RequestCard key={req.id} request={req} role="seller" />
            ))}
          </div>
          {completedRequests.length > 6 && (
            <div className="text-center mt-4">
              <Link href="/history">
                <Button variant="outline" data-testid="link-view-all-history">View All History</Button>
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
