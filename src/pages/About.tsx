import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const About = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 mb-16 relative text-center">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-secondary/10 text-secondary font-black text-label-sm mb-4 uppercase tracking-[0.3em] shadow-sm">
            Legacy of Excellence
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl text-primary mb-6 leading-[1.1] font-headline font-black tracking-tighter uppercase">
            The <span className="text-secondary">Assembly</span> <br />
            Chronicles 2025
          </h1>
          
          <div className="grid md:grid-cols-2 gap-12 text-left items-center pt-8">
            <div className="space-y-4">
              <p className="text-base text-primary leading-tight font-black uppercase italic tracking-tight">
                Over <span className="text-secondary not-italic">4,500 students</span> participated in chapter-level rounds nationwide.
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                From this pool, delegates were shortlisted for intensive sessions held across seven vibrant cities: 
              </p>
              <div className="flex flex-wrap gap-2">
                {['Surat', 'Trivandrum', 'Madurai', 'Kanpur', 'Jamshedpur', 'Guwahati', 'Hyderabad'].map(city => (
                  <span key={city} className="px-3 py-1 bg-primary/5 rounded-full font-black text-primary text-[10px] uppercase tracking-widest border border-primary/5">{city}</span>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                The <span className="text-primary font-black">Grand Assembly</span> culminated in <span className="text-primary font-black">Delhi</span>, November 2025, bringing together the nation's brightest young minds.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-primary/5 group">
                <img 
                  alt="The Assembly" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000" 
                  src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent"></div>
              </div>
              <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-secondary/10 blur-[100px] rounded-full"></div>
            </div>
          </div>
        </section>

        {/* Institutional Section */}
        <section className="bg-primary/5 py-16 overflow-hidden">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-12 gap-10 items-center">
              <div className="md:col-span-5 relative">
                <img 
                  alt="Senior Policymakers" 
                  className="rounded-2xl shadow-xl relative z-10" 
                  src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2084&auto=format&fit=crop"
                />
                <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
              </div>
              <div className="md:col-span-7 space-y-6">
                <h2 className="text-2xl md:text-3xl text-primary leading-none font-headline font-black uppercase tracking-tighter">
                  Institutional <br />
                  <span className="text-secondary">Patronage</span>
                </h2>
                <p className="text-sm md:text-base text-on-surface-variant leading-relaxed font-medium italic border-l-4 border-secondary pl-6 py-2">
                  "The Grand Assembly has featured interactions with senior policymakers and Members of Parliament, offering real-world exposure to the nation's decision-making apparatus."
                </p>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-5 bg-background rounded-2xl shadow-sm border border-primary/5 hover:scale-[1.02] transition-all">
                    <h4 className="font-headline font-black text-sm text-primary uppercase tracking-tight mb-2 italic">Real Exposure</h4>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">Direct dialogue with national decision makers and constitutional authorities.</p>
                  </div>
                  <div className="p-5 bg-background rounded-2xl shadow-sm border border-primary/5 hover:scale-[1.02] transition-all">
                    <h4 className="font-headline font-black text-sm text-secondary uppercase tracking-tight mb-2 italic">Mentorship</h4>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">Learning from the architects of India's future policies and legislative frameworks.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16 max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-label-sm font-black text-secondary uppercase tracking-[0.3em] mb-3 block">The Digital Diplomat</span>
            <h2 className="text-2xl md:text-3xl text-primary font-black uppercase leading-none tracking-tighter mb-4">
              Defining Youth <br />
              <span className="text-secondary">Statecraft</span>
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
              The Young Indians Parliament is a national civic leadership platform designed to bring democracy alive through experiential learning.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="group p-6 bg-primary/5 rounded-2xl hover:bg-primary transition-all duration-500">
              <h3 className="text-lg font-headline font-black text-primary group-hover:text-white mb-3 italic uppercase tracking-tighter">Nation Building</h3>
              <p className="text-xs text-on-surface-variant group-hover:text-white/80 font-medium leading-relaxed">
                Cultivating deep civic awareness and responsibility by enabling students to understand the mechanics of how democracy functions in the 21st century.
              </p>
            </div>

            <div className="group p-6 bg-secondary/5 rounded-2xl hover:bg-secondary transition-all duration-500">
              <h3 className="text-lg font-headline font-black text-secondary group-hover:text-primary mb-3 italic uppercase tracking-tighter">Leadership</h3>
              <p className="text-xs text-secondary/80 group-hover:text-primary/80 font-medium leading-relaxed">
                Developing the essential toolkit of modern leadership — public speaking, strategic collaboration, and decisive governance.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 relative overflow-hidden bg-primary mx-6 rounded-2xl shadow-xl mb-16">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <h2 className="text-2xl md:text-3xl text-white font-headline font-black uppercase leading-[1.1] tracking-tighter mb-6">
                Join <span className="text-secondary">The Assembly</span> <br />
                Class of 2026
              </h2>
              <ul className="space-y-4 mb-8">
                {[
                  "Students of Classes 9–12",
                  "Participation through 150+ Chapters",
                  "Verified National Pathways"
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white font-bold">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[10px] font-black">check</span>
                    </div>
                    {text}
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button className="bg-secondary text-primary hover:bg-white rounded-full px-6 py-2.5 h-auto text-label-sm font-black uppercase tracking-[0.2em] transition-all hover:scale-105 border-none shadow-lg">
                  Take Your Seat
                </Button>
              </Link>
            </div>
            <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-headline font-black text-white uppercase tracking-[0.2em]">The Lifecycle</h3>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { num: "01", title: "Registration", desc: "Digital onboarding & chapter verification." },
                  { num: "02", title: "The Oath", desc: "Formal commitment to constitutional values." },
                  { num: "03", title: "Debate", desc: "Parliamentary-style dialogue and policy review." },
                  { num: "04", title: "Resolution", desc: "Collective decision making and national impact." }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="text-secondary font-black italic text-2xl leading-none">{item.num}</div>
                    <div>
                      <h4 className="font-black text-xs text-white leading-tight mb-1 uppercase tracking-tight">{item.title}</h4>
                      <p className="text-white/50 text-[10px] font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-full h-full overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-secondary/20 blur-[120px] rounded-full"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 blur-[120px] rounded-full"></div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
