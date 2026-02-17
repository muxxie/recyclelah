import { useMarketPrices } from "@/hooks/use-market-data";
import { Loader2, TrendingUp, DollarSign, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketPage() {
  const { data: prices, isLoading } = useMarketPrices();

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-market-title">Market Prices</h1>
        <p className="text-muted-foreground text-sm">Current average rates for recyclable materials</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {prices?.map((item) => (
          <Card key={item.id} data-testid={`card-price-${item.materialType}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-base font-medium capitalize">{item.materialType}</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display text-primary" data-testid={`text-price-${item.materialType}`}>
                RM {Number(item.pricePerKg).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">per kilogram</p>
              <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                <Scale className="w-3.5 h-3.5" />
                <span>Verified Rate</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-sm mb-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            How pricing works
          </h3>
          <p className="text-xs text-muted-foreground">
            Prices are updated daily based on market rates. You earn 80% of the total value when a collector picks up your recyclables. The platform takes a 20% commission.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
