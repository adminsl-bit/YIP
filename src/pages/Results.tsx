import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Results = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16">
        {/* Awards Hero Section */}
        <section className="max-w-6xl mx-auto px-6 mb-16 relative text-center">
          <div className="z-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold text-primary leading-tight -tracking-[0.03em] mb-4">
              Awards & <span className="text-secondary-container">Recognitions.</span>
            </h1>
            <div className="max-w-2xl mx-auto bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-outline-variant/10 shadow-md mb-8">
              <p className="text-lg font-headline font-italic text-primary mb-2 italic">
                “The greatest glory in living lies not in never falling, but in rising every time we fall.”
              </p>
              <p className="text-on-surface-variant text-xs font-bold">— Nelson Mandela</p>
            </div>
            <p className="text-sm text-on-surface-variant max-w-xl mx-auto leading-relaxed">
              Embark on a journey where resilience meets recognition, and every challenge is a step toward glory. The Young Indians Parliament celebrates the spirit of rising, recognizing the dedication, leadership, and excellence of participants poised to shape the future.
            </p>
          </div>
        </section>

        {/* Participation Recognition */}
        <section className="bg-white py-12">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-3 underline decoration-secondary-container decoration-4 underline-offset-4">Participation Recognition</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary text-2xl">workspace_premium</span>
                </div>
                <h3 className="text-lg font-headline font-bold text-primary">Participation Certificates</h3>
                <p className="text-on-surface-variant text-xs leading-relaxed">
                  All students who qualify for The Assembly will be awarded Participation Certificates. These certificates serve as official recognition of their involvement and efforts in the event, highlighting their commitment to engaging in parliamentary debate and discussion.
                </p>
              </div>
              <div className="space-y-3">
                <div className="w-12 h-12 bg-secondary-container/10 rounded-xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-secondary-container text-2xl">badge</span>
                </div>
                <h3 className="text-lg font-headline font-bold text-primary">Student Profiles</h3>
                <p className="text-on-surface-variant text-xs leading-relaxed">
                  In addition to the certificates, qualified students will have their profiles featured. This recognition aims to celebrate each participant’s unique contribution to The Assembly and provide them with a platform to showcase their skills, interests, and perspectives on national and international issues.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* General Awards */}
        <section className="bg-surface-container-low py-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-3 underline decoration-tertiary decoration-4 underline-offset-4">General Awards</h2>
              <p className="text-on-surface-variant text-xs">Honouring excellence in performance and contribution.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div key={award.id} className="bg-white p-5 rounded-2xl shadow border border-outline-variant/10 hover:translate-y-[-4px] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-xl">{award.icon}</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-primary/30 uppercase tracking-widest mb-0.5">Award {award.id}</div>
                      <h3 className="text-base font-headline font-bold text-primary mb-1.5 leading-tight">{award.title}</h3>
                      <p className="text-on-surface-variant text-xs leading-relaxed">{award.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Role Specific Awards */}
        <section className="bg-white py-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-3 underline decoration-primary/20 decoration-4 underline-offset-4">Awards for Specific Roles</h2>
              <p className="text-on-surface-variant text-xs">Celebrating exceptional performance in key parliamentary positions.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { id: 1, title: "Outstanding Speaker Award", desc: "For the student effectively fulfilling the Speaker's duties with leadership and procedural knowledge.", icon: "gavel" },
                { id: 2, title: "Exceptional Deputy Speaker", desc: "Honors the student capably supporting the Speaker and demonstrating readiness and adaptability.", icon: "support_agent" },
                { id: 3, title: "Best Leader of the House", desc: "Recognizes the student leading with strategic acumen, effectively representing the government's stance.", icon: "person_celebrate" },
                { id: 4, title: "Best Leader of the Opposition", desc: "Awarded to the student excelling in the role of challenging and providing checks and balances to the government.", icon: "shield" },
                { id: 5, title: "Most Persuasive Policy Advocate", desc: "Recognizes students excelling in policy advocacy with in-depth knowledge and persuasive skills.", icon: "campaign" }
              ].map((award) => (
                <div key={award.id} className="bg-surface-container-lowest p-5 rounded-2xl border-2 border-primary/5 hover:border-primary/10 transition-all">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mb-4 shadow shadow-primary/10">
                    <span className="material-symbols-outlined text-white text-2xl">{award.icon}</span>
                  </div>
                  <h3 className="text-lg font-headline font-bold text-primary mb-2 leading-tight">{award.title}</h3>
                  <p className="text-on-surface-variant text-xs leading-relaxed mb-4">{award.desc}</p>
                  <div className="inline-flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                    Role Category
                    <span className="w-6 h-[1px] bg-primary/20"></span>
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
