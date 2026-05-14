import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const About = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Success Section */}
        <section className="max-w-7xl mx-auto px-8 mb-24 relative text-center">
          <div className="inline-flex items-center px-4 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-bold text-sm mb-6 uppercase tracking-widest">
            Legacy of Excellence
          </div>
          <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-primary leading-tight -tracking-[0.03em] mb-8">
            Celebrating the <br/>
            <span className="text-secondary-container">Success of The Assembly 2025.</span>
          </h1>
          <div className="grid md:grid-cols-2 gap-12 text-left items-center pt-8">
            <div className="space-y-6">
              <p className="text-xl text-on-surface-variant leading-relaxed">
                Over <span className="text-primary font-bold">4,500 students</span> participated in the chapter level rounds across the country, showcasing an incredible response nationwide.
              </p>
              <p className="text-on-surface-variant leading-relaxed">
                From this talented pool, students were shortlisted for The Assembly held in seven vibrant cities: 
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                {['Surat', 'Trivandrum', 'Madurai', 'Kanpur', 'Jamshedpur', 'Guwahati', 'Hyderabad'].map(city => (
                  <span key={city} className="px-4 py-1.5 bg-surface-container-high rounded-full font-bold text-primary border border-primary/10">{city}</span>
                ))}
              </div>
              <p className="text-on-surface-variant leading-relaxed">
                The <span className="font-bold">Grand Assembly</span> was conducted in <span className="font-bold">Delhi</span>, in the month of November 2025; with the best students from all sessions qualifying for The Grand Assembly.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-[2rem] overflow-hidden shadow-2xl bg-primary-fixed">
                <img 
                  alt="The Assembly" 
                  className="w-full h-full object-cover" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3HOSv9RZCmqRTyObIJbT5IsdhyRp80CzWgEe-8nU_QbuNlOmJtYoinOQgyvWLIicdLG7CvBYr_Joi3XkMAVple1rfe2xB97yqZXHP_ei3XT99OY5z-yHKysT2EIoCXj3htLl6ZNZkxaM5PXM5v6DNwZdTwcuBX-218BWsN9U1c5ixlzG25rZybP1hP589cT8Y7ag7CklCOzJYocll_D48T-Vk9zMi7oLXKs3a1TbpCEhWJTVVaInRKsRih1iEytnC0cUCqbys-08A"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary-container rounded-full flex items-center justify-center text-white font-bold text-center p-4 transform rotate-12 shadow-xl">
                National Stage Reached!
              </div>
            </div>
          </div>
        </section>

        {/* Leadership & Institution Section */}
        <section className="bg-surface-container-low py-24">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid md:grid-cols-12 gap-12 items-center">
              <div className="md:col-span-5 grayscale hover:grayscale-0 transition-all duration-700">
                <img 
                  alt="Senior Policymakers" 
                  className="rounded-[3rem] shadow-2xl border-8 border-white" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrrHmuWnFt10UEdZeS5R53C6ojaLjcWqwaknuYljWnD0YwsIghJylFKN1v1M3mQBdEjYruc5i8r0uPprMOKcNZlmQF1lsXmwVBmbGdJB59xG8YKr6KvZfK1nHrwwuKfc5bLDMIrU6qrXbi8PCAzeVkAsOIZ7-K3GtSOdS2BxOOQTxm3FIWXpa7SBueDdRyAc9a3SUi5k8Uh7IkAmFZibDLQc_D39I2e_02zEIZbHK0DdhoEA6J5tmOC1qwda_U-e-OAGtqTKZIJ8mh"
                />
              </div>
              <div className="md:col-span-7 space-y-8">
                <h2 className="text-4xl font-headline font-bold text-on-surface">Leadership & <br/>Institutional Engagement</h2>
                <p className="text-xl text-on-surface-variant leading-relaxed italic border-l-4 border-primary pl-6">
                  "The Grand Assembly has featured interactions with senior policymakers, Members of Parliament, and national leaders, offering students real-world exposure to governance and public leadership."
                </p>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-6 bg-white rounded-3xl shadow-sm">
                    <span className="material-symbols-outlined text-primary mb-2">policy</span>
                    <h4 className="font-bold text-sm uppercase tracking-wider mb-2">Real Exposure</h4>
                    <p className="text-sm text-on-surface-variant">Direct dialogue with national decision makers.</p>
                  </div>
                  <div className="p-6 bg-white rounded-3xl shadow-sm">
                    <span className="material-symbols-outlined text-secondary-container mb-2">history_edu</span>
                    <h4 className="font-bold text-sm uppercase tracking-wider mb-2">Mentorship</h4>
                    <p className="text-sm text-on-surface-variant">Learning from the architects of India's policies.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What is YIP Section */}
        <section className="py-24 max-w-7xl mx-auto px-8">
          <div className="text-center max-w-4xl mx-auto mb-20">
            <h2 className="text-4xl font-headline font-bold text-primary mb-8 underline decoration-secondary-container decoration-4 underline-offset-8">What is The Assembly?</h2>
            <p className="text-2xl text-on-surface font-semibold leading-relaxed mb-8">
              The Assembly is a national civic leadership platform designed to bring democracy alive for school students through experiential learning.
            </p>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              More than a simulation, The Assembly is a leadership laboratory where students step into the roles of parliamentarians to debate, question, collaborate, and draft solutions to real national issues. Through this immersive process, students develop informed perspectives, leadership skills, and a strong sense of civic responsibility.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group p-10 bg-surface-container-low rounded-[2.5rem] hover:bg-primary hover:text-white transition-all duration-500 hover:scale-[1.02]">
              <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                <span className="material-symbols-outlined text-white text-3xl">public</span>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-4">Nation Building</h3>
              <p className="text-on-surface-variant group-hover:text-white/80 leading-relaxed">
                Cultivating civic awareness and responsibility by enabling students to understand how democracy functions and how citizens can contribute meaningfully to the nation's progress.
              </p>
            </div>

            <div className="group p-10 bg-surface-container-low rounded-[2.5rem] hover:bg-tertiary-container hover:text-white transition-all duration-500 hover:scale-[1.02]">
              <div className="w-16 h-16 bg-tertiary rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                <span className="material-symbols-outlined text-white text-3xl">groups</span>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-4">Youth Leadership</h3>
              <p className="text-on-surface-variant group-hover:text-white/80 leading-relaxed">
                Developing essential leadership skills — public speaking, collaboration, negotiation, and decision-making — by immersing students in the experience of governance.
              </p>
            </div>
          </div>
        </section>

        {/* Who Can Join Section */}
        <section className="bg-primary text-on-primary py-24 rounded-[4rem] mx-8 overflow-hidden shadow-3xl">
          <div className="max-w-7xl mx-auto px-12 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl font-headline font-bold mb-8">Who Can Join <br/><span className="text-tertiary-fixed">The Assembly 2026?</span></h2>
              <ul className="space-y-6">
                <li className="flex items-center gap-4 text-xl">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                    <span className="material-symbols-outlined text-tertiary-fixed text-sm">check</span>
                  </span>
                  Students of Classes 9–12
                </li>
                <li className="flex items-center gap-4 text-xl">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                    <span className="material-symbols-outlined text-tertiary-fixed text-sm">check</span>
                  </span>
                  Participation through schools
                </li>
                <li className="flex items-center gap-4 text-xl">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                    <span className="material-symbols-outlined text-tertiary-fixed text-sm">check</span>
                  </span>
                  National, regional, and city-level pathways
                </li>
              </ul>
              <div className="mt-12">
                <Link to="/login">
                  <button className="px-10 py-5 bg-tertiary-fixed text-on-tertiary-fixed rounded-2xl font-bold text-lg hover:bg-white transition-all flex items-center gap-2">
                    Start Your Registration <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </Link>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[3rem] border border-white/20 space-y-8">
              <h3 className="text-2xl font-headline font-bold border-b border-white/20 pb-4">Event Format</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="text-tertiary-fixed font-headline font-bold text-4xl opacity-50">01</div>
                  <div>
                    <h4 className="font-bold text-lg">Registration</h4>
                    <p className="text-white/70">Participants check in and receive instructions.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-tertiary-fixed font-headline font-bold text-4xl opacity-50">02</div>
                  <div>
                    <h4 className="font-bold text-lg">Oath</h4>
                    <p className="text-white/70">A formal oath is taken to uphold democratic values.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-tertiary-fixed font-headline font-bold text-4xl opacity-50">03</div>
                  <div>
                    <h4 className="font-bold text-lg">Speech</h4>
                    <p className="text-white/70">Participants deliver individual speeches.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-tertiary-fixed font-headline font-bold text-4xl opacity-50">04</div>
                  <div>
                    <h4 className="font-bold text-lg">Debate</h4>
                    <p className="text-white/70">Formal parliamentary-style debate begins.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
