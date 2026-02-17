import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle2, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export function VerificationBanner() {
  const { user } = useAuth();
  if (!user || user.verificationStatus === "verified") return null;

  const phoneOk = user.phoneVerified;
  const emailOk = user.emailVerified;

  return (
    <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-amber-900 dark:text-amber-100" data-testid="text-verification-warning">
              Account Not Verified
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Verify your phone and email to unlock full access including scheduling pickups, topping up your wallet, and selling recyclables.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${phoneOk ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                {phoneOk ? <CheckCircle2 className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                Phone {phoneOk ? "Verified" : "Pending"}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${emailOk ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                {emailOk ? <CheckCircle2 className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                Email {emailOk ? "Verified" : "Pending"}
              </span>
            </div>
            <Link href="/verify">
              <Button size="sm" className="mt-3 gap-1" data-testid="button-go-verify">
                <ShieldAlert className="w-3.5 h-3.5" />
                Verify Now
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function useIsVerified() {
  const { user } = useAuth();
  return user?.verificationStatus === "verified";
}
