import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Disclaimer = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-16 pb-12">
        <section className="max-w-3xl mx-auto px-8">
          <h1 className="text-display-xs font-headline text-primary mb-8 text-center">
            Legal <span className="text-secondary italic">Disclaimer.</span>
          </h1>
          
          <div className="bg-surface-container-low p-6 md:p-10 rounded-2xl border border-black/5 space-y-6 text-on-surface-variant leading-relaxed text-body-md">
            <p className="text-body-lg font-bold text-on-surface mb-6">
              While every precaution has been taken in the preparation of this website and its contents, Confederation of Indian Industry (CII) assumes no responsibility for errors or omissions.
            </p>
            
            <p>
              All information and features described herein are subject to change without notice. 
            </p>
            
            <div className="p-8 bg-surface-container-lowest rounded-xl border border-black/5 space-y-4">
              <h3 className="text-headline-xs font-headline text-primary flex items-center gap-2 mb-4 italic uppercase font-black tracking-tight">
                <span className="material-symbols-outlined">link_off</span>
                Third-Party Links
              </h3>
              <p>
                This website may contain links to third-party websites. CII is not responsible for the contents of any linked site or any link contained in a linked site.
              </p>
              <p>
                This website is providing these links only as a convenience, and the inclusion of a link does not imply endorsement of the linked site by CII.
              </p>
            </div>

            <div className="pt-8 border-t border-outline-variant/30 text-sm opacity-60 italic text-center">
              Copyright © 2024 Confederation of Indian Industry (CII). All rights reserved.
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Disclaimer;
