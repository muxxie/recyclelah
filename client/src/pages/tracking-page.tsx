import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRequest } from "@/hooks/use-requests";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Navigation, Phone, ArrowLeft } from "lucide-react";
import { Link, useParams } from "wouter";

export default function TrackingPage() {
  const params = useParams<{ id: string }>();
  const requestId = Number(params.id);
  const { user } = useAuth();
  const { data: request, isLoading } = useRequest(requestId);
  const [collectorLocation, setCollectorLocation] = useState<{ lat: number; lng: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!requestId || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const role = user.role === "collector" ? "collector" : "seller";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/tracking?requestId=${requestId}&role=${role}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "collector_location") {
          setCollectorLocation({ lat: data.latitude, lng: data.longitude });
        }
      } catch {}
    };

    if (role === "collector" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "location_update", ...loc }));
          }
        },
        undefined,
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      return () => {
        navigator.geolocation.clearWatch(watchId);
        ws.close();
      };
    }

    return () => ws.close();
  }, [requestId, user]);

  useEffect(() => {
    if (!mapRef.current || !request) return;

    const loadMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const lat = Number(request.latitude);
      const lng = Number(request.longitude);

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([lat, lng], 15);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap",
      }).addTo(map);

      const pickupIcon = L.divIcon({
        html: `<div style="background:#449e63;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);">P</div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([lat, lng], { icon: pickupIcon }).addTo(map).bindPopup("Pickup Location");

      setTimeout(() => map.invalidateSize(), 200);
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [request]);

  useEffect(() => {
    if (!mapInstanceRef.current || !collectorLocation) return;

    const loadLeaflet = async () => {
      const L = await import("leaflet");

      const collectorIcon = L.divIcon({
        html: `<div style="background:#2563eb;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);">C</div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([collectorLocation.lat, collectorLocation.lng]);
      } else {
        markerRef.current = L.marker([collectorLocation.lat, collectorLocation.lng], { icon: collectorIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup("Collector");
      }
    };

    loadLeaflet();
  }, [collectorLocation]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!request) return <div className="text-center py-10 text-muted-foreground">Request not found</div>;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-blue-100 text-blue-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={user?.role === "collector" ? "/collector" : "/dashboard"}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-display font-bold" data-testid="text-tracking-title">
            Job #{request.id}
          </h1>
          <Badge variant="outline" className={statusColors[request.status]}>
            {request.status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <div ref={mapRef} className="w-full h-64 md:h-96 rounded-md overflow-hidden border" data-testid="map-container" />

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{request.address}</p>
              <p className="text-xs text-muted-foreground">{request.latitude}, {request.longitude}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Materials:</span>
            <div className="flex gap-1 flex-wrap">
              {request.itemTypes?.map((t: string) => (
                <Badge key={t} variant="secondary" className="text-xs capitalize">{t}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Est. Weight: <strong>{request.estimatedWeight} kg</strong></span>
            {request.actualWeight && (
              <span className="text-muted-foreground">Actual: <strong>{request.actualWeight} kg</strong></span>
            )}
          </div>
          {request.totalPayout && (
            <div className="text-sm">
              <span className="text-muted-foreground">Payout: </span>
              <strong className="text-primary">RM {Number(request.totalPayout).toFixed(2)}</strong>
            </div>
          )}
          {collectorLocation && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Navigation className="w-4 h-4" />
              Collector is nearby ({collectorLocation.lat.toFixed(4)}, {collectorLocation.lng.toFixed(4)})
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
