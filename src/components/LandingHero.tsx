import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Award, Calendar } from "lucide-react";
import { LogoCarousel } from "@/components/ui/logo-carousel";
import { GradientHeading } from "@/components/ui/gradient-heading";
import { Link } from "react-router-dom";
import { 
  YoungIndiansIcon, 
  ThalirIcon, 
  CIIIcon, 
  MahatmaIcon, 
  SriKaliSwariIcon, 
  BharatRisingIcon,
  WondrDiamondsIcon,
  StrawlabsIcon
} from "@/components/ui/partner-logos";

// Logo data for the carousel
const partnerLogos = [
  { name: "Young Indians", id: 1, img: YoungIndiansIcon },
  { name: "Thalir", id: 2, img: ThalirIcon },
  { name: "CII", id: 3, img: CIIIcon },
  { name: "Bharat Rising", id: 6, img: BharatRisingIcon },
  { name: "Strawlabs", id: 7, img: StrawlabsIcon },
];

export const LandingHero = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative overflow-hidden text-slate-800">
      {/* Enhanced animated background */}
      <div className="absolute inset-0">
        {/* Enhanced dot pattern */}
        <div className="absolute top-0 left-0 w-full h-full opacity-60">
          <div className="absolute inset-0 bg-white/8" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        
        {/* More visible flowing gradient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-orange-500/50 to-orange-300/30 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-1/2 -right-40 w-[28rem] h-[28rem] bg-gradient-to-bl from-green-500/45 to-green-300/25 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-gradient-to-t from-blue-500/40 to-blue-300/20 rounded-full blur-2xl animate-pulse delay-500"></div>
        
        {/* More visible floating bubbles */}
        <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-orange-400/40 rounded-full animate-bounce shadow-lg shadow-orange-400/20" style={{animationDelay: '0s', animationDuration: '3s'}}></div>
        <div className="absolute top-3/4 left-1/3 w-8 h-8 bg-green-400/35 rounded-full animate-bounce shadow-lg shadow-green-400/20" style={{animationDelay: '1s', animationDuration: '4s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-5 h-5 bg-blue-400/45 rounded-full animate-bounce shadow-lg shadow-blue-400/20" style={{animationDelay: '2s', animationDuration: '3.5s'}}></div>
        <div className="absolute top-1/6 right-1/3 w-7 h-7 bg-orange-300/40 rounded-full animate-bounce shadow-lg shadow-orange-300/20" style={{animationDelay: '0.5s', animationDuration: '4.5s'}}></div>
        <div className="absolute bottom-1/4 left-1/6 w-6 h-6 bg-green-300/38 rounded-full animate-bounce shadow-lg shadow-green-300/20" style={{animationDelay: '3s', animationDuration: '3.8s'}}></div>
        <div className="absolute bottom-1/3 right-1/6 w-9 h-9 bg-blue-300/32 rounded-full animate-bounce shadow-lg shadow-blue-300/20" style={{animationDelay: '1.5s', animationDuration: '4.2s'}}></div>
        
        {/* Enhanced flowing lines */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute top-20 left-0 w-96 h-0.5 bg-gradient-to-r from-transparent via-orange-400/50 to-transparent transform rotate-12 animate-pulse shadow-md shadow-orange-400/30" style={{animationDuration: '6s'}}></div>
          <div className="absolute top-40 right-0 w-80 h-0.5 bg-gradient-to-r from-transparent via-green-400/45 to-transparent transform -rotate-12 animate-pulse shadow-md shadow-green-400/30" style={{animationDelay: '2s', animationDuration: '5s'}}></div>
          <div className="absolute bottom-32 left-1/4 w-72 h-0.5 bg-gradient-to-r from-transparent via-blue-400/40 to-transparent transform rotate-6 animate-pulse shadow-md shadow-blue-400/30" style={{animationDelay: '4s', animationDuration: '7s'}}></div>
        </div>
        
        {/* Curved glass elements */}
        <div className="absolute top-20 right-20 w-64 h-32 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 shadow-xl transform rotate-12 animate-pulse" style={{animationDelay: '1s', animationDuration: '8s'}}></div>
        <div className="absolute bottom-40 left-20 w-48 h-48 bg-gradient-to-br from-orange-400/20 to-green-400/20 backdrop-blur-sm rounded-full border border-white/30 shadow-xl transform -rotate-6 animate-pulse" style={{animationDelay: '3s', animationDuration: '10s'}}></div>
      </div>

      {/* Hero Content */}
      <div className="relative z-10">
        {/* Glass navigation container */}
        <div className="flex justify-center items-center p-8">
          <div className="absolute top-0 left-0 right-0 h-24 bg-white/10 backdrop-blur-sm border-b border-white/20"></div>
        </div>

        {/* Main Hero Section */}
        <div className="px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <Badge className="mb-6 sm:mb-8 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/30 shadow-lg">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full mr-2 sm:mr-3 shadow-lg shadow-green-500/50 animate-pulse"></div>
                National Finals 2025 - Now Live
              </Badge>
              
              <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 mb-8">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-9xl font-black tracking-tight drop-shadow-2xl">
                  <span className="block text-transparent bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400 bg-clip-text">
                    YOUNG
                  </span>
                  <span className="block text-transparent bg-gradient-to-r from-orange-600 via-slate-800 to-green-600 bg-clip-text">
                    INDIANS
                  </span>
                  <span className="block text-transparent bg-gradient-to-r from-orange-600 via-slate-800 to-green-600 bg-clip-text">
                    PARLIAMENT
                  </span>
                </h1>
                
                <div className="relative lg:block">
                  <img 
                    src="/lovable-uploads/acb05533-0bc0-4094-9302-9f7621f49697.png"
                    alt="Young Indians Parliament Tiger Mascot" 
                    className="w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 object-contain hover:scale-110 transition-transform duration-300 drop-shadow-2xl mx-auto"
                  />
                </div>
              </div>
              
              <div className="mb-8 sm:mb-12">
                <p className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 sm:mb-4 text-slate-700 drop-shadow-lg">
                  National Finals - New Delhi
                </p>
                
                <p className="text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed px-4">
                  Where young minds debate and democracy thrives
                </p>
              </div>
            </div>

            {/* Enhanced Features Section with Glass Morphism */}
            <div className="mb-12 sm:mb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-center max-w-6xl mx-auto px-4">
                <div className="group bg-white/15 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/25 p-6 sm:p-8 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform duration-300">
                      <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-4 h-4 sm:w-6 sm:h-6 bg-orange-400/40 rounded-full animate-bounce"></div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800">Future Leaders</h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">Shaping tomorrow's democratic leaders through debate and discourse</p>
                </div>
                
                <div className="group bg-white/15 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/25 p-6 sm:p-8 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                      <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-4 h-4 sm:w-6 sm:h-6 bg-blue-400/40 rounded-full animate-bounce" style={{animationDelay: '1s'}}></div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800">Democratic Values</h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">Building strong democratic foundations for India's future</p>
                </div>
                
                <div className="group bg-white/15 backdrop-blur-lg rounded-2xl sm:rounded-3xl border border-white/25 p-6 sm:p-8 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
                      <Award className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-4 h-4 sm:w-6 sm:h-6 bg-green-400/40 rounded-full animate-bounce" style={{animationDelay: '2s'}}></div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800">Excellence</h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">Recognizing outstanding parliamentary performance and leadership</p>
                </div>
              </div>
            </div>

            {/* Enhanced CTA Section */}
            <div className="text-center mb-8 sm:mb-12 px-4">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 rounded-2xl sm:rounded-3xl blur-xl"></div>
                <Link to="/login">
                  <Button 
                    size="lg"
                    className="relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xl sm:text-2xl lg:text-3xl px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 rounded-2xl sm:rounded-3xl shadow-2xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300 border border-white/20 touch-target"
                  >
                    <Crown className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mr-3 sm:mr-4 lg:mr-6" />
                    ENTER PARLIAMENT
                  </Button>
                </Link>
              </div>
              
              {/* Enhanced Glass Buttons Section */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-6 mt-12 sm:mt-20">
                <div className="group bg-white/20 backdrop-blur-lg border border-white/30 rounded-xl sm:rounded-2xl px-6 sm:px-8 py-4 sm:py-5 text-slate-800 hover:bg-white/35 transition-all duration-500 hover:scale-110 hover:shadow-2xl hover:shadow-green-500/20 shadow-lg cursor-pointer animate-fade-in w-full sm:w-auto max-w-xs">
                  <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full shadow-lg shadow-green-500/60 animate-pulse group-hover:animate-bounce"></div>
                      <div className="absolute inset-0 w-3 h-3 sm:w-4 sm:h-4 bg-green-400/30 rounded-full animate-ping group-hover:animate-none"></div>
                    </div>
                    <span className="font-semibold text-base sm:text-lg group-hover:text-green-700 transition-colors duration-300">Democracy in Action</span>
                  </div>
                </div>
                <div className="group bg-white/20 backdrop-blur-lg border border-white/30 rounded-xl sm:rounded-2xl px-6 sm:px-8 py-4 sm:py-5 text-slate-800 hover:bg-white/35 transition-all duration-500 hover:scale-110 hover:shadow-2xl hover:shadow-slate-800/20 shadow-lg cursor-pointer animate-fade-in w-full sm:w-auto max-w-xs" style={{animationDelay: '0.2s'}}>
                  <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-slate-800 rounded-full shadow-lg shadow-slate-800/60 animate-pulse group-hover:animate-bounce" style={{animationDelay: '1s'}}></div>
                      <div className="absolute inset-0 w-3 h-3 sm:w-4 sm:h-4 bg-slate-600/30 rounded-full animate-ping group-hover:animate-none" style={{animationDelay: '1s'}}></div>
                    </div>
                    <span className="font-semibold text-base sm:text-lg group-hover:text-slate-900 transition-colors duration-300">Leadership Through Service</span>
                  </div>
                </div>
                <div className="group bg-white/20 backdrop-blur-lg border border-white/30 rounded-xl sm:rounded-2xl px-6 sm:px-8 py-4 sm:py-5 text-slate-800 hover:bg-white/35 transition-all duration-500 hover:scale-110 hover:shadow-2xl hover:shadow-orange-500/20 shadow-lg cursor-pointer animate-fade-in w-full sm:w-auto max-w-xs" style={{animationDelay: '0.4s'}}>
                  <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4">
                    <div className="relative">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-orange-500 rounded-full shadow-lg shadow-orange-500/60 animate-pulse group-hover:animate-bounce" style={{animationDelay: '2s'}}></div>
                      <div className="absolute inset-0 w-3 h-3 sm:w-4 sm:h-4 bg-orange-400/30 rounded-full animate-ping group-hover:animate-none" style={{animationDelay: '2s'}}></div>
                    </div>
                    <span className="font-semibold text-base sm:text-lg group-hover:text-orange-700 transition-colors duration-300">Building India's Future</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Partners & Sponsors Carousel Section */}
        <div className="px-8 py-16 bg-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <GradientHeading size="lg" variant="secondary" className="mb-8">
                Our Partners & Sponsors
              </GradientHeading>
              <p className="text-slate-600 text-lg mb-12 max-w-2xl mx-auto">
                Proud to collaborate with leading organizations who share our vision for India's future
              </p>
              
              {/* Animated Logo Carousel */}
              <div className="flex justify-center">
                <LogoCarousel columnCount={2} logos={partnerLogos} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Powered By Section - Moved to bottom */}
        <div className="px-8 py-8 bg-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-base md:text-lg font-medium text-slate-600">Powered by</span>
                <img 
                  src="/lovable-uploads/strawlabs.png" 
                  alt="Strawlabs" 
                  className="h-12 md:h-16 object-contain"
                />
              </div>
              <p className="text-sm text-slate-500">© 2025 All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};