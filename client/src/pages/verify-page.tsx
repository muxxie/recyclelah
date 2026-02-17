import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Phone, Mail, ShieldCheck, ArrowRight } from "lucide-react";

export default function VerifyPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: otpStatus, isLoading: statusLoading } = useQuery<{ phoneVerified: boolean; emailVerified: boolean; accountVerified: boolean; verificationStatus: string }>({
    queryKey: ["/api/otp/status"],
    enabled: !!user,
  });

  const allVerified = otpStatus?.phoneVerified && otpStatus?.emailVerified;

  useEffect(() => {
    if (allVerified) {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const timer = setTimeout(() => {
        const isAdmin = user?.role === "admin" || user?.role === "super_admin";
        setLocation(isAdmin ? "/admin" : user?.role === "collector" ? "/collector" : "/dashboard");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [allVerified, user, setLocation, queryClient]);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold" data-testid="text-verify-title">Verify Your Account</h1>
          <p className="text-muted-foreground text-sm">
            Please verify your phone and email to complete registration
          </p>
        </div>

        {allVerified ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold" data-testid="text-all-verified">Account Verified!</h2>
              <p className="text-sm text-muted-foreground">Your account now has full access. Redirecting to your dashboard...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <OtpVerificationCard
              type="phone"
              target={user?.phone || ""}
              label="Phone Number"
              description="We'll send a code via WhatsApp"
              icon={<Phone className="h-5 w-5" />}
              verified={otpStatus?.phoneVerified || false}
              onVerified={() => queryClient.invalidateQueries({ queryKey: ["/api/otp/status"] })}
            />
            <OtpVerificationCard
              type="email"
              target={user?.email || ""}
              label="Email Address"
              description="We'll send a code to your email"
              icon={<Mail className="h-5 w-5" />}
              verified={otpStatus?.emailVerified || false}
              onVerified={() => queryClient.invalidateQueries({ queryKey: ["/api/otp/status"] })}
            />

            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Verification is required to schedule pickups, top up your wallet, and sell recyclables.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
                  setLocation(isAdmin ? "/admin" : user?.role === "collector" ? "/collector" : "/dashboard");
                }}
                data-testid="button-skip-verification"
              >
                Continue with limited access <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OtpVerificationCard({
  type,
  target,
  label,
  description,
  icon,
  verified,
  onVerified,
}: {
  type: "phone" | "email";
  target: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  verified: boolean;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, target }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send code");
      }
      return res.json();
    },
    onSuccess: () => {
      setCodeSent(true);
      setCountdown(60);
      toast({ title: "Code Sent", description: `Verification code sent to ${target}` });
    },
    onError: (error: Error) => {
      if (error.message.includes("wait")) {
        setCodeSent(true);
        setCountdown(30);
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, target, code }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Verified!", description: `${label} verified successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/otp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onVerified();
    },
    onError: (error: Error) => {
      toast({ title: "Invalid Code", description: error.message, variant: "destructive" });
    },
  });

  if (verified) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex items-center gap-2 flex-1">
            {icon}
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription className="text-xs">{target}</CardDescription>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-green-500" data-testid={`icon-${type}-verified`} />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground" data-testid={`text-${type}-target`}>{target}</p>

        {!codeSent ? (
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !target}
            className="w-full"
            data-testid={`button-send-${type}-code`}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Send Verification Code
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
                data-testid={`input-${type}-otp`}
              />
            </div>
            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={code.length !== 6 || verifyMutation.isPending}
              className="w-full"
              data-testid={`button-verify-${type}`}
            >
              {verifyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Verify Code
            </Button>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sendMutation.mutate()}
                disabled={countdown > 0 || sendMutation.isPending}
                data-testid={`button-resend-${type}`}
              >
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
