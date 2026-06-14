import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Sessions = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16">
        {/* Journey Section */}
        <section className="max-w-6xl mx-auto px-6 mb-16 relative">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold text-primary mb-4">
              The Assembly Journey: <br/>
              <span className="text-secondary-container">Classrooms to National Stage.</span>
            </h1>
            <p className="text-base text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              The Assembly journey mirrors Yi's leadership pathway — from awareness to action to advocacy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-surface-container-highest -translate-y-1/2 -z-10"></div>
            
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-outline-variant/15 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-md shadow-primary/20">
                <span className="material-symbols-outlined text-white text-2xl">location_city</span>
              </div>
              <h3 className="text-lg font-headline font-bold text-primary mb-2">City Rounds</h3>
              <p className="font-bold text-xs text-secondary-container uppercase mb-2">Where the Journey Begins</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Students experience democracy for the first time through guided parliamentary simulations, focusing on democratic roles, procedures, and constructive dialogue.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-outline-variant/15 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4 shadow-md shadow-secondary/20">
                <span className="material-symbols-outlined text-white text-2xl">map</span>
              </div>
              <h3 className="text-lg font-headline font-bold text-primary mb-2">Regional Rounds</h3>
              <p className="font-bold text-xs text-secondary-container uppercase mb-2">Where Thinking Deepens</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Shortlisted students participate in immersive two-day simulations emphasizing procedure, accountability, policy depth, and committee deliberations.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-outline-variant/15 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-tertiary rounded-xl flex items-center justify-center mb-4 shadow-md shadow-tertiary/20">
                <span className="material-symbols-outlined text-white text-2xl">account_balance</span>
              </div>
              <h3 className="text-lg font-headline font-bold text-primary mb-2">National Rounds</h3>
              <p className="font-bold text-xs text-secondary-container uppercase mb-2">Where Leadership Emerges</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Top students represent their regions at The Grand Assembly in New Delhi, engaging in advanced parliamentary simulations and interacting with national leaders.
              </p>
            </div>
          </div>
        </section>

        {/* Expectation Section */}
        <section className="bg-surface-container-lowest py-16 rounded-[2rem] mx-6 shadow-xl">
          <div className="max-w-6xl mx-auto px-8">
            <div className="grid md:grid-cols-2 gap-10 items-start">
              <div className="md:sticky md:top-32">
                <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary mb-4 tracking-tight">What to expect <br/>at The Assembly</h2>
                <p className="text-sm md:text-base text-on-surface-variant leading-relaxed mb-6">
                  Each round of The Assembly 2026 offers a truly immersive experience, where students step into the roles of parliamentarians and simulate real parliamentary procedures over two days.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30">
                    <span className="material-symbols-outlined text-primary text-2xl mb-2 block">groups</span>
                    <h4 className="font-bold text-sm mb-1">Networking</h4>
                    <p className="text-xs text-on-surface-variant">Exchange ideas with diverse perspectives.</p>
                  </div>
                  <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30">
                    <span className="material-symbols-outlined text-secondary-container text-2xl mb-2 block">psychology</span>
                    <h4 className="font-bold text-sm mb-1">Learning</h4>
                    <p className="text-xs text-on-surface-variant">Master parliamentary procedures and public speaking.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {/* Day 1 */}
                <div className="relative pl-8 border-l-2 border-primary-fixed">
                  <div className="absolute top-0 left-[-13px] w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">1</div>
                  <h3 className="text-xl font-headline font-bold text-primary mb-4">Day 01: Foundations</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="flex items-center gap-1.5 font-bold text-base mb-1.5 text-secondary-container">
                        <span className="material-symbols-outlined text-lg">wb_sunny</span> Morning Session
                      </h4>
                      <ul className="space-y-2 text-xs text-on-surface-variant pl-5 list-disc marker:text-primary">
                        <li><strong>Registration:</strong> Participants check in and receive their delegate kits.</li>
                        <li><strong>Inauguration Ceremony:</strong> Orientation, formal <strong>Oath/Affirmation</strong>, and address by guest.</li>
                        <li><strong>Structure Formation:</strong> Parties form with manifests and logos; key <strong>Elected Positions</strong> assigned.</li>
                        <li><strong>Manifesto Speeches:</strong> Speeches outlining views on the central agenda.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="flex items-center gap-1.5 font-bold text-base mb-1.5 text-secondary-container">
                        <span className="material-symbols-outlined text-lg">wb_twilight</span> Afternoon Session
                      </h4>
                      <ul className="space-y-2 text-xs text-on-surface-variant pl-5 list-disc marker:text-primary">
                        <li><strong>Speech Continuations:</strong> Expanding on party agendas and specific central topics.</li>
                        <li><strong>Committee Mapping:</strong> Students break into specialized committees to plan strategies for upcoming debates.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Day 2 */}
                <div className="relative pl-8 border-l-2 border-primary-fixed">
                  <div className="absolute top-0 left-[-13px] w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">2</div>
                  <h3 className="text-xl font-headline font-bold text-primary mb-4">Day 02: Deliberation</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="flex items-center gap-1.5 font-bold text-base mb-1.5 text-secondary-container">
                        <span className="material-symbols-outlined text-lg">wb_sunny</span> Morning Session
                      </h4>
                      <ul className="space-y-2 text-xs text-on-surface-variant pl-5 list-disc marker:text-primary">
                        <li><strong>Question/Zero Hour:</strong> Dynamic, real-time debates showcasing quick-thinking and speaking.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="flex items-center gap-1.5 font-bold text-base mb-1.5 text-secondary-container">
                        <span className="material-symbols-outlined text-lg">wb_twilight</span> Afternoon Session
                      </h4>
                      <ul className="space-y-2 text-xs text-on-surface-variant pl-5 list-disc marker:text-primary">
                        <li><strong>Final Debates:</strong> Intense deliberation and presentation of final positions.</li>
                        <li><strong>Closing & Valedictory:</strong> Announcement of awards and recognition of efforts.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roles & Aim */}
        <section className="py-16 max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-primary text-white rounded-2xl shadow-lg">
              <h3 className="text-lg font-headline font-bold mb-4 text-white">Leadership Roles</h3>
              <p className="text-xs text-white/90 leading-relaxed mb-4">
                Students will select leaders among themselves, reflecting the actual hierarchy of the house:
              </p>
              <div className="flex flex-wrap gap-2">
                {['Speaker', 'Deputy Speaker', 'Leader of the House', 'Leader of the Opposition'].map(role => (
                  <span key={role} className="px-3 py-1.5 bg-white/10 rounded-lg border border-white/20 text-xs font-bold tracking-tight text-white">{role}</span>
                ))}
              </div>
            </div>
            <div className="p-6 bg-surface-container-high rounded-2xl shadow-inner text-on-surface">
              <h3 className="text-lg font-headline font-bold mb-4">Aim of The Assembly</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
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
