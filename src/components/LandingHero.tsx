import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import tigerMascot from "@/assets/tiger-mascot.png";
import mahatmaLogo from "@/assets/mahatma-logo.png";
import { Crown, Users, Award, Calendar } from "lucide-react";

export const LandingHero = () => {
  return (
    <div className="min-h-screen bg-gradient-parliament relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-32 h-32 border-2 border-primary rounded-full"></div>
        <div className="absolute bottom-40 right-32 w-24 h-24 border-2 border-secondary rounded-full"></div>
        <div className="absolute top-60 right-20 w-16 h-16 bg-primary/10 rounded-lg rotate-45"></div>
      </div>

      <div className="container mx-auto px-4 py-12 relative">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-hero rounded-lg flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-parliament-navy">Yi Madurai</h3>
              <p className="text-sm text-muted-foreground">Chapter</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <h3 className="font-bold text-parliament-navy">Mahatma Global Schools</h3>
              <p className="text-sm text-muted-foreground">Venue Partner</p>
            </div>
            <div className="w-20 h-12 bg-white rounded-lg flex items-center justify-center p-2 border border-parliament-gold/20">
              <img 
                src={mahatmaLogo} 
                alt="Mahatma Global Schools - Truth Triumphs" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </header>

        {/* Main Hero Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="mb-4">
                <Calendar className="w-4 h-4 mr-2" />
                Regional Round 2025
              </Badge>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-parliament-navy leading-tight">
                Young Indians{" "}
                <span className="text-transparent bg-gradient-hero bg-clip-text">
                  Parliament
                </span>
              </h1>
              
              <div className="text-xl text-parliament-blue font-semibold">
                Madurai Regional Round
              </div>
              
              <p className="text-lg text-muted-foreground max-w-2xl">
                Hosted by{" "}
                <span className="font-semibold text-primary">Yi Madurai Chapter</span>{" "}
                • Venue Partner:{" "}
                <span className="font-semibold text-secondary">Mahatma Global Schools</span>
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center border-primary/20 hover:shadow-glow transition-all duration-300">
                <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-parliament-navy">170</div>
                <div className="text-sm text-muted-foreground">Participants</div>
              </Card>
              
              <Card className="p-4 text-center border-secondary/20 hover:shadow-primary transition-all duration-300">
                <Crown className="w-6 h-6 text-secondary mx-auto mb-2" />
                <div className="text-2xl font-bold text-parliament-navy">3</div>
                <div className="text-sm text-muted-foreground">Key Roles</div>
              </Card>
              
              <Card className="p-4 text-center border-parliament-gold/20 hover:shadow-elevated transition-all duration-300">
                <Award className="w-6 h-6 text-parliament-gold mx-auto mb-2" />
                <div className="text-2xl font-bold text-parliament-navy">1</div>
                <div className="text-sm text-muted-foreground">Winner</div>
              </Card>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <Button 
                variant="hero" 
                size="xl" 
                className="animate-pulse-glow"
                onClick={() => window.location.href = '/login'}
              >
                <Crown className="w-5 h-5 mr-2" />
                Enter Parliament
              </Button>
            </div>
          </div>

          {/* Right Content - Mascot */}
          <div className="relative">
            <div className="relative mx-auto max-w-md">
              <div className="absolute inset-0 bg-gradient-hero rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative bg-parliament-cream/50 backdrop-blur-sm rounded-3xl p-8 border border-parliament-gold/20">
                <img 
                  src={tigerMascot} 
                  alt="Bengal Tiger mascot representing Young Indians Parliament - a friendly tiger wearing a Gandhi cap and holding a gavel, symbolizing democratic leadership and Indian heritage"
                  className="w-full h-auto drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-16 text-center">
          <div className="space-y-2">
            <p className="text-parliament-blue font-medium">
              Empowering Young Leaders • Building Democratic Values • Shaping India's Future
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span>Platform Ready</span>
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-75"></div>
              <span>Jury Online</span>
              <div className="w-2 h-2 bg-parliament-gold rounded-full animate-pulse delay-150"></div>
              <span>Voting Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-6 bg-parliament-navy/5 border-t border-parliament-gold/10">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-hero rounded-full"></div>
              <span>Powered by Yi Madurai</span>
            </div>
            <div className="hidden md:block">
              Democracy in Action • Leadership Through Service
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};