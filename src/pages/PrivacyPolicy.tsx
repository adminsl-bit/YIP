import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-32 pb-24">
        <section className="max-w-4xl mx-auto px-8">
          <h1 className="text-4xl md:text-5xl font-headline font-extrabold text-primary mb-8 underline decoration-secondary-container decoration-4 underline-offset-8 text-center">
            Privacy Policy
          </h1>
          
          <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 space-y-8 text-on-surface-variant leading-relaxed">
            <p className="text-xl font-semibold text-on-surface">
              Any information you provide while visiting the www.cii.in website will be used only by the Confederation of Indian Industry (CII).
            </p>
            
            <p>
              CII will not share your information with any other organization, including its business partners unless you explicitly agree.
            </p>
            
            <p className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant/20 italic">
              This website may contain links to third-party websites. CII is not responsible for the privacy practices of any linked site or any link contained in a linked site.
            </p>

            <div className="pt-8 border-t border-outline-variant/30 text-sm opacity-60">
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
