import { useFacilities } from "@/hooks/use-market-data";
import { useEffect, useRef } from "react";
import { Loader2, MapPin, Recycle, Phone, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function FacilitiesPage() {
  const { data: facilities, isLoading } = useFacilities();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || !facilities || facilities.length === 0) return;

    const loadMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([3.1, 101.65], 11);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap",
      }).addTo(map);

      const facilityIcon = L.divIcon({
        html: `<div style="background:#449e63;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);">R</div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      facilities.forEach((f) => {
        L.marker([Number(f.latitude), Number(f.longitude)], { icon: facilityIcon })
          .addTo(map)
          .bindPopup(`<b>${f.name}</b><br/>${f.address}`);
      });

      setTimeout(() => map.invalidateSize(), 200);
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [facilities]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-facilities-title">Recycling Facilities</h1>
        <p className="text-muted-foreground text-sm">Drop-off locations and certified centers</p>
      </div>

      <div ref={mapRef} className="w-full h-48 md:h-64 rounded-md overflow-hidden border" data-testid="map-facilities" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {facilities?.map((facility) => (
          <Card key={facility.id} data-testid={`card-facility-${facility.id}`}>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-bold text-base" data-testid={`text-facility-name-${facility.id}`}>{facility.name}</h3>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">{facility.address}</p>
              </div>

              {facility.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm text-muted-foreground">{facility.phone}</p>
                </div>
              )}

              {facility.operatingHours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm text-muted-foreground">{facility.operatingHours}</p>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Recycle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {facility.acceptedMaterials?.map((mat) => (
                    <Badge key={mat} variant="secondary" className="text-[10px] capitalize border-transparent">{mat}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
