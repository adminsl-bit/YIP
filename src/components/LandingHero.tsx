import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import tigerMascot from "@/assets/tiger-mascot.png";
import mahatmaLogo from "@/assets/mahatma-logo.png";
import { Crown, Users, Award, Calendar } from "lucide-react";

export const LandingHero = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-primary/5 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -right-10 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-parliament-gold/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Navigation Header */}
      <nav className="relative z-10 py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-12 h-12 bg-gradient-hero rounded-xl flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-parliament-navy">Yi Madurai</h3>
                <p className="text-sm text-muted-foreground">Chapter</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="text-right">
                <h3 className="font-bold text-parliament-navy">Mahatma Global Schools</h3>
                <p className="text-sm text-muted-foreground">Venue Partner</p>
              </div>
              <div className="w-20 h-12 bg-white rounded-xl flex items-center justify-center p-2 border border-parliament-gold/20 shadow-md">
                <img 
                  src={mahatmaLogo} 
                  alt="Mahatma Global Schools - Truth Triumphs" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Hero Section */}
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[70vh]">
          {/* Left Content */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-6">
              <Badge variant="secondary" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium animate-scale-in">
                <Calendar className="w-4 h-4" />
                Regional Round 2025
              </Badge>
              
              <div className="space-y-4">
                <h1 className="text-6xl lg:text-7xl font-bold text-parliament-navy leading-tight">
                  Young Indians{" "}
                  <span className="text-transparent bg-gradient-hero bg-clip-text animate-pulse">
                    Parliament
                  </span>
                </h1>
                
                <div className="text-2xl text-parliament-blue font-semibold">
                  Madurai Regional Round
                </div>
                
                <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Empowering the next generation of democratic leaders through debate, discussion, and democratic participation.
                </p>
              </div>
            </div>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-3 gap-6">
              <Card className="p-6 text-center border-primary/20 hover:shadow-glow transition-all duration-500 hover:scale-105 animate-fade-in group">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-bold text-parliament-navy mb-2">170</div>
                <div className="text-sm text-muted-foreground">Participants</div>
              </Card>
              
              <Card className="p-6 text-center border-secondary/20 hover:shadow-primary transition-all duration-500 hover:scale-105 animate-fade-in delay-100 group">
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-secondary/20 transition-colors">
                  <Crown className="w-6 h-6 text-secondary" />
                </div>
                <div className="text-3xl font-bold text-parliament-navy mb-2">3</div>
                <div className="text-sm text-muted-foreground">Key Roles</div>
              </Card>
              
              <Card className="p-6 text-center border-parliament-gold/20 hover:shadow-elevated transition-all duration-500 hover:scale-105 animate-fade-in delay-200 group">
                <div className="w-12 h-12 bg-parliament-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-parliament-gold/20 transition-colors">
                  <Award className="w-6 h-6 text-parliament-gold" />
                </div>
                <div className="text-3xl font-bold text-parliament-navy mb-2">1</div>
                <div className="text-sm text-muted-foreground">Winner</div>
              </Card>
            </div>

            {/* Enhanced CTA */}
            <div className="pt-6">
              <Button 
                variant="hero" 
                size="xl" 
                className="group relative overflow-hidden px-8 py-4 text-lg font-semibold hover:scale-105 transition-all duration-300"
                onClick={() => window.location.href = '/login'}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <Crown className="w-5 h-5 mr-3 relative z-10" />
                <span className="relative z-10">Enter Parliament</span>
              </Button>
              
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span>Platform Ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-75"></div>
                  <span>Jury Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-parliament-gold rounded-full animate-pulse delay-150"></div>
                  <span>Voting Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Enhanced Mascot Section */}
          <div className="relative lg:justify-self-end animate-fade-in delay-300">
            <div className="relative max-w-lg">
              {/* Floating Background Elements */}
              <div className="absolute -top-8 -left-8 w-32 h-32 bg-gradient-hero/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-secondary/20 rounded-full blur-xl animate-pulse delay-1000"></div>
              
              {/* Main Mascot Container */}
              <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-12 border border-parliament-gold/30 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-parliament-cream/50 to-white/50 rounded-3xl"></div>
                <img 
                  src={tigerMascot} 
                  alt="Bengal Tiger mascot representing Young Indians Parliament - a friendly tiger wearing a Gandhi cap and holding a gavel, symbolizing democratic leadership and Indian heritage"
                  className="w-full h-auto relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                />
                
                {/* Floating Badge */}
                <div className="absolute -top-4 -right-4 bg-gradient-hero text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-bounce">
                  🇮🇳 Democracy
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Achievement Section */}
        <div className="mt-20 text-center animate-fade-in delay-500">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-parliament-navy">
              Empowering Young Leaders • Building Democratic Values • Shaping India's Future
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="text-center group">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-parliament-navy mb-2">Future Leaders</h3>
                <p className="text-sm text-muted-foreground">Nurturing the next generation of democratic leaders</p>
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-secondary/20 transition-colors">
                  <Crown className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="font-semibold text-parliament-navy mb-2">Democratic Values</h3>
                <p className="text-sm text-muted-foreground">Instilling principles of democracy and governance</p>
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 bg-parliament-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-parliament-gold/20 transition-colors">
                  <Award className="w-8 h-8 text-parliament-gold" />
                </div>
                <h3 className="font-semibold text-parliament-navy mb-2">Excellence</h3>
                <p className="text-sm text-muted-foreground">Recognizing outstanding parliamentary performance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Footer */}
      <footer className="relative z-10 mt-16 py-8 bg-parliament-navy/5 border-t border-parliament-gold/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-hero rounded-full flex items-center justify-center">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium">Powered by Yi Madurai Chapter</span>
            </div>
            <div className="text-center md:text-right">
              <div className="font-medium text-parliament-navy">Democracy in Action • Leadership Through Service</div>
              <div className="text-xs">Building India's Democratic Future</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};