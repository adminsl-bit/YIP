import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen flex flex-col">
      <Navbar />

      <main className="pt-20 pb-16 flex-grow">
        <section className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-black font-headline text-primary mb-8 text-center tracking-tight">
            Privacy <span className="text-secondary">Policy</span>
          </h1>
          
          <div className="bg-surface-container-low p-6 md:p-8 rounded-2xl space-y-6 text-on-surface-variant leading-relaxed text-sm shadow-[0_12px_30px_-15px_rgba(0,0,0,0.05)]">
            <p className="text-base font-bold text-on-surface mb-6">
              Any information you provide while visiting the www.cii.in website will be used only by the Confederation of Indian Industry (CII).
            </p>
            
            <p>
              CII will not share your information with any other organization, including its business partners unless you explicitly agree.
            </p>
            
            <div className="p-5 bg-surface-container-lowest rounded-xl text-on-surface-variant font-medium text-sm">
              This website may contain links to third-party websites. CII is not responsible for the privacy practices of any linked site or any link contained in a linked site.
            </div>

            <div className="pt-6 border-t border-outline-variant/30 text-xs opacity-60 font-semibold">
              <p>For more details or queries regarding your data protection, please contact the Yi National Secretariat.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
