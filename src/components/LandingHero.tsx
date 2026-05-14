import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Award, ChevronRight } from "lucide-react";
import { LogoCarousel } from "@/components/ui/logo-carousel";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  YoungIndiansIcon, 
  ThalirIcon, 
  CIIIcon, 
  BharatRisingIcon,
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
    <div className="min-h-screen bg-surface selection:bg-primary/10 relative overflow-hidden font-sans">
      {/* Editorial Background Layers */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-surface-container-low skew-x-[-12deg] translate-x-24" />
        <div className="absolute top-[20%] left-[-10%] w-[40%] h-[60%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[50%] bg-secondary/5 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
        <div className="grid lg:grid-cols-[1fr,400px] gap-12 items-center">
          {/* Text Content */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-left"
          >
            <Badge className="mb-8 px-4 py-1.5 bg-tertiary-container text-on-tertiary-container border-none shadow-sm font-semibold tracking-wide rounded-full inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-on-tertiary-container opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-on-tertiary-container"></span>
              </span>
              The Grand Assembly 2025 - Now Live
            </Badge>

            <h1 className="font-display font-black text-6xl md:text-7xl lg:text-8xl xl:text-9xl leading-[0.9] tracking-[-0.04em] mb-8 text-on-surface">
              <span className="block text-primary">YOUNG</span>
              <span className="block italic">INDIANS</span>
              <span className="block text-secondary">PARLIAMENT</span>
            </h1>

            <p className="font-sans text-xl md:text-2xl text-on-surface-variant max-w-2xl leading-relaxed mb-10">
              Where the next generation of Indian leaders bridge the gap between 
              <span className="text-primary font-bold"> vision </span> and 
              <span className="text-secondary font-bold"> action</span>.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/login">
                <Button size="xl" className="bg-primary hover:bg-primary-container text-on-primary rounded-full px-10 shadow-xl shadow-primary/20 group">
                  Enter Parliament
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="xl" className="border-outline-variant bg-transparent text-on-surface hover:bg-surface-container-low rounded-full px-10">
                View Assembly
              </Button>
            </div>
          </motion.div>

          {/* Mascot Section - Breaking Bounds */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "backOut" }}
            className="relative lg:h-[600px] flex items-center justify-center lg:justify-end"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-[3rem] blur-2xl -z-10" />
            <img 
              src="/lovable-uploads/acb05533-0bc0-4094-9302-9f7621f49697.png"
              alt="YIP Tiger Mascot" 
              className="w-full max-w-[400px] lg:max-w-none lg:absolute lg:-right-20 lg:w-[130%] object-contain drop-shadow-[0_35px_35px_rgba(19,41,143,0.25)] hover:scale-105 transition-transform duration-500"
            />
          </motion.div>
        </div>

        {/* Features Row - Tonal Layering */}
        <div className="mt-32 grid md:grid-cols-3 gap-8">
          {[
            { icon: Users, title: "Future Leaders", desc: "Empowering students through rigorous parliamentary debate.", color: "primary" },
            { icon: Crown, title: "Civic Integrity", desc: "Fostering deep understanding of democratic values.", color: "secondary" },
            { icon: Award, title: "National Impact", desc: "Recognizing excellence in legislative discourse.", color: "tertiary" },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="p-10 bg-surface-container-low rounded-[2.5rem] shadow-sm hover:shadow-elevated transition-all group hover:-translate-y-2"
            >
              <div className={`w-14 h-14 rounded-2xl bg-${feature.color}/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`w-7 h-7 text-${feature.color}`} />
              </div>
              <h3 className="font-headline font-black text-2xl mb-4 text-on-surface leading-tight">{feature.title}</h3>
              <p className="text-on-surface-variant/70 leading-relaxed font-medium">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Partners Section */}
        <div className="mt-40 pt-24 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-primary/10 rounded-full" />
          <div className="text-center mb-20">
            <h2 className="font-headline text-[10px] font-black tracking-[0.4em] text-primary uppercase mb-4">Our Institutional Partners</h2>
            <p className="text-on-surface-variant/40 font-bold uppercase text-xs tracking-widest">Building the Future of Democracy</p>
          </div>
          <div className="flex justify-center opacity-40 hover:opacity-100 transition-opacity duration-700 filter grayscale hover:grayscale-0">
            <LogoCarousel columnCount={5} logos={partnerLogos} />
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-20 flex flex-col items-center gap-6 pb-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">Powered by</span>
            <img src="/lovable-uploads/strawlabs.png" alt="Strawlabs" className="h-10 opacity-80" />
          </div>
          <p className="text-sm text-on-surface-variant/60 font-medium">© 2025 Young Indians. Excellence in Civic Leadership.</p>
        </div>
      </div>
    </div>
  );
};