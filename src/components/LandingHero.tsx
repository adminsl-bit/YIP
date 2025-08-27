import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Award, Calendar } from "lucide-react";

export const LandingHero = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 relative overflow-hidden text-white">
      {/* Dramatic animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-40">
          <div className="absolute inset-0 bg-white/5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-br from-orange-500/30 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-gradient-to-bl from-green-500/30 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-gradient-to-t from-blue-500/30 to-transparent rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Hero Content */}
      <div className="relative z-10">
        {/* Top Navigation - Simplified */}
        <div className="flex justify-center items-center p-8">
        </div>

        {/* Main Hero Section */}
        <div className="px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-8 px-6 py-3 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Calendar className="w-5 h-5 mr-3" />
                Regional Round 2025 - Now Live
              </Badge>
              
              <div className="flex items-center justify-center gap-8 mb-8">
                <h1 className="text-7xl lg:text-9xl font-black tracking-tight">
                  <span className="block text-transparent bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-500 bg-clip-text animate-pulse">
                    YOUNG
                  </span>
                  <span className="block text-transparent bg-gradient-to-r from-orange-500 via-white to-green-500 bg-clip-text">
                    INDIANS
                  </span>
                  <span className="block text-transparent bg-gradient-to-r from-orange-500 via-white to-green-500 bg-clip-text">
                    PARLIAMENT
                  </span>
                </h1>
                
                <div className="relative hidden lg:block">
                  <img 
                    src="/lovable-uploads/acb05533-0bc0-4094-9302-9f7621f49697.png"
                    alt="Young Indians Parliament Tiger Mascot" 
                    className="w-80 h-80 object-contain hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>
              
              <p className="text-5xl lg:text-6xl font-bold mb-6 text-blue-100">
                Madurai Regional Round
              </p>
              
              <p className="text-xl text-blue-200 max-w-3xl mx-auto mb-12 leading-relaxed">
                Where young minds debats and democracy thrives
              </p>
            </div>

            {/* Features Section */}
            <div className="mb-16">
              <div className="grid md:grid-cols-3 gap-12 text-center max-w-5xl mx-auto">
                <div className="group">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Future Leaders</h3>
                  <p className="text-blue-200/80 text-sm">Shaping tomorrow's democratic leaders through debate and discourse</p>
                </div>
                
                <div className="group">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Democratic Values</h3>
                  <p className="text-blue-200/80 text-sm">Building strong democratic foundations for India's future</p>
                </div>
                
                <div className="group">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Excellence</h3>
                  <p className="text-blue-200/80 text-sm">Recognizing outstanding parliamentary performance and leadership</p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center mb-12">
              <Button 
                size="xl"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-2xl px-12 py-6 rounded-2xl shadow-2xl hover:shadow-orange-500/25 hover:scale-105 transition-all duration-300"
                onClick={() => window.location.href = '/login'}
              >
                <Crown className="w-8 h-8 mr-4" />
                ENTER PARLIAMENT
              </Button>
              
              {/* Glass Buttons Section */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Democracy in Action</span>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="text-sm font-medium">Leadership Through Service</span>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium">Building India's Future</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="px-8 py-16 bg-transparent">
          <div className="max-w-7xl mx-auto">
            {/* Partners Section */}
            <div className="text-center mb-20">
              <p className="text-blue-200/80 text-2xl lg:text-3xl mb-12 uppercase tracking-wider font-bold">Our Partners</p>
              <div className="flex items-center justify-center gap-20 flex-wrap">
                <img 
                  src="/lovable-uploads/e7fefdf4-d36c-4867-80a7-fcb25c648693.png" 
                  alt="Young Indians Logo" 
                  className="h-32 lg:h-40 w-auto object-contain hover:scale-110 transition-all duration-300 filter brightness-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                />
                <img 
                  src="/lovable-uploads/905e95c2-3362-435c-8378-e962ab280559.png" 
                  alt="Mahatma Global Schools Logo" 
                  className="h-32 lg:h-40 w-auto object-contain hover:scale-110 transition-all duration-300 filter brightness-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Powered By Section - Moved to bottom */}
        <div className="px-8 py-8 bg-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center gap-4 mb-2">
                <Award className="w-6 h-6 text-blue-300" />
                <span className="text-lg font-medium text-blue-200">Powered by Strawlabs for Yi Madurai chapter</span>
              </div>
              <p className="text-sm text-blue-300/60">© 2025 All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};