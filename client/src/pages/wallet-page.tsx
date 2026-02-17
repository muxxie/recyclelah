import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, Building } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { WalletTransaction } from "@shared/schema";
import { VerificationBanner, useIsVerified } from "@/components/verification-banner";

const txTypeLabels: Record<string, string> = {
  topup: "Top Up",
  escrow_lock: "Escrow Lock",
  escrow_release: "Escrow Release",
  payout: "Payout",
  commission: "Commission",
  withdrawal: "Withdrawal",
};

const txTypeColors: Record<string, string> = {
  topup: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  payout: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  commission: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  withdrawal: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  escrow_lock: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  escrow_release: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
};

function TopUpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "bank" | "processing" | "done">("amount");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const topupMutation = useMutation({
    mutationFn: async (amt: number) => {
      const res = await apiRequest("POST", "/api/wallet/topup", { amount: amt });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      toast({ title: "Top Up Successful", description: `RM ${amount} added to wallet` });
      setStep("done");
    },
    onError: () => {
      toast({ title: "Error", description: "Top up failed", variant: "destructive" });
      setStep("amount");
    },
  });

  const handleSubmit = () => {
    if (!amount || Number(amount) <= 0) return;
    setStep("bank");
  };

  const handleBankSelect = () => {
    setStep("processing");
    setTimeout(() => topupMutation.mutate(Number(amount)), 1500);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("amount");
      setAmount("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Top Up Wallet</DialogTitle>
          <DialogDescription>
            {step === "amount" && "Enter amount to add"}
            {step === "bank" && "Select your bank (Mock FPX)"}
            {step === "processing" && "Processing payment..."}
            {step === "done" && "Payment complete!"}
          </DialogDescription>
        </DialogHeader>

        {step === "amount" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {[10, 20, 50, 100].map((preset) => (
                <Button key={preset} variant="outline" size="sm" onClick={() => setAmount(String(preset))} data-testid={`button-preset-${preset}`}>
                  RM {preset}
                </Button>
              ))}
            </div>
            <Input
              data-testid="input-topup-amount"
              type="number"
              placeholder="Custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button data-testid="button-proceed-topup" className="w-full" onClick={handleSubmit} disabled={!amount || Number(amount) <= 0}>
              Proceed to Payment
            </Button>
          </div>
        )}

        {step === "bank" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Amount: RM {Number(amount).toFixed(2)}</p>
            {["Maybank", "CIMB Bank", "Public Bank", "RHB Bank"].map((bank) => (
              <Button
                key={bank}
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleBankSelect}
                data-testid={`button-bank-${bank.replace(/\s/g, "-").toLowerCase()}`}
              >
                <Building className="w-4 h-4" />
                {bank}
              </Button>
            ))}
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center py-8 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying payment with FPX...</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <p className="text-lg font-bold font-display">RM {Number(amount).toFixed(2)} Added</p>
            <Button data-testid="button-done-topup" className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function WalletPage() {
  const { user } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isVerified = useIsVerified();

  const { data: transactions, isLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("POST", "/api/wallet/withdraw", { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      toast({ title: "Withdrawal Successful" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="text-wallet-title">Wallet</h1>

      <VerificationBanner />

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm opacity-80">Available Balance</p>
              <p className="text-3xl md:text-4xl font-bold font-display" data-testid="text-wallet-balance">
                RM {Number(user?.balance || 0).toFixed(2)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowTopUp(true)} data-testid="button-topup" className="gap-1" disabled={!isVerified}>
                <ArrowDownLeft className="w-4 h-4" />
                Top Up
              </Button>
              <Button
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground"
                onClick={() => {
                  const amt = prompt("Enter withdrawal amount:");
                  if (amt && Number(amt) > 0) withdrawMutation.mutate(Number(amt));
                }}
                data-testid="button-withdraw"
                disabled={!isVerified}
              >
                <ArrowUpRight className="w-4 h-4" />
                Withdraw
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TopUpDialog open={showTopUp} onOpenChange={setShowTopUp} />

      <div>
        <h2 className="text-lg font-bold font-display mb-3">Transaction History</h2>
        {(!transactions || transactions.length === 0) ? (
          <div className="text-center py-10 text-muted-foreground text-sm" data-testid="text-no-transactions">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <Card key={tx.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${Number(tx.amount) >= 0 ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                      {Number(tx.amount) >= 0 ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-tx-desc-${tx.id}`}>{tx.description || txTypeLabels[tx.type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.createdAt ? format(new Date(tx.createdAt), "PPp") : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${Number(tx.amount) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-tx-amount-${tx.id}`}>
                      {Number(tx.amount) >= 0 ? "+" : ""}RM {Math.abs(Number(tx.amount)).toFixed(2)}
                    </p>
                    <Badge variant="outline" className={`text-[10px] ${txTypeColors[tx.type] || ""}`}>
                      {txTypeLabels[tx.type] || tx.type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
