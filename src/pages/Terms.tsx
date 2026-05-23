import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Terms = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen flex flex-col">
      <Navbar />

      <main className="pt-20 pb-16 flex-grow">
        <section className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-black font-headline text-primary mb-8 text-center tracking-tight">
            Terms & <span className="text-secondary">Conditions</span>
          </h1>
          
          <div className="bg-surface-container-low p-6 md:p-8 rounded-2xl space-y-6 text-on-surface-variant leading-relaxed text-sm shadow-[0_12px_30px_-15px_rgba(0,0,0,0.05)]">
            <div>
              <h2 className="text-base font-black font-headline text-primary mb-3 uppercase tracking-tight">1. Introduction</h2>
              <p>These Terms and Conditions govern your participation in The Young Indians Parliament (“the Event”), organized by CII Yi (“the Organizer”). By registering for or attending the Event, you agree to these Terms and Conditions.</p>
            </div>

            <div>
              <h2 className="text-base font-black font-headline text-primary mb-3 uppercase tracking-tight">2. Participation</h2>
              <p>Participation in the Event is subject to registration, acceptance of these Terms and Conditions, and compliance with any instructions or requirements set forth by the Organizer.</p>
            </div>

            <div>
              <h2 className="text-base font-black font-headline text-primary mb-3 uppercase tracking-tight">3. Consent for Use</h2>
              <div className="space-y-4">
                <p><strong>3.1.</strong> As a participant, you hereby grant the Organizer, its affiliates, and agents, the right and permission to record, use, publish, stream, sell, and distribute (a) your image, likeness, and voice, and (b) any photographs, video footage, recordings, or other materials taken or collected during the Event, in which you may be included in whole or in part, in any manner or media now known or hereafter devised, for any lawful purpose, including for promotional, marketing, or educational purposes.</p>
                <p><strong>3.2.</strong> This consent includes the use of your name, image, likeness, and voice in connection with the Event and the activities of the Organizer without any compensation to you. All such recordings, whether electronic, digital, or analog, shall be the sole property of the Organizer.</p>
                <p><strong>3.3.</strong> You acknowledge and agree that you shall have no right, title, or interest in any of the recordings, photographs, or materials, notwithstanding their use by the Organizer.</p>
                <p><strong>3.4.</strong> The Organizer reserves the right to use any photographs, video, or audio recordings taken at the Event, without the expressed written permission of those included within the photograph or recording. The Organizer may use the material in publications or other media material produced, used, or contracted by the Organizer, including but not limited to: brochures, invitations, books, newspapers, magazines, television, websites, etc.</p>
              </div>
            </div>

            <div>
              <h2 className="text-base font-black font-headline text-primary mb-3 uppercase tracking-tight">4. Data Protection</h2>
              <p>The personal information provided to the Organizer by you will be used in accordance with applicable data protection laws and the Organizer’s Privacy Policy. By agreeing to these Terms and Conditions, you consent to this use.</p>
            </div>

            <div>
              <h2 className="text-base font-black font-headline text-primary mb-3 uppercase tracking-tight">5. General</h2>
              <p><strong>5.1.</strong> The Organizer reserves the right to make changes to the Event, including dates, times, and venues, without prior notice.</p>
              <p><strong>5.2.</strong> The Organizer shall not be liable for any loss, damage, or inconvenience caused as a result of such changes.</p>
            </div>

            <div className="pt-6 border-t border-outline-variant/30">
              <h2 className="text-base font-black font-headline text-primary mb-3 uppercase tracking-tight">6. Acknowledgment</h2>
              <p>By registering for the Event, you acknowledge that you have read and understood these Terms and Conditions and agree to be bound by them. You represent and warrant that you have the legal capacity to enter into this agreement.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
