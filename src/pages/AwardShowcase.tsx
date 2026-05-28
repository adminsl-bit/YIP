import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import jsPDF from 'jspdf';
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";

interface Awardee {
  student_id: string;
  student_name: string;
  position: string;
  party_number: number;
  constituency: string;
  state: string;
  city: string;
  photo_url?: string;
  awards: Array<{
    id: string;
    name: string;
    description?: string;
    assigned_by_jury_consensus: boolean;
  }>;
}

export const AwardShowcase = () => {
  const [awardees, setAwardees] = useState<Awardee[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAwardees();
    setupRealtimeSubscriptions();
  }, []);

  const fetchAwardees = async () => {
    try {
      const { data: studentAwardsData, error: studentAwardsError } = await supabase
        .from('student_awards')
        .select(`
          student_id,
          assigned_by_jury_consensus,
          assigned_by_organizer,
          awards (id, name, description)
        `);

      if (studentAwardsError) throw studentAwardsError;

      const studentIds = [...new Set(studentAwardsData?.map(sa => sa.student_id) || [])];

      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, constituency, state, city, photo_url')
        .in('user_id', studentIds)
        .eq('user_type', 'student');

      if (studentsError) throw studentsError;

      const awardeesMap = new Map<string, Awardee>();

      studentAwardsData?.forEach(sa => {
        const student = studentsData?.find(s => s.user_id === sa.student_id);
        if (student && sa.awards) {
          if (!awardeesMap.has(sa.student_id)) {
            awardeesMap.set(sa.student_id, {
              student_id: sa.student_id,
              student_name: student.name,
              position: student.position,
              party_number: student.party_number,
              constituency: student.constituency || '',
              state: student.state || '',
              city: student.city || '',
              photo_url: student.photo_url,
              awards: []
            });
          }

          const awardee = awardeesMap.get(sa.student_id)!;
          awardee.awards.push({
            id: (sa.awards as any).id,
            name: (sa.awards as any).name,
            description: (sa.awards as any).description,
            assigned_by_jury_consensus: sa.assigned_by_jury_consensus
          });
        }
      });

      setAwardees(Array.from(awardeesMap.values()));
    } catch (error) {
      console.error('Error fetching awardees:', error);
      toast({ title: "Error", description: "Failed to load awardees data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('award-showcase-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_awards' }, fetchAwardees)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'awards' }, fetchAwardees)
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const nextSlide = () => setCurrentIndex(prev => (prev + 1) % awardees.length);
  const previousSlide = () => setCurrentIndex(prev => (prev - 1 + awardees.length) % awardees.length);
  const goToSlide = (index: number) => setCurrentIndex(index);

  const downloadPDF = async () => {
    try {
      toast({ title: "Generating PDF", description: "Creating award showcase PDF..." });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const W = pdf.internal.pageSize.getWidth();   // 210
      const H = pdf.internal.pageSize.getHeight();  // 297
      const mg = 14; // margin
      const cW = W - mg * 2; // content width 182

      // ── Color palette ──────────────────────────────────────────
      const col = {
        primary:    [19, 41, 143]   as [number,number,number],
        primaryFg:  [255,255,255]   as [number,number,number],
        primaryMid: [48, 66, 166]   as [number,number,number],
        primaryTint:[222,224,255]   as [number,number,number],
        secondary:  [172, 53, 9]    as [number,number,number],
        peach:      [255,219,208]   as [number,number,number],
        peachDark:  [255,181,159]   as [number,number,number],
        surface:    [247,249,251]   as [number,number,number],
        surfaceLow: [242,244,246]   as [number,number,number],
        onSurface:  [25, 28, 30]    as [number,number,number],
        onVariant:  [69, 70, 83]    as [number,number,number],
        white:      [255,255,255]   as [number,number,number],
        divider:    [210,212,220]   as [number,number,number],
      };

      const fill  = (c: [number,number,number]) => pdf.setFillColor(c[0],c[1],c[2]);
      const text  = (c: [number,number,number]) => pdf.setTextColor(c[0],c[1],c[2]);
      const draw  = (c: [number,number,number]) => pdf.setDrawColor(c[0],c[1],c[2]);

      // ── Helper: top bar for every page ─────────────────────────
      const drawTopBar = (label: string) => {
        fill(col.primary);
        pdf.rect(0, 0, W, 13, 'F');
        // subtle gradient strip
        fill(col.primaryMid);
        pdf.rect(0, 11, W, 2, 'F');
        text(col.white);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text('AWARD SHOWCASE  ·  YOUNG INDIANS PARLIAMENT', mg, 8.5);
        pdf.text(label, W - mg, 8.5, { align: 'right' });
      };

      // ── Helper: footer ──────────────────────────────────────────
      const drawFooter = (pageNum: string) => {
        fill(col.surface);
        pdf.rect(0, H - 10, W, 10, 'F');
        text(col.onVariant);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(pageNum, W / 2, H - 4, { align: 'center' });
        pdf.text('Young Indians Parliament — Award Showcase', mg, H - 4);
        pdf.text(new Date().toLocaleDateString(), W - mg, H - 4, { align: 'right' });
      };

      // ══════════════════════════════════════════════════════════
      // TITLE PAGE
      // ══════════════════════════════════════════════════════════
      // Hero band
      fill(col.primary);
      pdf.rect(0, 0, W, 90, 'F');
      fill(col.primaryMid);
      pdf.rect(0, 85, W, 5, 'F');

      // Gold accent bar
      fill(col.peachDark);
      pdf.rect(mg, 30, 6, 40, 'F');

      // Title
      text(col.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(34);
      pdf.text('AWARD SHOWCASE', mg + 12, 52, {});
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Young Indians Parliament', mg + 12, 64, {});
      pdf.setFontSize(10);
      text([200, 210, 255] as [number,number,number]);
      pdf.text('Recognizing Excellence in Youth Leadership', mg + 12, 74, {});

      // Stats card
      fill(col.surfaceLow);
      pdf.roundedRect(mg, 102, cW, 38, 4, 4, 'F');
      text(col.onSurface);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(28);
      pdf.text(`${awardees.length}`, W / 2, 122, { align: 'center' });
      text(col.onVariant);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text('Awardees Recognised', W / 2, 132, { align: 'center' });

      // Date
      text(col.onVariant);
      pdf.setFontSize(9);
      pdf.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, W / 2, 155, { align: 'center' });

      // Awardee index list
      text(col.primary);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('PARTICIPANTS', mg, 170);
      draw(col.divider);
      pdf.setLineWidth(0.3);
      pdf.line(mg, 172, W - mg, 172);

      let idxY = 179;
      awardees.forEach((a, i) => {
        if (idxY > H - 18) return; // skip overflow on title page
        text(col.onSurface);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(`${i + 1}.  ${a.student_name}`, mg, idxY);
        text(col.onVariant);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(a.position, W - mg, idxY, { align: 'right' });
        draw(col.divider);
        pdf.setLineWidth(0.2);
        pdf.line(mg, idxY + 2.5, W - mg, idxY + 2.5);
        idxY += 8;
      });

      drawFooter(`Page 1 of ${awardees.length + 1}`);

      // ══════════════════════════════════════════════════════════
      // PER-AWARDEE PAGES
      // ══════════════════════════════════════════════════════════
      for (let i = 0; i < awardees.length; i++) {
        const aw = awardees[i];
        pdf.addPage();
        drawTopBar(`${i + 1} of ${awardees.length}`);

        let y = 18;

        // ── Profile card ────────────────────────────────────────
        fill(col.surfaceLow);
        pdf.roundedRect(mg, y, cW, 50, 4, 4, 'F');

        // Accent left strip
        fill(col.primary);
        pdf.roundedRect(mg, y, 4, 50, 2, 2, 'F');

        // Name
        text(col.onSurface);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.text(aw.student_name, mg + 11, y + 14);

        // Position
        text(col.onVariant);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.text(aw.position, mg + 11, y + 23);

        // Party pill
        const partyTxt = `Party ${aw.party_number}`;
        fill(col.peach);
        pdf.roundedRect(mg + 11, y + 28, 28, 7, 2, 2, 'F');
        text(col.secondary);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(partyTxt, mg + 11 + 14, y + 33, { align: 'center' });

        // Location chips
        const locParts: string[] = [];
        if (aw.city) locParts.push(aw.city);
        if (aw.constituency) locParts.push(aw.constituency);
        if (aw.state) locParts.push(aw.state);
        if (locParts.length > 0) {
          text(col.onVariant);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.text(locParts.join('  ·  '), mg + 11, y + 44);
        }

        // Awards count badge (top-right of profile card)
        fill(col.primary);
        pdf.roundedRect(W - mg - 32, y + 8, 32, 12, 3, 3, 'F');
        text(col.white);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(`${aw.awards.length} AWARD${aw.awards.length !== 1 ? 'S' : ''}`, W - mg - 16, y + 15.5, { align: 'center' });

        y += 56;

        // ── Awards heading ──────────────────────────────────────
        text(col.primary);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('AWARDS RECEIVED', mg, y);
        draw(col.primary);
        pdf.setLineWidth(0.5);
        pdf.line(mg, y + 2, mg + 38, y + 2);
        y += 8;

        // ── Award cards ─────────────────────────────────────────
        for (let j = 0; j < aw.awards.length; j++) {
          const award = aw.awards[j];
          const descLines = award.description
            ? pdf.splitTextToSize(award.description, cW - 26)
            : [];
          const descH = descLines.length * 4.5;
          const cardH = 10 + descH + (descLines.length > 0 ? 5 : 0) + 10; // icon row + desc + badge row

          // Page overflow
          if (y + cardH > H - 18) {
            drawFooter(`Page ${i + 2} of ${awardees.length + 1}`);
            pdf.addPage();
            drawTopBar(`${i + 1} of ${awardees.length} (cont.)`);
            y = 18;
          }

          // Card background
          fill(col.peach);
          pdf.roundedRect(mg, y, cW, cardH, 3, 3, 'F');

          // Icon square
          fill(col.secondary);
          pdf.roundedRect(mg + 4, y + 4, 10, 10, 2, 2, 'F');
          text(col.white);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text('★', mg + 9, y + 10.5, { align: 'center' });

          // Award name
          text(col.onSurface);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(13);
          pdf.text(award.name.toUpperCase(), mg + 17, y + 10);

          // Description
          if (descLines.length > 0) {
            text(col.onVariant);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.text(descLines, mg + 17, y + 17);
          }

          // Recognition badge
          const badgeTxt = award.assigned_by_jury_consensus ? 'AWARD RECEIVED' : 'RECOGNITION GIVEN';
          const badgeY = y + cardH - 7;
          fill(col.primaryTint);
          pdf.roundedRect(mg + 17, badgeY - 3.5, 40, 6, 2, 2, 'F');
          text(col.primary);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7);
          pdf.text(badgeTxt, mg + 37, badgeY + 0.5, { align: 'center' });

          y += cardH + 4;
        }

        drawFooter(`Page ${i + 2} of ${awardees.length + 1}`);
      }

      pdf.save('yip-award-showcase.pdf');
      toast({ title: "PDF Downloaded", description: "Award showcase PDF has been downloaded successfully!" });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen civic-mesh-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-headline font-bold text-on-surface-variant uppercase tracking-widest">Loading Awards…</p>
        </div>
      </div>
    );
  }

  if (awardees.length === 0) {
    return (
      <div className="min-h-screen civic-mesh-bg flex items-center justify-center px-4">
        <div className="bg-surface-container-lowest rounded-[2rem] p-12 text-center max-w-sm shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)]">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary/30" style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
          <h2 className="text-lg font-headline font-black text-on-surface mb-2">No Awards Yet</h2>
          <p className="text-sm text-on-surface-variant mb-6">No awards have been assigned yet. Check back later!</p>
          <button
            onClick={() => navigate('/organizer')}
            className="flex items-center gap-2 mx-auto bg-gradient-to-r from-primary to-primary-container text-white px-6 py-2.5 rounded-xl font-headline font-bold text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentAwardee = awardees[currentIndex];
  const initials = currentAwardee.student_name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="h-screen civic-mesh-bg flex flex-col font-body antialiased overflow-hidden">

      {/* ── Top bar ── */}
      <div className="shrink-0 px-8 pt-6 pb-4 flex items-center justify-between gap-6">
        <button
          onClick={() => navigate('/organizer')}
          className="flex items-center gap-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-6 py-3 text-base font-headline font-bold text-on-surface hover:bg-surface-container transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          Back
        </button>

        <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/20 rounded-full px-8 py-3 shadow-sm">
          <span className="text-xl font-headline font-black text-primary">{currentIndex + 1}</span>
          <span className="text-base text-on-surface-variant font-medium">of {awardees.length} Awardees</span>
        </div>

        <button
          onClick={downloadPDF}
          className="flex items-center gap-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl px-6 py-3 text-base font-headline font-bold shadow-[0_4px_16px_rgba(19,41,143,0.3)] hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[22px]">download</span>
          Download PDF
        </button>
      </div>

      {/* ── Section header ── */}
      <div className="shrink-0 px-8 pb-4 text-center flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          <h1 className="text-4xl font-headline font-black text-on-surface -tracking-[0.03em]">Award Showcase</h1>
        </div>
        <p className="text-base text-on-surface-variant font-medium flex items-center gap-2">
          Recognizing Excellence in Young Indians Parliament
          <span className="w-1.5 h-1.5 rounded-full bg-secondary-container inline-block" />
        </p>
      </div>

      {/* ── Main bento card ── */}
      <div className="flex-1 px-8 pb-6 flex items-stretch min-h-0">
        <div className="w-full bg-surface-container-lowest rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.12)] overflow-hidden flex flex-col md:flex-row">

          {/* Left: Profile (1/3) */}
          <div className="md:w-[38%] bg-surface-container-low flex flex-col items-center justify-center gap-6 p-10 md:p-14">
            {/* Avatar */}
            {currentAwardee.photo_url ? (
              <img
                src={currentAwardee.photo_url}
                alt={currentAwardee.student_name}
                className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover winner-glow"
              />
            ) : (
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center winner-glow">
                <span className="text-6xl md:text-7xl font-headline font-black text-white">{initials}</span>
              </div>
            )}

            {/* Name & meta */}
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-headline font-black text-on-surface -tracking-[0.02em] leading-tight">
                {currentAwardee.student_name}
              </h2>
              <p className="text-lg md:text-xl font-medium text-on-surface-variant">{currentAwardee.position}</p>

              {/* Party pill */}
              <div className="inline-flex items-center gap-2 bg-secondary-fixed/30 text-secondary rounded-full px-6 py-2.5">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                <span className="text-base font-headline font-bold">Party {currentAwardee.party_number}</span>
              </div>

              {/* Location */}
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-1">
                {currentAwardee.city && (
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[20px]">location_on</span>
                    <span className="text-base font-medium">{currentAwardee.city}</span>
                  </div>
                )}
                {currentAwardee.constituency && (
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[20px]">apartment</span>
                    <span className="text-base font-medium">{currentAwardee.constituency}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Awards (2/3) */}
          <div className="md:w-[62%] flex flex-col p-10 md:p-14 gap-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '2rem', fontVariationSettings: "'FILL' 1" }}>military_tech</span>
              <h3 className="text-2xl md:text-3xl font-headline font-black text-on-surface -tracking-[0.02em]">
                Awards Received
              </h3>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2">
              {currentAwardee.awards.map((award, index) => (
                <div
                  key={award.id}
                  className="award-gradient rounded-2xl p-5 flex items-start gap-4"
                >
                  <div className="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-secondary-container" style={{ fontSize: '1.75rem', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xl md:text-2xl font-headline font-black text-on-surface mb-1 leading-tight uppercase tracking-wide">
                      {award.name}
                    </h4>
                    {award.description && (
                      <p className="text-base text-on-surface-variant font-medium leading-snug mb-3">
                        {award.description}
                      </p>
                    )}
                    <span className="inline-block bg-primary-container text-on-primary-container text-sm font-headline font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                      {award.assigned_by_jury_consensus ? 'Award Received' : 'Recognition Given'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom carousel pill ── */}
      <div className="shrink-0 flex flex-col items-center gap-3 pb-6">
        {/* Dot indicators */}
        {awardees.length > 1 && (
          <div className="flex items-center gap-2">
            {awardees.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'w-7 h-3 bg-primary'
                    : 'w-3 h-3 bg-outline-variant hover:bg-primary/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Prev / count / Next pill */}
        <div className="flex items-center gap-3 bg-surface-container-lowest shadow-lg rounded-full px-3 py-3">
          <button
            onClick={previousSlide}
            disabled={awardees.length <= 1}
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-[28px]">chevron_left</span>
          </button>
          <span className="px-6 text-xl font-headline font-black text-on-surface tabular-nums">
            {currentIndex + 1} / {awardees.length}
          </span>
          <button
            onClick={nextSlide}
            disabled={awardees.length <= 1}
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-[28px]">chevron_right</span>
          </button>
        </div>
      </div>

      <BreakingNewsTicker />
    </div>
  );
};
