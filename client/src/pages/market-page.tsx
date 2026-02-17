import { useMarketPrices } from "@/hooks/use-market-data";
import { Loader2, TrendingUp, DollarSign, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MarketPage() {
  const { data: prices, isLoading } = useMarketPrices();

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Market Prices</h1>
        <p className="text-muted-foreground">Current average rates for recyclable materials.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {prices?.map((item) => (
          <Card key={item.id} className="group hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium capitalize">
                {item.materialType}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display text-primary">
                ${Number(item.pricePerKg).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                per kilogram
              </p>
              
              <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground">
                <Scale className="w-4 h-4" />
                <span>Verified Rate</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted/30 p-6 rounded-xl border border-dashed">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          How pricing works
        </h3>
        <p className="text-sm text-muted-foreground">
          Prices are updated daily based on global market rates. Collectors pay you instantly based on the verified weight at the time of pickup.
        </p>
      </div>
    </div>
  );
}
