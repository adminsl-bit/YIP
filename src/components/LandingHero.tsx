import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Award, Calendar } from "lucide-react";

export const LandingHero = () => {
  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden text-gray-900">
      {/* Modern gradient overlay with geometric patterns */}
      <div className="absolute inset-0">
        {/* Floating geometric elements */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full blur-xl floating"></div>
        <div className="absolute top-1/3 right-20 w-48 h-48 bg-gradient-to-bl from-secondary/20 to-secondary/10 rounded-full blur-2xl floating-delayed"></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-gradient-to-t from-parliament-blue/20 to-parliament-blue/10 rounded-full blur-xl floating"></div>
        
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Cpath d='M30 30l15-15v30l-15-15zM15 15l15 15-15 15V15z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
      </div>

      {/* Hero Content */}
      <div className="relative z-10">
        {/* Modern glassmorphism header */}
        <div className="glass-card rounded-2xl p-6 mx-8 mt-8 animate-slide-up">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img 
                src="/lovable-uploads/e7fefdf4-d36c-4867-80a7-fcb25c648693.png" 
                alt="Young Indians Logo" 
                className="h-16 w-auto object-contain hover-glow transition-all duration-300"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <img 
                src="/lovable-uploads/905e95c2-3362-435c-8378-e962ab280559.png" 
                alt="Mahatma Global Schools Logo" 
                className="h-16 w-auto object-contain hover-glow transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* Main Hero Section */}
        <div className="px-8 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-8 px-8 py-4 text-lg glass-card text-primary hover:bg-primary/10 transition-all duration-300 hover:scale-105 animate-pulse-glow">
                <Calendar className="w-5 h-5 mr-3" />
                Regional Round 2025 - Now Live
              </Badge>
              
              <div className="flex items-center justify-center gap-16 mb-12">
                <div className="text-center animate-scale-in">
                  <h1 className="text-7xl lg:text-8xl xl:text-9xl font-black tracking-tight leading-none">
                    <span className="block text-transparent bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text drop-shadow-lg animate-gentle-bounce">
                      YOUNG
                    </span>
                    <span className="block text-transparent bg-gradient-to-r from-parliament-blue via-blue-600 to-indigo-600 bg-clip-text drop-shadow-lg">
                      INDIANS
                    </span>
                    <span className="block text-transparent bg-gradient-to-r from-secondary via-emerald-500 to-green-600 bg-clip-text drop-shadow-lg">
                      PARLIAMENT
                    </span>
                  </h1>
                </div>
                <img 
                  src="/lovable-uploads/c4f27cb5-63cc-4d7b-bb83-f300fd7a28f9.png" 
                  alt="Young Indians Parliament Mascot" 
                  className="h-72 w-auto object-contain animate-gentle-bounce hover:scale-110 transition-transform duration-500 drop-shadow-xl"
                />
              </div>
              
              <div className="text-center animate-slide-up">
                <p className="text-4xl font-bold mb-8 text-gray-700 tracking-wide">
                  Madurai Regional Round
                </p>
              
              <p className="text-2xl text-gray-600 max-w-4xl mx-auto mb-16 leading-relaxed font-medium">
                Where young minds debate, democracy thrives, and future leaders are born. 
                Join 170 participants in the most prestigious parliamentary debate competition.
              </p>
              </div>
            </div>

            {/* Modern glassmorphism stats cards */}
            <div className="grid md:grid-cols-3 gap-8 mb-20 px-8">
              <div className="glass-card rounded-3xl p-8 text-center hover-lift animate-scale-in" style={{animationDelay: '0.1s'}}>
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-glow rounded-full flex items-center justify-center mx-auto mb-6 shadow-floating hover:shadow-glow transition-all duration-300">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <div className="text-5xl font-black mb-4 text-gray-900 bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">170</div>
                <div className="text-xl font-semibold text-gray-600">Young Parliamentarians</div>
              </div>
              
              <div className="glass-card rounded-3xl p-8 text-center hover-lift animate-scale-in" style={{animationDelay: '0.2s'}}>
                <div className="w-20 h-20 bg-gradient-to-br from-parliament-blue to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-floating hover:shadow-glow transition-all duration-300">
                  <Crown className="w-10 h-10 text-white" />
                </div>
                <div className="text-5xl font-black mb-4 text-gray-900 bg-gradient-to-br from-parliament-blue to-blue-600 bg-clip-text text-transparent">3</div>
                <div className="text-xl font-semibold text-gray-600">Leadership Roles</div>
              </div>
              
              <div className="glass-card rounded-3xl p-8 text-center hover-lift animate-scale-in" style={{animationDelay: '0.3s'}}>
                <div className="w-20 h-20 bg-gradient-to-br from-secondary to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-floating hover:shadow-glow transition-all duration-300">
                  <Award className="w-10 h-10 text-white" />
                </div>
                <div className="text-5xl font-black mb-4 text-gray-900 bg-gradient-to-br from-secondary to-green-600 bg-clip-text text-transparent">1</div>
                <div className="text-xl font-semibold text-gray-600">Champion Winner</div>
              </div>
            </div>

            {/* Enhanced CTA and mascot section */}
            <div className="grid lg:grid-cols-2 gap-20 items-center px-8">
              <div className="text-center lg:text-left animate-slide-up">
                <Button 
                  size="xl"
                  className="btn-micro bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-white font-bold text-2xl px-16 py-8 rounded-2xl shadow-floating hover:shadow-glow transition-all duration-300 mb-12 text-transform-none"
                  onClick={() => window.location.href = '/login'}
                >
                  <Crown className="w-8 h-8 mr-4" />
                  ENTER PARLIAMENT
                </Button>
                
                <div className="flex flex-wrap justify-center lg:justify-start gap-8 text-lg">
                  <div className="flex items-center gap-3 glass rounded-full px-6 py-3 hover-lift">
                    <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-700 font-medium">Platform Online</span>
                  </div>
                  <div className="flex items-center gap-3 glass rounded-full px-6 py-3 hover-lift" style={{animationDelay: '0.1s'}}>
                    <div className="w-4 h-4 bg-primary rounded-full animate-pulse delay-75"></div>
                    <span className="text-gray-700 font-medium">Jury Ready</span>
                  </div>
                  <div className="flex items-center gap-3 glass rounded-full px-6 py-3 hover-lift" style={{animationDelay: '0.2s'}}>
                    <div className="w-4 h-4 bg-parliament-blue rounded-full animate-pulse delay-150"></div>
                    <span className="text-gray-700 font-medium">Voting Live</span>
                  </div>
                </div>
              </div>
              
              <div className="relative animate-scale-in">
                <div className="relative glass-card rounded-3xl p-16 shadow-floating hover:shadow-glow transition-all duration-500 hover-lift">
                  <div className="absolute -top-8 -right-8 bg-gradient-to-r from-primary to-primary-glow text-white px-8 py-4 rounded-full text-xl font-bold shadow-floating animate-gentle-bounce">
                    🏆 LIVE NOW
                  </div>
                  <div className="text-center text-6xl">
                    🐯
                    <div className="mt-6 text-white text-xl font-bold bg-gradient-to-r from-primary to-primary-glow rounded-xl px-6 py-4 inline-block shadow-lg">
                      YOUNG INDIANS<br/>PARLIAMENT
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern bottom section with glassmorphism */}
        <div className="px-8 py-20 glass-card mt-16 border-t border-white/20">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12 text-center">
              <div className="hover-lift animate-slide-up" style={{animationDelay: '0.1s'}}>
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-glow rounded-full flex items-center justify-center mx-auto mb-6 shadow-floating hover:shadow-glow transition-all duration-300">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">Future Leaders</h3>
                <p className="text-gray-600 leading-relaxed">Shaping tomorrow's democratic leaders through debate and discourse</p>
              </div>
              
              <div className="hover-lift animate-slide-up" style={{animationDelay: '0.2s'}}>
                <div className="w-20 h-20 bg-gradient-to-br from-parliament-blue to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-floating hover:shadow-glow transition-all duration-300">
                  <Crown className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">Democratic Values</h3>
                <p className="text-gray-600 leading-relaxed">Building strong democratic foundations for India's future</p>
              </div>
              
              <div className="hover-lift animate-slide-up" style={{animationDelay: '0.3s'}}>
                <div className="w-20 h-20 bg-gradient-to-br from-secondary to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-floating hover:shadow-glow transition-all duration-300">
                  <Award className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">Excellence</h3>
                <p className="text-gray-600 leading-relaxed">Recognizing outstanding parliamentary performance and leadership</p>
              </div>
            </div>
            
            <div className="text-center mt-20 pt-12 border-t border-white/20 animate-slide-up" style={{animationDelay: '0.4s'}}>
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-glow rounded-full flex items-center justify-center shadow-floating">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">Powered by Yi Madurai Chapter</span>
              </div>
              <p className="text-gray-600 text-lg">Democracy in Action • Leadership Through Service • Building India's Future</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};