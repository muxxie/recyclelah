import { useFacilities } from "@/hooks/use-market-data";
import { Loader2, MapPin, Recycle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function FacilitiesPage() {
  const { data: facilities, isLoading } = useFacilities();

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Recycling Facilities</h1>
        <p className="text-muted-foreground">Drop-off locations and certified centers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {facilities?.map((facility) => (
          <Card key={facility.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-32 bg-muted relative">
              {/* Warehouse/Industrial image */}
              <img 
                src="https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&q=80" 
                alt="Facility" 
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="font-bold text-lg">{facility.name}</h3>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{facility.address}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {facility.latitude}, {facility.longitude}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Recycle className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex flex-wrap gap-2">
                    {facility.acceptedMaterials?.map(mat => (
                      <span key={mat} className="text-xs bg-secondary px-2 py-1 rounded-md capitalize">
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
