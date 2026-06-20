import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { InstallPrompt } from "@/components/InstallPrompt";

export const LandingHero = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-surface font-body text-on-surface selection:bg-primary-container selection:text-on-primary-container overflow-x-hidden">
      {/* Hero Section */}
      <header className="relative min-h-[70vh] flex items-center justify-center overflow-hidden asymmetric-shape">
        <div className="absolute inset-0 z-0">
          <img 
            alt="High-fidelity cinematic shot of diverse students in professional suits debating in a grand parliament hall" 
            className="w-full h-full object-cover brightness-[0.5] scale-105 transition-transform [transition-duration:10s] hover:scale-100" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuATHuU5p_XsKs4CgHcao5AvkDe2LShSGhMVNczkx9bwLc_EPQRPVqQ48RAop4pcMUNXAZXq4pZ_RbkjcGdXDwzvDqb_x7od8E0baFWnAmwGHW3iil0DcRdJ_MD7vuXg_bsIUdqFkQ0IwNXc1-6XmZmYTVWPl40DeZjldftlC0FrBi83TA2v8YNSlfkdb-t5dLswqdMn52ANLyOoSU8P3vsakHNy-aSZgb0nZF09rR0A-8gdi2tIJzY3it5sGbaTpr4NAV3nfsGOkDxz"
          />
          <div className="absolute inset-0 img-overlay"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 pt-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-headline text-white leading-[0.95] mb-4 tracking-tighter text-glow">
              THE FUTURE OF <br/>
              <span className="text-primary-fixed">DIPLOMACY</span> <br/>
              STARTS HERE
            </h1>
            <p className="max-w-xl mx-auto text-xs md:text-sm lg:text-base text-white/80 font-medium mb-6 leading-relaxed">
              Empowering the next generation of Indian leaders to debate, deliberate, and decide the national agenda in the most immersive high-fidelity parliamentary simulation.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate("/login")}
                className="w-full md:w-auto px-5 py-2.5 bg-primary text-white rounded-full font-bold text-sm hover:scale-[1.02] transition-transform shadow-[0_12px_28px_rgba(19,41,143,0.25)]"
              >
                Take Your Seat
              </button>
              {/* Watch Documentary Button removed as per previous request */}
              <InstallPrompt />
            </div>
          </motion.div>
        </div>
      </header>
 
      {/* Mission Section */}
      <section className="pt-12 pb-16 relative bg-surface overflow-hidden" id="mission">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 pointer-events-none">
          <svg className="w-full h-full text-primary" viewBox="0 0 100 100">
            <circle cx="100" cy="0" fill="currentColor" fill-opacity="0.2" r="80"></circle>
          </svg>
        </div>
        <div className="container mx-auto px-6 relative">
          <div className="flex flex-col lg:flex-row gap-10 items-center">
            <div className="lg:w-1/2">
              <span className="text-primary font-bold tracking-[0.2em] uppercase text-[10px] mb-2 block">Our Impact</span>
              <h2 className="text-2xl md:text-3xl font-black font-headline text-primary mb-4 leading-[1.1]">
                Bridging the gap between <span className="text-secondary">Youth</span> and <span className="text-secondary">Governance</span>
              </h2>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                The Young Indians Parliament isn't just a competition; it's a crucible for leadership. We provide a platform for K-12 students to understand the intricacies of legislative processes, constitutional values, and collective decision-making.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shrink-0 shadow-sm shadow-primary/10">
                    <span className="material-symbols-outlined text-base">gavel</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-primary text-base mb-0">Civic Literacy</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Mastering the art of parliamentary procedure and constitutional rights.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary shrink-0 shadow-sm shadow-tertiary/10">
                    <span className="material-symbols-outlined text-base">diversity_3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-primary text-base mb-0">Diplomatic Dialogue</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Developing empathy and negotiation skills across diverse viewpoints.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 relative w-full max-w-md lg:max-w-none mx-auto">
              <div className="aspect-[4/4.5] max-h-[540px] rounded-2xl overflow-hidden shadow-[0_25px_50px_-20px_rgba(19,41,143,0.2)]">
                <img alt="Professional student orator speaking confidently behind a podium in a formal chamber" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeAU51EZpMLJCUBwh8yPkWK7gZcY-4euO-57X-9a1bFvwIBBLvMkdfX_Q7ZgmFs02H7zeOM8ytx_ZSDdyQjOygROfJOkP6ZB_xr7kIKq0AL1FB-A1Jwycpox1wcxFIHlz6EKZtlZi4cwqU9zQ8z9jKnsVf0mDcklB1aTSIbnZ1mfleQfkOLwyTbGzPhEL1oqTEiVZcHNK9gTtR-vWE3lDXagrM-XoSs6qip2LCgR_GfnHBHlsmSLe-0e56lxwxdHdfBJq-9dpB01-B" />
              </div>
              <div className="absolute -bottom-6 -left-6 p-4 bg-white rounded-xl shadow-lg max-w-[240px] md:max-w-xs border border-outline-variant/15">
                <p className="text-xs font-medium italic text-on-surface leading-relaxed">Have the courage to think differently, courage to invent, to travel the unexplored path, to conquer problems and succeed.</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">K</div>
                  <div>
                    <div className="font-black text-primary text-xs">— Dr. A. P. J. Abdul Kalam</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-12 bg-surface-container-low overflow-hidden" id="roadmap">
        <div className="container mx-auto px-6 text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-black font-headline text-primary mb-2">Road to the Podium</h2>
          <p className="text-on-surface-variant text-sm max-w-2xl mx-auto">Your journey from a classroom debate to the halls of national power.</p>
        </div>
        <div className="container mx-auto px-6 relative">
          <div className="flex flex-col md:flex-row justify-center items-stretch gap-4 relative max-w-7xl mx-auto">
            {/* Step 1 */}
            <div className="relative z-10 w-full md:w-1/3 group">
              <div className="h-full bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden border border-outline-variant/10">
                <div className="h-40 overflow-hidden">
                  <img alt="Students collaborating in a school setting" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBh06SWGhvzY4J9cCcpHT9NQrDHzLedvaPrclZSuO3Z59sCRkBLKcXNBhRtNssmiAbF_u00dlWqToOeg0mVPjZOYp1xsPoDhv61Ok3BSQQdu535jhqqdW8PHayHqrV-lO9FZKGq5eBm4moM79uPdwuvlv5YPrwCWajutbmyvDXt_Llk0i2YlRIb_OienObn7sizWjMyC4OzdGkdCRftsdBT3B_c1IA_80TyeMQerop9h60mfIWtltYO6c_z9CGDBWqm-nnjxoUd2Tef" />
                </div>
                <div className="p-4">
                  <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center mb-3 shadow-md">
                    <span className="material-symbols-outlined text-base">school</span>
                  </div>
                  <h3 className="text-base font-black text-primary mb-1 font-headline uppercase tracking-tight">Chapter Level</h3>
                  <p className="text-on-surface-variant text-xs leading-relaxed">Intra-school selections and basic training in parliamentary procedures. Where every voice begins its journey in our mock parliament environment.</p>
                </div>
              </div>
            </div>
            {/* Step 2 */}
            <div className="relative z-10 w-full md:w-1/3 group">
              <div className="h-full bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden border border-outline-variant/10">
                <div className="h-40 overflow-hidden">
                  <img alt="Competitive regional debate summit" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjp11a58pgZ-doTTWuQ_pb-XkM1IboIqFp5vU3HXyrNMPD33X5wLBydBAgGAsl8u5GfzGoD9CpziKx2nZhjF_cZ97bH6n_EuZ9fDKa0Hc9ywNY3xsSnYm0KjwI7jejcLD5urQt0P4Eyv9uLgAqokl-KqFCknNfRfD2SHBb3o-QEtdFhM_GoFSa6JfeWCfAMXGhckvDRpkIcdxHHIRM832Q3jEs0l8iQSgbR-n-d2bM-jvXQU_IiISiE4-qnrWkGtRiz48k3hcDqEHY" />
                </div>
                <div className="p-4">
                  <div className="w-8 h-8 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center mb-3 shadow-md">
                    <span className="material-symbols-outlined text-base">map</span>
                  </div>
                  <h3 className="text-base font-black text-primary mb-1 font-headline uppercase tracking-tight">Regional Level</h3>
                  <p className="text-on-surface-variant text-xs leading-relaxed">Competitive debates across zones. Top performers represent their regions in state-level summits, refining their diplomatic negotiation skills.</p>
                </div>
              </div>
            </div>
            {/* Step 3 */}
            <div className="relative z-10 w-full md:w-1/3 group">
              <div className="h-full bg-primary rounded-2xl shadow-xl overflow-hidden border border-white/10 text-white">
                <div className="h-40 overflow-hidden brightness-75">
                  <img alt="National parliament simulation in a grand chamber" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_WZyxQ8WIE-zb45p32lnPVvw0i28KL7JaJwpq0_eZNoN9nmWypAdN6nCzSCJDu5bT15je5DBPleQITlJlcP1Yel86Tntv9jLd9GqJwQhLBF5I-6nGXJ7ECsc2oVJyOdtO3wSfhem7tLYH8TPqjsQzdWMRxryA2N7mwJwbxst5lVWVCnN2_MeDTg7no8aZVnGy7h7ufxgxkZWkSYZUSiMPQI3gj8C8nDZChkfRK7m60wglg_c0UOJs34cOH5s0OIimY5o9vdOidzUz" />
                </div>
                <div className="p-4">
                  <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center mb-3 shadow-md backdrop-blur-md">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
                  </div>
                  <h3 className="text-base font-black mb-1 font-headline uppercase tracking-tight">National Assembly</h3>
                  <p className="text-white/80 text-xs leading-relaxed">The grand finale. Experience a high-fidelity parliamentary simulation, presenting your bills in a mock assembly modeled after the highest house of the nation.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="py-12 bg-surface-container-lowest" id="impact">
        <div className="container mx-auto px-6">
          <div className="bg-primary rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 z-0">
              <img alt="High-fidelity parliament simulation atmosphere" className="w-full h-full object-cover opacity-20" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA35LDDZvB7m68K9S_36rh2C-p19mfDk_HN4ofK5XJLvV_S4Z-70r0lf5ZxLg3ELJGVXnAFzPYyVkU54tUqZA-DDbA-6jM71BSw9EHPh6b-H0pw8ENVHOBs_XvdvXWo-i8GoTNh-HE9aiufGht62WsE3Aq1h_1HF3Cd4IyNZ2eddWDF_9pYCz5ESW8gYGZpEu2v3avVB7Q1fu6atglkBXGeI0LgcHrLvcZyLw9vp4C-OdmnUXYLTNbDblCCdjy5tZltK0W7F10WSrRB" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary-container/90 to-primary/80"></div>
            </div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div>
                <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[8px] font-black uppercase tracking-[0.3em] mb-2 inline-block">The Simulation</span>
                <h2 className="text-2xl md:text-3xl font-black font-headline text-white mb-3 leading-tight">Legislating the <br/>Change We Seek</h2>
                <p className="text-white/80 text-xs md:text-sm leading-relaxed mb-6">
                  YIP offers a high-fidelity parliamentary simulation that goes beyond theory. Our mock parliament allows students to engage in rigorous policy drafting, heated debates, and collaborative governance modeling.
                </p>
                <div className="flex gap-6">
                  <div className="flex flex-col">
                    <span className="text-white/60 text-[8px] font-black uppercase tracking-widest mb-0.5">Program Scope</span>
                    <span className="text-white font-headline text-base font-bold">National-Scale</span>
                  </div>
                  <div className="w-px h-10 bg-white/20"></div>
                  <div className="flex flex-col">
                    <span className="text-white/60 text-[8px] font-black uppercase tracking-widest mb-0.5">Experience Level</span>
                    <span className="text-white font-headline text-base font-bold">Elite Assembly</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "500+", desc: "Resolutions drafted and debated annually." },
                  { value: "300+", desc: "Hours of immersive simulation training." },
                  { value: "25+", desc: "Unique committees across all sectors." },
                  { value: "1000+", desc: "Students impacted." }
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-xl p-4 rounded-xl border border-white/20 hover:bg-white/20 transition-colors">
                    <div className="text-2xl md:text-3xl font-black text-white mb-1">{item.value}</div>
                    <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wider leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners & Sponsors Section */}
      <section className="py-10 bg-surface" id="partners">
        <div className="container mx-auto px-6 text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-black font-headline text-primary mb-2 tracking-tighter">Our Partners &amp; Sponsors</h2>
          <p className="text-on-surface-variant text-sm max-w-2xl mx-auto">Collaborating with leading institutions to build the leaders of tomorrow.</p>
        </div>
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-center max-w-5xl mx-auto">
            {[
              { src: "/partners/cii-logo.png",          alt: "Confederation of Indian Industry", bg: "bg-[#3d2e80]" },
              { src: "/partners/yi-logo.png",            alt: "Young Indians",                    bg: "bg-black"     },
              { src: "/partners/thangamayil-logo.png",   alt: "Thangamayil Jewellery",            bg: "bg-white"     },
              { src: "/partners/solamalai-logo.png",     alt: "Solamalai College of Engineering", bg: "bg-white"     },
              { src: "/partners/thalir-logo.png",        alt: "Thalir",                           bg: "bg-white"     },
              { src: "/partners/strawlabs-logo.png",     alt: "Strawlabs",                        bg: "bg-white"     },
            ].map((partner, i) => (
              <div key={i} className={`flex justify-center items-center p-3 ${partner.bg} border border-outline-variant/10 rounded-xl h-20 overflow-hidden`}>
                <img
                  src={partner.src}
                  alt={partner.alt}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = 'none';
                    const parent = el.parentElement;
                    if (parent && !parent.querySelector('span')) {
                      const span = document.createElement('span');
                      span.textContent = partner.alt;
                      span.style.cssText = 'font-size:10px;font-weight:700;text-align:center;color:#888;padding:4px;';
                      parent.appendChild(span);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join Now CTA */}
      <section className="py-12 bg-surface-container-low" id="join">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.1)] relative border border-outline-variant/10 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-tertiary"></div>
            <div className="mb-4 inline-flex items-center justify-center w-10 h-10 bg-primary text-white rounded-xl shadow-md rotate-3">
              <span className="material-symbols-outlined text-xl">edit_note</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-headline text-primary mb-3 tracking-tighter leading-[1.1]">Registrations for 2026 are <span className="text-secondary">now open</span></h2>
            <p className="text-xs md:text-sm text-on-surface-variant mb-6 leading-relaxed max-w-2xl mx-auto">
              Secure your seat in the next National Assembly and start your journey as a Digital Diplomat today. Experience the most authentic mock parliament in the country.
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-3">
              <button 
                onClick={() => navigate("/login")}
                className="bg-primary text-white px-6 py-2.5 rounded-full font-black text-sm hover:scale-[1.02] transition-transform shadow-[0_15px_30px_rgba(19,41,143,0.2)]"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingHero;