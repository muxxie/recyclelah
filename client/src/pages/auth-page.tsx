import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Leaf } from "lucide-react";
import { useEffect } from "react";

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

const registerSchema = api.auth.register.input;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation(user.role === 'collector' ? '/collector' : '/dashboard');
    }
  }, [user, setLocation]);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "seller",
      phone: "",
      address: "",
      vehicleType: "",
    },
  });

  // Watch role to conditionally show fields
  const role = registerForm.watch("role");

  if (user) return null;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-emerald-800 to-black/20" />
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute -left-20 bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        
        {/* Scenic Forest Landscape from Unsplash */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay">
          {/* forest nature background */}
          <img 
            src="https://pixabay.com/get/gd19d392d13454ba79dc55cd1d8b3beab3fd7f34b18289024173ff0f501df8081cb7a4965639c8382b7bfcf46d49023f368237b3970e8425f4593bf13df152aa8_1280.jpg" 
            alt="Nature Background"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-2xl font-display font-bold mb-4">
            <Leaf className="w-8 h-8 fill-accent text-accent" />
            RecycleLah!
          </div>
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Join the Green Revolution.
          </h1>
          <p className="text-xl opacity-90 font-light max-w-md">
            Connect with local collectors to recycle your waste efficiently. 
            Earn rewards while saving the planet.
          </p>
        </div>

        <div className="relative z-10 text-sm opacity-60">
          © 2024 RecycleLah! Inc.
        </div>
      </div>

      {/* Right Panel - Forms */}
      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <Leaf className="w-10 h-10 fill-primary text-primary" />
            <span className="text-2xl font-bold font-display text-primary">RecycleLah!</span>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-display">Welcome back</CardTitle>
                  <CardDescription>Enter your credentials to access your account</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your username" {...field} className="h-12" />
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
                              <Input type="password" placeholder="••••••••" {...field} className="h-12" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button className="w-full h-12 text-base font-medium mt-4" type="submit" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? "Logging in..." : "Login"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-display">Create an account</CardTitle>
                  <CardDescription>Start your recycling journey today</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit((d) => registerMutation.mutate(d as any))} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Choose a username" {...field} className="h-12" />
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
                              <Input type="password" placeholder="Create a password" {...field} className="h-12" />
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
                                <SelectTrigger className="h-12">
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

                      {role === 'collector' && (
                        <FormField
                          control={registerForm.control}
                          name="vehicleType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle Type</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Van, Truck, Bike" {...field} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {role === 'seller' && (
                         <FormField
                          control={registerForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="+60..." {...field} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <Button className="w-full h-12 text-base font-medium mt-4" type="submit" disabled={registerMutation.isPending}>
                        {registerMutation.isPending ? "Creating account..." : "Create Account"}
                      </Button>
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
