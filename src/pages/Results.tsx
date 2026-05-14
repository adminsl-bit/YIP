import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Results = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-32 pb-24">
        {/* Awards Hero Section */}
        <section className="max-w-7xl mx-auto px-8 mb-24 relative text-center">
          <div className="z-10">
            <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-primary leading-tight -tracking-[0.03em] mb-6">
              Awards & <span className="text-secondary-container">Recognitions.</span>
            </h1>
            <div className="max-w-3xl mx-auto bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-outline-variant/10 shadow-lg mb-12">
              <p className="text-2xl font-headline font-italic text-primary mb-4 italic">
                “The greatest glory in living lies not in never falling, but in rising every time we fall.”
              </p>
              <p className="text-on-surface-variant font-bold">— Nelson Mandela</p>
            </div>
            <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              Embark on a journey where resilience meets recognition, and every challenge is a step toward glory. The Young Indians Parliament celebrates the spirit of rising, recognizing the dedication, leadership, and excellence of participants poised to shape the future.
            </p>
          </div>
        </section>

        {/* Participation Recognition */}
        <section className="bg-white py-24">
          <div className="max-w-5xl mx-auto px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-headline font-bold text-on-surface mb-4 underline decoration-secondary-container decoration-4 underline-offset-8">Participation Recognition</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary text-3xl">workspace_premium</span>
                </div>
                <h3 className="text-2xl font-headline font-bold text-primary">Participation Certificates</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  All students who qualify for The Assembly will be awarded Participation Certificates. These certificates serve as official recognition of their involvement and efforts in the event, highlighting their commitment to engaging in parliamentary debate and discussion.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-secondary-container/10 rounded-2xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-secondary-container text-3xl">badge</span>
                </div>
                <h3 className="text-2xl font-headline font-bold text-primary">Student Profiles</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  In addition to the certificates, qualified students will have their profiles featured. This recognition aims to celebrate each participant’s unique contribution to The Assembly and provide them with a platform to showcase their skills, interests, and perspectives on national and international issues.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* General Awards */}
        <section className="bg-surface-container-low py-24">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-headline font-bold text-on-surface mb-4 underline decoration-tertiary decoration-4 underline-offset-8">General Awards</h2>
              <p className="text-on-surface-variant text-lg">Honouring excellence in performance and contribution.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { id: 1, title: "Best Parliamentarian Award", desc: "Recognizes a student for outstanding overall participation, knowledge, and adherence to parliamentary protocols.", icon: "account_balance" },
                { id: 2, title: "Best Speaker Award", desc: "Honors the student with exceptional public speaking skills and persuasive communication during debates.", icon: "record_voice_over" },
                { id: 3, title: "Leadership Excellence Award", desc: "Given to a participant who demonstrates remarkable leadership qualities, initiative, and inspiration to peers.", icon: "stars" },
                { id: 4, title: "Best Debater Award", desc: "Awarded to the student excelling in debating skills, effective argumentation, and engagement in discussions.", icon: "forum" },
                { id: 5, title: "Innovative Ideas Award", desc: "Recognizes original and creative solutions to issues discussed, encouraging innovative thinking.", icon: "lightbulb" },
                { id: 6, title: "Community Impact Award", desc: "Honors a participant whose proposals have the potential for significant positive community impact.", icon: "volunteer_activism" },
                { id: 7, title: "Most Valuable Participant (MVP)", desc: "Recognizes an all-around contributor to The Assembly, highlighting participation, teamwork, and spirit.", icon: "military_tech" },
                { id: 8, title: "Team Spirit Award", desc: "Celebrates exceptional teamwork, collaboration, and support among participants.", icon: "groups" },
                { id: 9, title: "Best Research Presentation", desc: "Commends students excelling in research, insightful analysis, and presentation of their chosen topic.", icon: "search_insights" }
              ].map((award) => (
                <div key={award.id} className="bg-white p-8 rounded-3xl shadow-lg border border-outline-variant/10 hover:translate-y-[-8px] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-2xl">{award.icon}</span>
                    </div>
                    <div>
                      <div className="text-xs font-black text-primary/30 uppercase tracking-widest mb-1">Award {award.id}</div>
                      <h3 className="text-xl font-headline font-bold text-primary mb-2 leading-tight">{award.title}</h3>
                      <p className="text-on-surface-variant text-sm leading-relaxed">{award.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Role Specific Awards */}
        <section className="bg-white py-24">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-headline font-bold text-on-surface mb-4 underline decoration-primary/20 decoration-4 underline-offset-8">Awards for Specific Roles</h2>
              <p className="text-on-surface-variant text-lg">Celebrating exceptional performance in key parliamentary positions.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { id: 1, title: "Outstanding Speaker Award", desc: "For the student effectively fulfilling the Speaker's duties with leadership and procedural knowledge.", icon: "gavel" },
                { id: 2, title: "Exceptional Deputy Speaker", desc: "Honors the student capably supporting the Speaker and demonstrating readiness and adaptability.", icon: "support_agent" },
                { id: 3, title: "Best Leader of the House", desc: "Recognizes the student leading with strategic acumen, effectively representing the government's stance.", icon: "person_celebrate" },
                { id: 4, title: "Best Leader of the Opposition", desc: "Awarded to the student excelling in the role of challenging and providing checks and balances to the government.", icon: "shield" },
                { id: 5, title: "Most Persuasive Policy Advocate", desc: "Recognizes students excelling in policy advocacy with in-depth knowledge and persuasive skills.", icon: "campaign" }
              ].map((award) => (
                <div key={award.id} className="bg-surface-container-lowest p-8 rounded-[2rem] border-2 border-primary/5 hover:border-primary/20 transition-all">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
                    <span className="material-symbols-outlined text-white text-3xl">{award.icon}</span>
                  </div>
                  <h3 className="text-2xl font-headline font-bold text-primary mb-3 leading-tight">{award.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed mb-6">{award.desc}</p>
                  <div className="inline-flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                    Role Category
                    <span className="w-8 h-[1px] bg-primary/20"></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Results;
