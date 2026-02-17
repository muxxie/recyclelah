import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold font-display">404 Page Not Found</h1>
        <p className="text-muted-foreground text-lg">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>

        <Link href="/">
          <Button size="lg" className="w-full sm:w-auto">
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
