import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const FAQ = () => {
  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Navbar />

      <main className="pt-32 pb-24">
        <section className="max-w-4xl mx-auto px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-headline font-extrabold text-primary mb-6 underline decoration-secondary-container decoration-4 underline-offset-8">
              FAQ & Resources
            </h1>
            <p className="text-xl text-on-surface-variant leading-relaxed">
              Find answers, guidelines, and preparation materials for the Young Indians Parliament.
            </p>
          </div>
          
          <div className="space-y-12">
            
            {/* School Registration */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 space-y-6">
              <h2 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl">domain</span>
                School Registration
              </h2>
              <div className="text-lg font-semibold text-secondary-container italic">“Begin the Journey to Empowerment”</div>
              <p className="text-on-surface-variant leading-relaxed">
                Schools play a pivotal role in the Young Indians Parliament by nominating the brightest minds to participate in this prestigious event. There is no participation limit. Please note each parliament session will select the best 200 -250 students from the pool of nominations received.
              </p>
              <p className="text-on-surface-variant leading-relaxed font-semibold">
                Start here to register your school and unlock a world of debate, deliberation, and empowerment for your students.
              </p>
              <div className="pt-4 space-y-4">
                <h3 className="font-bold text-lg">Step-by-Step Guide:</h3>
                <ol className="list-decimal list-outside ml-5 space-y-3 text-on-surface-variant">
                  <li><strong>Visit the Registration Portal:</strong> Access our centralized registration platform at [yischoolhub.org] to begin the process.</li>
                  <li><strong>Submit School Details:</strong> Provide essential information about your school, including name, location, and contact details.</li>
                  <li><strong>Await Verification:</strong> Our team will review your submission and confirm. You will receive a confirmation email once vetted.</li>
                  <li><strong>Nominate Students:</strong> After confirmation, nominate students to represent your school at The Assembly. Share the Student Parliamentarian Nomination Paper with eligible candidates.</li>
                  <li><strong>Confirmation:</strong> Once student nominations are submitted, the team of reviewers will judge and vote on the top candidates. They will select the top 200 - 250 for each session.</li>
                  <li><strong>Preparations:</strong> Once students are shortlisted they will receive further instructions and resources to prepare your team for the event.</li>
                </ol>
              </div>
            </div>

            {/* Student Nomination */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 space-y-6">
              <h2 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl">person_add</span>
                Student Nomination
              </h2>
              <div className="text-lg font-semibold text-secondary-container italic">“Step Into the Role of a Parliamentarian”</div>
              <p className="text-on-surface-variant leading-relaxed">
                Individual brilliance sparks change. If you’re a student eager to make your voice heard on national and international platforms, start your journey with The Assembly here. Nominate yourself and prepare to debate, deliberate, and empower.
              </p>
              <div className="pt-4 space-y-4">
                <h3 className="font-bold text-lg">Nomination Process:</h3>
                <ol className="list-decimal list-outside ml-5 space-y-3 text-on-surface-variant">
                  <li><strong>Self-Nomination:</strong> After your school registers, use the link provided to access the Student Parliamentarian Nomination Paper.</li>
                  <li><strong>Prepare Your Submission:</strong> Reflect on the topics provided and prepare your campaign pitch. You may choose to submit a written piece (200-250 words) in addition you may choose to submit a video (no longer than 2 minutes).</li>
                  <li><strong>Submit Your Nomination:</strong> Complete the online form, attaching your campaign pitch and any other requested documents.</li>
                  <li><strong>Review and Selection:</strong> Our panel will review nominations and select participants based on their vision, leadership qualities, and campaign pitch effectiveness.</li>
                  <li><strong>Notification:</strong> Selected students and schools will be informed via Email and WhatsApp, along with further instructions for participation.</li>
                </ol>
              </div>
            </div>

            {/* Participation Fees */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 space-y-6">
              <h2 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl">payments</span>
                Participation Fees
              </h2>
              <h3 className="text-xl font-bold text-on-surface">Registration Fees and Inclusions</h3>
              <p className="text-on-surface-variant leading-relaxed">
                <strong>Overview:</strong> A nominal fee of Rs 2500/- is required upon selection for The Assembly. This fee covers:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 text-on-surface-variant">
                <li>Delegate kit with materials for the event</li>
                <li>Lunch and snacks on both days of the event</li>
                <li>Certificate of participation</li>
                <li>A chance to win awards and recognition on a national stage</li>
              </ul>
              <div className="pt-4 p-6 bg-surface-container-low rounded-2xl border border-outline-variant/20">
                <h4 className="font-bold mb-2">Payment Instructions:</h4>
                <p className="text-on-surface-variant text-sm border-l-4 border-secondary-container pl-4">
                  Selected participants will receive detailed instructions on how to complete the fee payment securely. Ensure timely payment to confirm your spot at The Assembly.
                </p>
              </div>
            </div>

            {/* Model Parliament Resources */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-outline-variant/15 space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
                  <span className="material-symbols-outlined text-4xl">local_library</span>
                  Model Parliament Resources
                </h2>
                <p className="text-on-surface-variant leading-relaxed">
                  Here, we’ve compiled a comprehensive selection of resources designed to support students as they prepare to participate in the model parliament event. This page offers an array of tools and information tailored to deepen your understanding of the parliamentary system in India, enhance your research skills, and refine your public speaking and debating abilities.
                </p>
                <p className="text-on-surface-variant leading-relaxed">
                  These resources are specifically chosen to help you build a strong foundation for your arguments, understand the dynamics of legislative debates, and present your ideas confidently. Whether you are a novice speaker or an experienced debater, these tools will empower you to excel in your role during the event and beyond. Explore, learn, and prepare to make a significant impact at the Model Parliament!
                </p>
              </div>

              {/* Preparation Guidelines */}
              <div className="pt-6 border-t border-outline-variant/30 space-y-6">
                <h3 className="text-2xl font-headline font-bold text-primary">Preparation Guidelines</h3>
                
                <div className="space-y-4">
                  <h4 className="text-xl font-bold text-secondary-container">Public Speaking Tips:</h4>
                  <ul className="space-y-3 text-on-surface-variant ml-2">
                    <li><strong className="text-on-surface block">Know Your Audience:</strong> Understand the background and expectations of your audience to tailor your speech to engage them effectively.</li>
                    <li><strong className="text-on-surface block">Structure Your Speech:</strong> Begin with a strong opening to grab attention, followed by the body where you present your main points clearly, and conclude with a memorable closing statement.</li>
                    <li><strong className="text-on-surface block">Practice Delivery:</strong> Rehearse your speech multiple times. Focus on your pace, tone, and clarity. Practising in front of a mirror or recording yourself can help refine your delivery.</li>
                    <li><strong className="text-on-surface block">Manage Nerves:</strong> Combat nervousness with deep breathing exercises before speaking. Familiarise yourself with the venue and equipment beforehand to feel more comfortable.</li>
                    <li><strong className="text-on-surface block">Engage with the Audience:</strong> Make eye contact, ask rhetorical questions, and use gestures to maintain the audience’s interest and make your presentation more dynamic.</li>
                  </ul>
                </div>

                <div className="space-y-4 pt-4">
                  <h4 className="text-xl font-bold text-secondary-container">Researching Topics:</h4>
                  <ul className="space-y-3 text-on-surface-variant ml-2">
                    <li><strong className="text-on-surface block">Start Early:</strong> Begin your research early to have ample time to understand the topic thoroughly and gather a variety of perspectives.</li>
                    <li><strong className="text-on-surface block">Use Credible Sources:</strong> Rely on reputable sources such as academic journals, official reports, and trusted news outlets to gather information.</li>
                    <li><strong className="text-on-surface block">Take Detailed Notes:</strong> Organise your notes clearly and cite your sources accurately to refer back to them during your preparation and speech.</li>
                    <li><strong className="text-on-surface block">Develop a Thesis:</strong> Define a clear thesis statement or argument around which you can structure your speech and research.</li>
                    <li><strong className="text-on-surface block">Prepare for Counterarguments:</strong> Anticipate opposing viewpoints and prepare reasoned responses to strengthen your position during debates.</li>
                  </ul>
                </div>

                <div className="space-y-4 pt-4">
                  <h4 className="text-xl font-bold text-secondary-container">Engaging in Debates:</h4>
                  <ul className="space-y-3 text-on-surface-variant ml-2">
                    <li><strong className="text-on-surface block">Understand the Format:</strong> Familiarise yourself with the debate format, rules, and procedures to navigate the session confidently.</li>
                    <li><strong className="text-on-surface block">Listen Actively:</strong> Pay close attention to your opponents’ arguments to effectively counter them and also to adapt your points as the debate progresses.</li>
                    <li><strong className="text-on-surface block">Assertiveness:</strong> Be confident and assertive in your delivery. Make your points clearly and concisely without dominating the discussion.</li>
                    <li><strong className="text-on-surface block">Respect Opponents:</strong> Treat your opponents with respect, even in disagreement. Focus on criticising ideas, not individuals.</li>
                    <li><strong className="text-on-surface block">Use Examples and Evidence:</strong> Support your arguments with specific examples and empirical evidence, which can make your position more convincing.</li>
                  </ul>
                </div>
              </div>

              {/* Useful Links */}
              <div className="pt-6 border-t border-outline-variant/30 space-y-6">
                <h3 className="text-2xl font-headline font-bold text-primary">External Resources</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant/20 hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-lg text-primary mb-2">PRS Legislative Research</h4>
                    <p className="text-sm text-on-surface-variant mb-4">Provides comprehensive and detailed updates on the workings of the Indian Parliament and state legislatures.</p>
                    <a href="https://prsindia.org/" target="_blank" rel="noreferrer" className="text-sm font-bold text-secondary-container hover:underline">Visit prsindia.org →</a>
                  </div>
                  
                  <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant/20 hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-lg text-primary mb-2">Ministry of Parliamentary Affairs</h4>
                    <p className="text-sm text-on-surface-variant mb-4">Offers resources and information on the procedures, functions, and committees of the Indian Parliament.</p>
                    <a href="https://mpa.gov.in/" target="_blank" rel="noreferrer" className="text-sm font-bold text-secondary-container hover:underline">Visit mpa.gov.in →</a>
                  </div>

                  <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant/20 hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-lg text-primary mb-2">Youth Parliament Program</h4>
                    <p className="text-sm text-on-surface-variant mb-4">An initiative by the Government of India to familiarise students with the process and functioning of parliamentary democracy.</p>
                    <a href="https://nyps.mpa.gov.in/" target="_blank" rel="noreferrer" className="text-sm font-bold text-secondary-container hover:underline">Visit nyps.mpa.gov.in →</a>
                  </div>

                  <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant/20 hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-lg text-primary mb-2">Shodhganga</h4>
                    <p className="text-sm text-on-surface-variant mb-4">A reservoir of Indian theses and scholarly content.</p>
                    <a href="https://shodhganga.inflibnet.ac.in/" target="_blank" rel="noreferrer" className="text-sm font-bold text-secondary-container hover:underline">Visit Shodhganga →</a>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-surface-container-highest rounded-2xl">
                  <h4 className="font-bold text-lg mb-3">News and Current Affairs</h4>
                  <div className="space-y-4 text-on-surface-variant text-sm">
                    <p><strong className="text-on-surface">The Hindu:</strong> Renowned for its thorough and detailed coverage of Indian politics, policy, and current affairs.</p>
                    <p><strong className="text-on-surface">The Indian Express:</strong> Provides extensive news coverage, especially useful for understanding national issues and debates.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
