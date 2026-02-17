import { useRequests, useAcceptRequest, useCompleteRequest } from "@/hooks/use-requests";
import { useFacilities } from "@/hooks/use-market-data";
import { useAuth } from "@/hooks/use-auth";
import { RequestCard } from "@/components/request-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Power, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

function CompleteJobDialog({ 
  requestId, 
  open, 
  onOpenChange 
}: { 
  requestId: number | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const { mutate, isPending } = useCompleteRequest();
  const { data: facilities } = useFacilities();

  const form = useForm({
    defaultValues: {
      actualWeight: 0,
      facilityId: "",
      verifiedTypes: []
    },
    resolver: zodResolver(z.object({
      actualWeight: z.coerce.number().min(0.1),
      facilityId: z.coerce.number().min(1),
      verifiedTypes: z.array(z.string()).optional()
    }))
  });

  const onSubmit = (data: any) => {
    if (!requestId) return;
    
    // For simplicity, just assuming verified types = what was requested
    // In a real app, this would be editable
    mutate({ 
      id: requestId, 
      data: {
        actualWeight: data.actualWeight,
        facilityId: data.facilityId,
        verifiedTypes: [] // Backend can handle this or we pass existing
      }
    }, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      }
    });
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
                    <Input type="number" step="0.1" {...field} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {facilities?.map(f => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                          {f.name} ({f.address})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending}>
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
  
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [completeJobId, setCompleteJobId] = useState<number | null>(null);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const availableJobs = requests?.filter(r => r.status === 'pending') || [];
  const myJobs = requests?.filter(r => (r.status === 'accepted' || r.status === 'in_progress') && r.collectorId === user?.id) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-primary/5 p-6 rounded-2xl border border-primary/10">
        <div>
          <h1 className="text-2xl font-display font-bold">Collector Dashboard</h1>
          <p className="text-muted-foreground text-sm">Vehicle: {user?.vehicleType}</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm">
          <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <Switch checked={isOnline} onCheckedChange={setIsOnline} />
        </div>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="available">Available Jobs ({availableJobs.length})</TabsTrigger>
          <TabsTrigger value="my-jobs">My Jobs ({myJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-6">
          {availableJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No jobs available in your area right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableJobs.map(req => (
                <RequestCard 
                  key={req.id} 
                  request={req} 
                  role="collector" 
                  onAccept={(id) => acceptRequest(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-jobs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myJobs.map(req => (
              <RequestCard 
                key={req.id} 
                request={req} 
                role="collector" 
                onComplete={(id) => setCompleteJobId(id)}
              />
            ))}
            {myJobs.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                You haven't accepted any jobs yet.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CompleteJobDialog 
        requestId={completeJobId} 
        open={!!completeJobId} 
        onOpenChange={(open) => !open && setCompleteJobId(null)} 
      />
    </div>
  );
}
