import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Crown, Users, Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export const Login = () => {
  const [credentials, setCredentials] = useState({
    loginId: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // TODO: Implement actual authentication in Phase 2
    console.log('Login attempt:', credentials);
    
    setTimeout(() => {
      setIsLoading(false);
      // Placeholder navigation - will be updated in Phase 2
      alert('Authentication will be implemented in Phase 2 with Supabase integration');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-parliament flex items-center justify-center p-4">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-40 h-40 border border-primary/10 rounded-full"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 border border-secondary/10 rounded-full"></div>
        <div className="absolute top-1/2 left-20 w-6 h-6 bg-parliament-gold/20 rounded-full"></div>
      </div>

      <div className="w-full max-w-md relative">
        {/* Back Button */}
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card className="shadow-elevated border-parliament-gold/20">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-hero rounded-2xl flex items-center justify-center mx-auto">
              <Crown className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <div>
              <CardTitle className="text-2xl font-bold text-parliament-navy">
                Parliament Access
              </CardTitle>
              <CardDescription className="mt-2">
                Young Indians Parliament - Madurai Regional Round
              </CardDescription>
            </div>

            {/* Role Selection Badges */}
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className="border-primary/30">
                <Users className="w-3 h-3 mr-1" />
                Student
              </Badge>
              <Badge variant="outline" className="border-secondary/30">
                <Shield className="w-3 h-3 mr-1" />
                Jury
              </Badge>
              <Badge variant="outline" className="border-parliament-gold/50">
                <Crown className="w-3 h-3 mr-1" />
                Organizer
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginId" className="text-sm font-medium">
                  Login ID
                </Label>
                <Input
                  id="loginId"
                  type="text"
                  placeholder="Enter your SNO, Party Number, or Username"
                  value={credentials.loginId}
                  onChange={(e) => setCredentials(prev => ({
                    ...prev,
                    loginId: e.target.value
                  }))}
                  className="h-11"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Students: Use your Serial Number or Party Number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({
                    ...prev,
                    password: e.target.value
                  }))}
                  className="h-11"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Students: Common password • Jury/Organizer: Personal password
                </p>
              </div>

              <Button 
                type="submit" 
                variant="hero" 
                size="lg" 
                className="w-full mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Enter Parliament
                  </>
                )}
              </Button>
            </form>

            <div className="pt-4 border-t border-border">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground font-medium">
                  System Status
                </p>
                <div className="flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Platform Online</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Database Ready</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span>Auth Pending</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need help? Contact your organizer or technical support
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;