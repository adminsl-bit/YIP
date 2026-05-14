import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Sessions = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Journey Section */}
        <section className="max-w-7xl mx-auto px-8 mb-24 relative">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-primary mb-6">
              The Assembly Journey: <br/>
              <span className="text-secondary-container">Classrooms to National Stage.</span>
            </h1>
            <p className="text-xl text-on-surface-variant max-w-3xl mx-auto leading-relaxed">
              The Assembly journey mirrors Yi's leadership pathway — from awareness to action to advocacy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-surface-container-highest -translate-y-1/2 -z-10"></div>
            
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-white text-3xl">school</span>
              </div>
              <h3 className="text-2xl font-headline font-bold text-primary mb-4">City Rounds</h3>
              <p className="font-bold text-sm text-secondary-container uppercase mb-4">Where the Journey Begins</p>
              <p className="text-on-surface-variant leading-relaxed">
                Students experience democracy for the first time through guided parliamentary simulations, focusing on democratic roles, procedures, and constructive dialogue.
              </p>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-secondary-container rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-secondary/20">
                <span className="material-symbols-outlined text-white text-3xl">query_stats</span>
              </div>
              <h3 className="text-2xl font-headline font-bold text-primary mb-4">The Assembly</h3>
              <p className="font-bold text-sm text-secondary-container uppercase mb-4">Where Thinking Deepens</p>
              <p className="text-on-surface-variant leading-relaxed">
                Shortlisted students participate in immersive two-day simulations emphasizing procedure, accountability, policy depth, and committee deliberations.
              </p>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-tertiary-container rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-tertiary/20">
                <span className="material-symbols-outlined text-white text-3xl">account_balance</span>
              </div>
              <h3 className="text-2xl font-headline font-bold text-primary mb-4">The Grand Assembly</h3>
              <p className="font-bold text-sm text-secondary-container uppercase mb-4">Where Leadership Emerges</p>
              <p className="text-on-surface-variant leading-relaxed">
                Top students represent their regions at The Grand Assembly in New Delhi, engaging in advanced parliamentary simulations and interacting with national leaders.
              </p>
            </div>
          </div>
        </section>

        {/* Expectation Section */}
        <section className="bg-surface-container-lowest py-24 rounded-[4rem] mx-8 shadow-2xl">
          <div className="max-w-7xl mx-auto px-12">
            <div className="grid md:grid-cols-2 gap-16 items-start">
              <div className="sticky top-40">
                <h2 className="text-5xl font-headline font-bold text-primary mb-8 tracking-tight">What to expect <br/>at The Assembly</h2>
                <p className="text-xl text-on-surface-variant leading-relaxed mb-8">
                  Each round of The Assembly 2026 offers a truly immersive experience, where students step into the roles of parliamentarians and simulate real parliamentary procedures over two days.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-surface-container rounded-3xl border border-outline-variant/30">
                    <span className="material-symbols-outlined text-primary text-4xl mb-4">groups</span>
                    <h4 className="font-bold mb-2">Networking</h4>
                    <p className="text-sm text-on-surface-variant">Exchange ideas with diverse perspectives.</p>
                  </div>
                  <div className="p-6 bg-surface-container rounded-3xl border border-outline-variant/30">
                    <span className="material-symbols-outlined text-secondary-container text-4xl mb-4">psychology</span>
                    <h4 className="font-bold mb-2">Learning</h4>
                    <p className="text-sm text-on-surface-variant">Master parliamentary procedures and public speaking.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                {/* Day 1 */}
                <div className="relative pl-12 border-l-2 border-primary-fixed">
                  <div className="absolute top-0 left-[-17px] w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">1</div>
                  <h3 className="text-3xl font-headline font-bold text-primary mb-6">Day 01: Foundations</h3>
                  
                  <div className="space-y-8">
                    <div>
                      <h4 className="flex items-center gap-2 font-bold text-lg mb-2 text-secondary-container">
                        <span className="material-symbols-outlined">wb_sunny</span> Morning Session
                      </h4>
                      <ul className="space-y-4 text-on-surface-variant pl-6 list-disc marker:text-primary">
                        <li><strong>Registration:</strong> Participants check in and receive their delegate kits.</li>
                        <li><strong>Inauguration Ceremony:</strong> Featuring orientation, a formal <strong>Oath or Affirmation</strong>, and an Inspiring address by a distinguished guest.</li>
                        <li><strong>Structure Formation:</strong> Parties are formed with manifests and logos, and key <strong>Elected Positions</strong> are assigned.</li>
                        <li><strong>Manifesto Speeches:</strong> Participants deliver speeches outlining their views on the central agenda.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="flex items-center gap-2 font-bold text-lg mb-2 text-secondary-container">
                        <span className="material-symbols-outlined">wb_twilight</span> Afternoon Session
                      </h4>
                      <ul className="space-y-4 text-on-surface-variant pl-6 list-disc marker:text-primary">
                        <li><strong>Speech Continuations:</strong> Expanding on party agendas and specific central topics.</li>
                        <li><strong>Committee Mapping:</strong> Students break into specialized committees to plan strategies for upcoming debates.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Day 2 */}
                <div className="relative pl-12 border-l-2 border-primary-fixed">
                  <div className="absolute top-0 left-[-17px] w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">2</div>
                  <h3 className="text-3xl font-headline font-bold text-primary mb-6">Day 02: Deliberation</h3>
                  
                  <div className="space-y-8">
                    <div>
                      <h4 className="flex items-center gap-2 font-bold text-lg mb-2 text-secondary-container">
                        <span className="material-symbols-outlined">wb_sunny</span> Morning Session
                      </h4>
                      <ul className="space-y-4 text-on-surface-variant pl-6 list-disc marker:text-primary">
                        <li><strong>Question Hour & Zero Hour:</strong> Dynamic, real-time debates on predetermined and spontaneous topics, showcasing quick-thinking and public speaking.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="flex items-center gap-2 font-bold text-lg mb-2 text-secondary-container">
                        <span className="material-symbols-outlined">wb_twilight</span> Afternoon Session
                      </h4>
                      <ul className="space-y-4 text-on-surface-variant pl-6 list-disc marker:text-primary">
                        <li><strong>Final Debates:</strong> Intense deliberation and presentation of final positions on national issues.</li>
                        <li><strong>Closing & Valedictory:</strong> Announcement of awards and recognition of delegate efforts.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roles & Aim */}
        <section className="py-24 max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="p-10 bg-primary text-on-primary rounded-[3rem] shadow-xl">
              <h3 className="text-2xl font-headline font-bold mb-6">Leadership Roles</h3>
              <p className="text-white/80 leading-relaxed mb-6">
                Students will select leaders among themselves, reflecting the actual hierarchy of the house:
              </p>
              <div className="flex flex-wrap gap-3">
                {['Speaker', 'Deputy Speaker', 'Leader of the House', 'Leader of the Opposition'].map(role => (
                  <span key={role} className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-sm font-bold tracking-tight">{role}</span>
                ))}
              </div>
            </div>
            <div className="p-10 bg-surface-container-high rounded-[3rem] shadow-inner text-on-surface">
              <h3 className="text-2xl font-headline font-bold mb-6">Aim of The Assembly</h3>
              <p className="text-on-surface-variant leading-relaxed">
                Designed to enrich the participants' understanding of parliamentary procedures, enhance leadership skills, and foster civic responsibility. The standout participants will represent their school, state, and region at <strong>The Grand Assembly in New Delhi (November)</strong>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Sessions;
