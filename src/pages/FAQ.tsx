import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

const FAQ = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen selection:bg-primary-container selection:text-on-primary-container flex flex-col">
      <Navbar />

      <main className="pt-24 pb-16 flex-grow">
        <section className="max-w-4xl mx-auto px-6">
          <header className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-secondary/10 text-secondary font-black text-xs mb-4 uppercase tracking-[0.3em] shadow-sm">
                Resources & Support
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl text-primary mb-6 leading-[1.1] font-headline font-black tracking-tighter uppercase">
                FAQ & <span className="text-secondary">Guidelines</span>
              </h1>
              <p className="text-sm text-on-surface-variant leading-relaxed max-w-xl mx-auto opacity-85 font-medium">
                Find comprehensive answers, official guidelines, and essential preparation materials for the Young Indians Parliament.
              </p>
            </motion.div>
          </header>
          
          <div className="space-y-6">
            
            {/* School Registration */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_10px_25px_-15px_rgba(0,0,0,0.05)] space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary-fixed text-primary rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-primary/10">
                  <span className="material-symbols-outlined text-base">domain</span>
                </div>
                <h2 className="text-lg font-black font-headline text-primary">School Registration</h2>
              </div>
              <div className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-80">“Begin the Journey to Empowerment”</div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Schools nominate students for The Assembly. While there's no nomination limit, each session selects the best <span className="font-bold text-primary">200–250 students</span> from the pool.
              </p>
              
              <div className="p-5 bg-surface-container-low rounded-xl space-y-3">
                <h3 className="font-black text-xs uppercase tracking-wider text-primary">Step-by-Step Guide:</h3>
                <ol className="space-y-2.5 text-xs text-on-surface-variant">
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">01.</span>
                    <span><strong>Portal Access:</strong> Register your school at [yischoolhub.org].</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">02.</span>
                    <span><strong>Submission:</strong> Provide essential school details and contact info.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">03.</span>
                    <span><strong>Verification:</strong> Receive confirmation once your institution is vetted.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">04.</span>
                    <span><strong>Nomination:</strong> After verification, nominate students via the official Nomination Paper.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">05.</span>
                    <span><strong>Review:</strong> A panel selects the top candidates for the upcoming session.</span>
                  </li>
                </ol>
              </div>
            </motion.div>

            {/* Student Nomination */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_10px_25px_-15px_rgba(0,0,0,0.05)] space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-base">person_add</span>
                </div>
                <h2 className="text-lg font-black font-headline text-primary">Student Nomination</h2>
              </div>
              <div className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-80">“Step Into the Role of a Parliamentarian”</div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Individual brilliance sparks change. Eager students can start their journey by nominating themselves and preparing for high-stakes debate.
              </p>
              
              <div className="p-5 bg-surface-container-low rounded-xl space-y-3">
                <h3 className="font-black text-xs uppercase tracking-wider text-primary">Process Overview:</h3>
                <ol className="space-y-2.5 text-xs text-on-surface-variant">
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">01.</span>
                    <span><strong>Self-Nomination:</strong> Access the form after your school registration.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">02.</span>
                    <span><strong>Campaign Pitch:</strong> Prepare a written piece (200-250 words) or a video (max 2 mins).</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">03.</span>
                    <span><strong>Review:</strong> Selection is based on vision, leadership, and pitch effectiveness.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-secondary">04.</span>
                    <span><strong>Notification:</strong> Selected candidates are informed via Email and WhatsApp.</span>
                  </li>
                </ol>
              </div>
            </motion.div>

            {/* Participation Fees */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_10px_25px_-15px_rgba(0,0,0,0.05)] space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-tertiary-fixed text-tertiary rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-base">payments</span>
                </div>
                <h2 className="text-lg font-black font-headline text-primary">Participation Fees</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-on-surface">Fees & Inclusions</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    A nominal fee of <span className="text-primary font-bold">₹2500/-</span> is required upon selection, covering the delegate kit, snacks, certificates, and entry for awards.
                  </p>
                </div>
                <div className="p-4 bg-secondary/5 rounded-xl border border-secondary/10">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-secondary mb-1.5">Payment Instructions</h4>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Selected participants will receive secure payment instructions. Timely payment confirms your spot.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Resources Section */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_10px_25px_-15px_rgba(0,0,0,0.05)] space-y-6"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary-fixed text-primary rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">local_library</span>
                </div>
                <h2 className="text-lg font-black font-headline text-primary">Parliament Resources</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "Public Speaking", icon: "campaign", content: "Focus on pace, tone, and audience engagement." },
                  { title: "Researching", icon: "search_insights", content: "Use credible sources and prepare for counterarguments." },
                  { title: "Debating", icon: "forum", content: "Understand formats and treat opponents with respect." }
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-surface-container-low rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary text-base">{item.icon}</span>
                      <h4 className="text-xs font-black text-primary uppercase tracking-tight">{item.title}</h4>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{item.content}</p>
                  </div>
                ))}
              </div>

              <div className="pt-5 border-t border-outline-variant/30">
                <h3 className="text-xs font-black text-secondary uppercase tracking-widest mb-4">External Portals</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: "PRS Legislative Research", link: "https://prsindia.org/" },
                    { name: "Ministry of Parliamentary Affairs", link: "https://mpa.gov.in/" },
                    { name: "Youth Parliament Program", link: "https://nyps.mpa.gov.in/" },
                    { name: "Shodhganga Repository", link: "https://shodhganga.inflibnet.ac.in/" }
                  ].map((res, i) => (
                    <a 
                      href={res.link} 
                      key={i} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors"
                    >
                      <span className="text-xs font-bold text-primary">{res.name}</span>
                      <span className="material-symbols-outlined text-secondary text-sm">arrow_outward</span>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
