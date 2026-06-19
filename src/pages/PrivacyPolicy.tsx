import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen flex flex-col">
      <Navbar />

      <main className="pt-20 pb-16 flex-grow">
        <section className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-black font-headline text-primary mb-2 text-center tracking-tight">
            Privacy <span className="text-secondary">Policy</span>
          </h1>
          <p className="text-center text-xs text-on-surface-variant font-medium mb-8">
            In compliance with the Digital Personal Data Protection Act, 2023 (India) · Last updated June 2026
          </p>

          <div className="bg-surface-container-low p-6 md:p-8 rounded-2xl space-y-8 text-on-surface-variant leading-relaxed text-sm shadow-[0_12px_30px_-15px_rgba(0,0,0,0.05)]">

            {/* Who we are */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">1. Who We Are</h2>
              <p>
                Young Indians Parliament Hub ("YIP", "we", "us") is operated by Young Indians (Yi), a wing of the
                Confederation of Indian Industry (CII). This platform is used exclusively to run parliamentary
                simulation events for students across India. Yi acts as the <strong>Data Fiduciary</strong> under
                the Digital Personal Data Protection Act, 2023.
              </p>
            </section>

            {/* What we collect */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">2. Personal Data We Collect</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high text-on-surface font-black">
                      <th className="text-left p-3 rounded-tl-lg">Data</th>
                      <th className="text-left p-3">Required?</th>
                      <th className="text-left p-3 rounded-tr-lg">Why we collect it</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {[
                      ['Full name', 'Yes', 'To identify the delegate in session records and the leaderboard'],
                      ['School name', 'Yes', 'To group delegates by institution for the event'],
                      ['City and state', 'Yes', 'To assign the constituency for the parliamentary simulation'],
                      ['Email address', 'No', 'To send login credentials; synthetic address used if not provided'],
                      ['Phone number', 'No', 'Optional contact detail; not used for marketing'],
                      ['Profile photo', 'No', 'Displayed on the delegate card and leaderboard'],
                      ['Party logo', 'No', 'Displayed alongside the delegate\'s party affiliation'],
                      ['Poll votes', 'Yes (during session)', 'To run live voting in the parliamentary simulation'],
                      ['Civic Wall posts and chat messages', 'No', 'Created voluntarily by the delegate during the event'],
                      ['Speech and jury scores', 'Yes', 'Core evaluation data for the parliamentary simulation'],
                      ['Uploaded documents', 'No', 'Optional submissions by the delegate'],
                    ].map(([data, req, why]) => (
                      <tr key={data} className="hover:bg-surface-container-lowest/50">
                        <td className="p-3 font-semibold text-on-surface">{data}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${req === 'Yes' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                            {req}
                          </span>
                        </td>
                        <td className="p-3">{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Children's data */}
            <section className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="text-base font-black text-amber-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">child_care</span>
                3. Children's Data (Section 9, DPDP Act 2023)
              </h2>
              <p className="text-amber-900">
                YIP events are designed for students, many of whom are under 18. Under Section 9 of the DPDP Act,
                the personal data of a child may only be processed after obtaining <strong>verifiable parental or
                guardian consent</strong>.
              </p>
              <p className="text-amber-900">
                <strong>How we obtain it:</strong> Event organisers (schools and Yi chapter coordinators) collect
                signed parental consent forms from the parents or guardians of all participating minors before the
                event. By importing or registering a student below 18, the organiser confirms that this consent
                has been obtained and is held on record.
              </p>
              <p className="text-amber-900">
                YIP does <strong>not</strong> engage in behavioural monitoring, profiling, or targeted advertising
                of children. Data collected is used exclusively to run the parliamentary simulation.
              </p>
            </section>

            {/* Purpose and legal basis */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">4. Purpose and Legal Basis</h2>
              <p>
                We process personal data solely to operate the YIP parliamentary simulation: assigning delegates
                to constituencies and parties, running live sessions (polls, debates, questions), scoring
                performance, and generating leaderboards. We do not use participant data for advertising,
                marketing campaigns, or any purpose unrelated to the event.
              </p>
            </section>

            {/* Retention */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">5. Data Retention</h2>
              <p>
                Personal data (name, email, phone, photo, posts) is retained for <strong>6 months after the
                event end date</strong> and then permanently deleted or anonymised. Anonymised aggregate scores
                and leaderboard records may be retained for historical reporting without any personally
                identifiable information.
              </p>
              <p>
                You may request earlier deletion at any time — see Section 7 below.
              </p>
            </section>

            {/* Security */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">6. Security</h2>
              <p>
                We implement reasonable technical and organisational safeguards including row-level security
                policies, encrypted storage, and role-based access controls. Event data is isolated per event
                so no student can access another event's data. In the event of a personal data breach, we will
                notify affected individuals and the Data Protection Board of India as required by law.
              </p>
            </section>

            {/* Your rights */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">7. Your Rights as a Data Principal</h2>
              <p>Under the DPDP Act 2023, you (or your parent/guardian if you are a minor) have the right to:</p>
              <ul className="space-y-2 ml-4">
                {[
                  ['Access', 'Request a copy of the personal data we hold about you.'],
                  ['Correction', 'Ask us to correct inaccurate or incomplete data.'],
                  ['Erasure', 'Request deletion of your personal data. We will action this within 30 days unless a legal obligation requires retention.'],
                  ['Grievance redressal', 'Raise a complaint about how your data is handled.'],
                  ['Withdraw consent', 'Withdraw your consent at any time. Withdrawal will not affect processing that has already taken place.'],
                ].map(([right, desc]) => (
                  <li key={right} className="flex gap-2">
                    <span className="material-symbols-outlined text-primary text-[16px] mt-0.5 shrink-0">check_circle</span>
                    <span><strong>{right}:</strong> {desc}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-2">
                <p className="font-bold text-on-surface text-xs mb-1">To exercise any of these rights:</p>
                <p className="text-xs">
                  Email <a href="mailto:privacy@yi.org.in" className="text-primary underline font-bold">privacy@yi.org.in</a> with
                  the subject line <em>"DPDP Data Request — [Your Name]"</em> and include the event name and city.
                  We will respond within 30 days.
                </p>
              </div>
            </section>

            {/* Grievance officer */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">8. Grievance Officer</h2>
              <p>
                In accordance with Section 13 of the DPDP Act, you may raise data protection grievances with:
              </p>
              <div className="bg-surface-container-lowest rounded-xl p-4 text-xs font-semibold space-y-1">
                <p>Yi National Secretariat — Data Grievance Officer</p>
                <p>Email: <a href="mailto:privacy@yi.org.in" className="text-primary underline">privacy@yi.org.in</a></p>
                <p>Confederation of Indian Industry, The Mantosh Sondhi Centre,</p>
                <p>23, Institutional Area, Lodi Road, New Delhi – 110 003</p>
              </div>
            </section>

            {/* Third parties */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">9. Third-Party Processors</h2>
              <p>
                We use Supabase (a cloud database and authentication service) to store and process your data.
                Supabase is our data processor and operates under a Data Processing Agreement. Your data is
                stored in servers located in the Asia-Pacific region. We do not share your data with any other
                third party without your explicit consent.
              </p>
            </section>

            {/* Changes */}
            <section className="space-y-3">
              <h2 className="text-base font-black text-on-surface">10. Changes to This Policy</h2>
              <p>
                We may update this policy as the DPDP Act rules are finalised by the Government of India. The
                date at the top of this page reflects the most recent update. Continued use of the platform after
                changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <div className="pt-4 border-t border-outline-variant/30 text-xs opacity-60 font-semibold flex items-center justify-between flex-wrap gap-3">
              <p>Young Indians Parliament Hub · Yi, a wing of CII · New Delhi, India</p>
              <Link to="/terms" className="text-primary hover:underline">Terms of Service →</Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
