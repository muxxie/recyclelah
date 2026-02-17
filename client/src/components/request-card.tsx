import { Request } from "@shared/schema";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { MapPin, Scale, Clock, Calendar } from "lucide-react";
import { itemTypes } from "@shared/schema";

interface RequestCardProps {
  request: Request;
  role: "seller" | "collector";
  onAccept?: (id: number) => void;
  onComplete?: (id: number) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  verified: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function RequestCard({ request, role, onAccept, onComplete }: RequestCardProps) {
  return (
    <Card className="overflow-hidden border-border/50 hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="p-0">
        <div className="h-2 w-full bg-gradient-to-r from-primary to-emerald-300" />
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              <Badge variant="outline" className={statusColors[request.status]}>
                {request.status.replace('_', ' ')}
              </Badge>
              {request.isImmediate && (
                <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-100">
                  Immediate
                </Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(request.createdAt || new Date()), "PPP")}
            </p>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-bold text-primary font-display">
              ~{request.estimatedWeight} kg
            </span>
            <span className="text-xs text-muted-foreground">Est. Weight</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
            <span className="text-sm">{request.address}</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {request.itemTypes.map((type) => (
              <Badge key={type} variant="secondary" className="bg-secondary/50 text-secondary-foreground border-transparent">
                {type}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 flex gap-3">
        {role === 'collector' && request.status === 'pending' && onAccept && (
          <Button 
            className="w-full bg-primary hover:bg-primary/90" 
            onClick={() => onAccept(request.id)}
          >
            Accept Job
          </Button>
        )}

        {role === 'collector' && (request.status === 'accepted' || request.status === 'in_progress') && onComplete && (
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700" 
            onClick={() => onComplete(request.id)}
          >
            Verify & Complete
          </Button>
        )}

        {role === 'seller' && (
          <Button variant="outline" className="w-full" disabled>
            {request.status === 'pending' ? 'Waiting for Collector' : 'View Details'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
