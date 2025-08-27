import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Award, Calendar } from "lucide-react";

export const LandingHero = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden text-white">
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
        {/* Top Navigation */}
        <div className="flex justify-between items-center p-8">
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/e7fefdf4-d36c-4867-80a7-fcb25c648693.png" 
              alt="Young Indians Logo" 
              className="h-16 w-auto object-contain"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/905e95c2-3362-435c-8378-e962ab280559.png" 
              alt="Mahatma Global Schools Logo" 
              className="h-16 w-auto object-contain"
            />
          </div>
        </div>

        {/* Main Hero Section */}
        <div className="px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-8 px-6 py-3 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Calendar className="w-5 h-5 mr-3" />
                Regional Round 2025 - Now Live
              </Badge>
              
              <h1 className="text-8xl lg:text-9xl font-black mb-8 tracking-tight">
                <span className="block text-transparent bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-500 bg-clip-text animate-pulse">
                  YOUNG
                </span>
                <span className="block text-transparent bg-gradient-to-r from-white via-blue-200 to-green-400 bg-clip-text">
                  INDIANS
                </span>
                <span className="block text-transparent bg-gradient-to-r from-green-400 via-blue-400 to-white bg-clip-text">
                  PARLIAMENT
                </span>
              </h1>
              
              <p className="text-3xl font-bold mb-6 text-blue-100">
                Madurai Regional Round
              </p>
              
              <p className="text-xl text-blue-200 max-w-3xl mx-auto mb-12 leading-relaxed">
                Where young minds debate, democracy thrives, and future leaders are born. 
                Join 170 participants in the most prestigious parliamentary debate competition.
              </p>
            </div>

            {/* Mascot and CTA Section */}
            <div className="text-center">
              <Button 
                size="xl"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-2xl px-12 py-6 rounded-2xl shadow-2xl hover:shadow-orange-500/25 hover:scale-105 transition-all duration-300 mb-8"
                onClick={() => window.location.href = '/login'}
              >
                <Crown className="w-8 h-8 mr-4" />
                ENTER PARLIAMENT
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="px-8 py-16 bg-black/20 backdrop-blur-lg border-t border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12 text-center">
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Future Leaders</h3>
                <p className="text-blue-200">Shaping tomorrow's democratic leaders through debate and discourse</p>
              </div>
              
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Democratic Values</h3>
                <p className="text-blue-200">Building strong democratic foundations for India's future</p>
              </div>
              
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Excellence</h3>
                <p className="text-blue-200">Recognizing outstanding parliamentary performance and leadership</p>
              </div>
            </div>
            
            <div className="text-center mt-16 pt-8 border-t border-white/10">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">Powered by Yi Madurai Chapter</span>
              </div>
              <p className="text-blue-200">Democracy in Action • Leadership Through Service • Building India's Future</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};