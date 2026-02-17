import { Request } from "@shared/schema";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MapPin, Calendar, Navigation } from "lucide-react";
import { Link } from "wouter";

interface RequestCardProps {
  request: Request;
  role: "seller" | "collector";
  onAccept?: (id: number) => void;
  onStart?: (id: number) => void;
  onComplete?: (id: number) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  accepted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  verified: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function RequestCard({ request, role, onAccept, onStart, onComplete }: RequestCardProps) {
  const showTrack = (request.status === "accepted" || request.status === "in_progress");

  return (
    <Card data-testid={`card-request-${request.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${statusColors[request.status]}`}>
              {request.status.replace("_", " ")}
            </Badge>
            {request.isImmediate && (
              <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600 dark:bg-red-900 dark:text-red-300 border-transparent">
                Immediate
              </Badge>
            )}
          </div>
          <span className="text-lg font-bold text-primary font-display shrink-0" data-testid={`text-weight-${request.id}`}>
            ~{request.estimatedWeight}kg
          </span>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-sm text-muted-foreground truncate" data-testid={`text-address-${request.id}`}>{request.address}</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {request.itemTypes.map((type) => (
            <Badge key={type} variant="secondary" className="text-[10px] capitalize border-transparent">{type}</Badge>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {format(new Date(request.createdAt || new Date()), "PPP")}
        </p>

        {request.totalPayout && (
          <p className="text-sm font-medium text-primary">
            Payout: RM {Number(request.totalPayout).toFixed(2)}
          </p>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2 flex-wrap">
        {role === "collector" && request.status === "pending" && onAccept && (
          <Button className="flex-1" onClick={() => onAccept(request.id)} data-testid={`button-accept-${request.id}`}>
            Accept Job
          </Button>
        )}

        {role === "collector" && request.status === "accepted" && onStart && (
          <Button className="flex-1" onClick={() => onStart(request.id)} data-testid={`button-start-${request.id}`}>
            Start Pickup
          </Button>
        )}

        {role === "collector" && request.status === "in_progress" && onComplete && (
          <Button className="flex-1" onClick={() => onComplete(request.id)} data-testid={`button-complete-${request.id}`}>
            Complete
          </Button>
        )}

        {showTrack && (
          <Link href={`/tracking/${request.id}`}>
            <Button variant="outline" size="sm" className="gap-1" data-testid={`button-track-${request.id}`}>
              <Navigation className="w-3.5 h-3.5" />
              Track
            </Button>
          </Link>
        )}

        {role === "seller" && request.status === "pending" && (
          <Button variant="outline" className="flex-1" disabled data-testid={`button-waiting-${request.id}`}>
            Waiting for Collector
          </Button>
        )}

        {role === "seller" && showTrack && (
          <Link href={`/tracking/${request.id}`}>
            <Button variant="outline" className="gap-1 flex-1" data-testid={`button-seller-track-${request.id}`}>
              <Navigation className="w-3.5 h-3.5" />
              Track Collector
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
