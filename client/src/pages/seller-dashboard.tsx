import { useRequests, useCreateRequest } from "@/hooks/use-requests";
import { useAuth } from "@/hooks/use-auth";
import { RequestCard } from "@/components/request-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { itemTypes } from "@shared/schema";
import { useGeolocation } from "@/hooks/use-geo";
import { useEffect, useState } from "react";
import { z } from "zod";

const createRequestSchema = api.requests.create.input;

function CreateRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateRequest();
  const { location } = useGeolocation();
  
  const form = useForm<z.infer<typeof createRequestSchema>>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      itemTypes: [],
      estimatedWeight: 5,
      address: "",
      latitude: 3.14, // Default fallback
      longitude: 101.68,
      isImmediate: true,
    },
  });

  // Auto-fill location
  useEffect(() => {
    if (location) {
      form.setValue("latitude", location.lat);
      form.setValue("longitude", location.lng);
      // In a real app, reverse geocode here to get address string
      form.setValue("address", "Current Location (Detected)");
    }
  }, [location, form]);

  const onSubmit = (data: z.infer<typeof createRequestSchema>) => {
    // Ensure numbers are numbers
    const payload = {
      ...data,
      estimatedWeight: Number(data.estimatedWeight),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
    };
    mutate(payload, {
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
          <DialogTitle>Request Pickup</DialogTitle>
          <DialogDescription>
            What would you like to recycle today?
          </DialogDescription>
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
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={type}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(type)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, type])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== type
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal capitalize cursor-pointer">
                                {type}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
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
                      min={1}
                      max={50}
                      step={1}
                      defaultValue={[field.value]}
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
                    <Input placeholder="Enter address..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending}>
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

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const activeRequests = requests?.filter(r => r.status !== 'completed' && r.status !== 'cancelled') || [];
  const completedRequests = requests?.filter(r => r.status === 'completed') || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome, {user?.username}</h1>
          <p className="text-muted-foreground">Manage your recycling pickups.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
          <Plus className="w-4 h-4" />
          New Request
        </Button>
      </div>

      <CreateRequestDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />

      <section>
        <h2 className="text-xl font-bold mb-4 font-display">Active Requests</h2>
        {activeRequests.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
            <p className="text-muted-foreground">No active requests. Start recycling today!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeRequests.map(req => (
              <RequestCard key={req.id} request={req} role="seller" />
            ))}
          </div>
        )}
      </section>

      {completedRequests.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 font-display text-muted-foreground">History</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
            {completedRequests.map(req => (
              <RequestCard key={req.id} request={req} role="seller" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
