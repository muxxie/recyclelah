import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerSchema, parseIcBirthDate, getAgeFromBirthDate, parseIcGender, parseIcStateCode } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Leaf, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ICCameraCapture } from "@/components/ic-camera-capture";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [icInfo, setIcInfo] = useState<{ birthDate: Date; age: number; gender: "male" | "female" | null; state: string | null } | null>(null);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'super_admin') setLocation('/admin');
      else if (user.role === 'collector') setLocation('/collector');
      else setLocation('/dashboard');
    }
  }, [user, setLocation]);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      role: "seller",
      vehicleType: "",
      gender: undefined,
      icNumber: "",
      icFrontPhoto: "",
      icBackPhoto: "",
    },
  });

  const role = registerForm.watch("role");
  const icFront = registerForm.watch("icFrontPhoto");
  const icBack = registerForm.watch("icBackPhoto");

  const canGoToStep2 = () => {
    const vals = registerForm.getValues();
    return vals.firstName.length >= 1 && vals.lastName.length >= 1 && vals.email.includes("@") && vals.phone.length >= 10 && vals.password.length >= 6;
  };

  const canGoToStep3 = () => {
    const vals = registerForm.getValues();
    const cleaned = vals.icNumber.replace(/[-\s]/g, "");
    if (cleaned.length !== 12 || !/^\d{12}$/.test(cleaned)) return false;
    const bd = parseIcBirthDate(vals.icNumber);
    if (!bd) return false;
    if (getAgeFromBirthDate(bd) < 18) return false;
    return icFront.length > 0 && icBack.length > 0;
  };

  const handleNextStep = async () => {
    if (step === 1) {
      const valid = await registerForm.trigger(["firstName", "lastName", "email", "phone", "password", "role"]);
      if (valid) setStep(2);
    } else if (step === 2) {
      const valid = await registerForm.trigger(["icNumber", "icFrontPhoto", "icBackPhoto"]);
      if (valid && canGoToStep3()) setStep(3);
    }
  };

  if (user) return null;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center p-12 bg-[#449e63] text-white relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-2 text-2xl font-display font-bold mb-12">
            <Leaf className="w-8 h-8 fill-white text-[#449e63]" />
            RecycleLah!
          </div>
          <h1 className="text-7xl font-display font-bold leading-[1.1] mb-8">
            Turn your waste into wealth.
          </h1>
          <p className="text-xl opacity-90 font-medium leading-relaxed">
            Join thousands of users making the planet greener. Connect with collectors, schedule pickups, and earn rewards for recycling.
          </p>
        </div>
        <div className="absolute bottom-12 left-12 z-10 text-sm opacity-60">
          &copy; 2024 RecycleLah. Making the world cleaner.
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <Leaf className="w-10 h-10 fill-primary text-primary" />
            <span className="text-2xl font-bold font-display text-primary">RecycleLah!</span>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register" onClick={() => setStep(1)}>Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-display">Welcome back</CardTitle>
                  <CardDescription>Sign in to manage your recycling activities</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="your@email.com" {...field} data-testid="input-login-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter your password" {...field} data-testid="input-login-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button className="w-full text-base font-medium mt-2" type="submit" disabled={loginMutation.isPending} data-testid="button-login">
                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>
                  </Form>

                  <div className="relative py-4 mt-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-muted" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground tracking-widest">or</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-base font-medium"
                    onClick={() => window.location.href = "/replit/auth"}
                    data-testid="button-replit-login"
                  >
                    Log In with Replit
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-display">
                    {step === 1 && "Create your account"}
                    {step === 2 && "Verify your identity"}
                    {step === 3 && "Review & Submit"}
                  </CardTitle>
                  <CardDescription>
                    {step === 1 && "Fill in your personal details"}
                    {step === 2 && "Provide your IC number and photos"}
                    {step === 3 && "Confirm your details before submitting"}
                  </CardDescription>
                  <div className="flex gap-2 mt-3">
                    {[1, 2, 3].map(s => (
                      <div
                        key={s}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-[#449e63]" : "bg-muted"}`}
                        data-testid={`step-indicator-${s}`}
                      />
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <Form {...registerForm}>
                    <form
                      onSubmit={registerForm.handleSubmit((d) => registerMutation.mutate(d))}
                      className="space-y-4"
                    >
                      {step === 1 && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={registerForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ali" {...field} data-testid="input-first-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ahmad" {...field} data-testid="input-last-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={registerForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="ali@example.com" {...field} data-testid="input-reg-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="0121234567" {...field} data-testid="input-reg-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="At least 6 characters" {...field} data-testid="input-reg-password" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>I am a...</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-role">
                                      <SelectValue placeholder="Select your role" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="seller">Household / Seller</SelectItem>
                                    <SelectItem value="collector">Collector</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {role === "collector" && (
                            <FormField
                              control={registerForm.control}
                              name="vehicleType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Vehicle Type</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. Van, Truck, Motorcycle" {...field} data-testid="input-vehicle-type" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <Button
                            type="button"
                            className="w-full text-base font-medium mt-2"
                            onClick={handleNextStep}
                            data-testid="button-next-step1"
                          >
                            Next: IC Verification <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </>
                      )}

                      {step === 2 && (
                        <>
                          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md mb-2">
                            <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                              <p className="font-medium">Malaysian IC Required</p>
                              <p className="mt-1 opacity-80">Enter your IC number and capture or upload clear photos of the front and back of your MyKad/IC.</p>
                            </div>
                          </div>

                          <FormField
                            control={registerForm.control}
                            name="icNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>IC Number (MyKad)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g. 901231-14-5678"
                                    maxLength={14}
                                    {...field}
                                    onChange={(e) => {
                                      let raw = e.target.value.replace(/[^0-9]/g, "");
                                      if (raw.length > 12) raw = raw.substring(0, 12);
                                      let formatted = raw;
                                      if (raw.length > 6) formatted = raw.substring(0, 6) + "-" + raw.substring(6);
                                      if (raw.length > 8) formatted = raw.substring(0, 6) + "-" + raw.substring(6, 8) + "-" + raw.substring(8);
                                      field.onChange(formatted);
                                      const bd = parseIcBirthDate(formatted);
                                      const gender = parseIcGender(formatted);
                                      const state = parseIcStateCode(formatted);
                                      if (bd) {
                                        setIcInfo({ birthDate: bd, age: getAgeFromBirthDate(bd), gender, state });
                                        if (gender) {
                                          registerForm.setValue("gender", gender);
                                        }
                                      } else {
                                        setIcInfo(null);
                                      }
                                    }}
                                    data-testid="input-ic-number"
                                  />
                                </FormControl>
                                {icInfo && (
                                  <div className="mt-2 space-y-1">
                                    <div className={`text-xs flex items-center gap-2 ${icInfo.age >= 18 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      <span data-testid="text-ic-birthdate">
                                        Born: {icInfo.birthDate.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                      <span data-testid="text-ic-age">
                                        ({icInfo.age} years old{icInfo.age < 18 ? " - must be 18+" : ""})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      {icInfo.gender && (
                                        <span data-testid="text-ic-gender" className="capitalize">
                                          Gender: <span className="font-medium text-foreground">{icInfo.gender}</span>
                                        </span>
                                      )}
                                      {icInfo.state && (
                                        <span data-testid="text-ic-state">
                                          State: <span className="font-medium text-foreground">{icInfo.state}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={registerForm.control}
                            name="icFrontPhoto"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <ICCameraCapture
                                    label="IC Front (MyKad - Front Side)"
                                    value={field.value}
                                    onChange={field.onChange}
                                    testId="ic-front-capture"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={registerForm.control}
                            name="icBackPhoto"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <ICCameraCapture
                                    label="IC Back (MyKad - Back Side)"
                                    value={field.value}
                                    onChange={field.onChange}
                                    testId="ic-back-capture"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex gap-3 mt-4">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setStep(1)}
                              data-testid="button-back-step2"
                            >
                              <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                            <Button
                              type="button"
                              className="flex-1"
                              onClick={handleNextStep}
                              disabled={!canGoToStep3()}
                              data-testid="button-next-step2"
                            >
                              Next: Review <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        </>
                      )}

                      {step === 3 && (
                        <>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-muted/50 rounded-md">
                                <p className="text-xs text-muted-foreground">First Name</p>
                                <p className="font-medium" data-testid="review-first-name">{registerForm.getValues("firstName")}</p>
                              </div>
                              <div className="p-3 bg-muted/50 rounded-md">
                                <p className="text-xs text-muted-foreground">Last Name</p>
                                <p className="font-medium" data-testid="review-last-name">{registerForm.getValues("lastName")}</p>
                              </div>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-md">
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium" data-testid="review-email">{registerForm.getValues("email")}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-muted/50 rounded-md">
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="font-medium" data-testid="review-phone">{registerForm.getValues("phone")}</p>
                              </div>
                              <div className="p-3 bg-muted/50 rounded-md">
                                <p className="text-xs text-muted-foreground">IC Number</p>
                                <p className="font-medium" data-testid="review-ic-number">{registerForm.getValues("icNumber")}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-muted/50 rounded-md">
                                <p className="text-xs text-muted-foreground">Gender</p>
                                <p className="font-medium capitalize" data-testid="review-gender">{registerForm.getValues("gender") || "—"}</p>
                              </div>
                              <div className="p-3 bg-muted/50 rounded-md">
                                <p className="text-xs text-muted-foreground">State of Birth</p>
                                <p className="font-medium" data-testid="review-state">{icInfo?.state || "—"}</p>
                              </div>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-md">
                              <p className="text-xs text-muted-foreground">Role</p>
                              <p className="font-medium capitalize" data-testid="review-role">{registerForm.getValues("role")}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">IC Front</p>
                                <img src={icFront} alt="IC Front" className="w-full h-20 object-cover rounded-md border" data-testid="review-ic-front" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">IC Back</p>
                                <img src={icBack} alt="IC Back" className="w-full h-20 object-cover rounded-md border" data-testid="review-ic-back" />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md mt-2">
                            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              Your IC will be reviewed by our team for verification. You can start using the app immediately while verification is in progress.
                            </p>
                          </div>

                          <div className="flex gap-3 mt-4">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setStep(2)}
                              data-testid="button-back-step3"
                            >
                              <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                            <Button
                              type="submit"
                              className="flex-1"
                              disabled={registerMutation.isPending}
                              data-testid="button-create-account"
                            >
                              {registerMutation.isPending ? "Creating..." : "Create Account"}
                            </Button>
                          </div>
                        </>
                      )}
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
