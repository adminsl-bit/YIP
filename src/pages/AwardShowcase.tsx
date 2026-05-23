import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PartyBadge } from "@/components/ui/party-badge";
import { ChevronLeft, ChevronRight, Trophy, MapPin, Users, ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BreakingNewsTicker } from "@/components/display/BreakingNewsTicker";
import Navbar from "@/components/Navbar";

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
      // Fetch all student awards with related data
      const { data: studentAwardsData, error: studentAwardsError } = await supabase
        .from('student_awards')
        .select(`
          student_id,
          assigned_by_jury_consensus,
          assigned_by_organizer,
          awards (id, name, description)
        `);

      if (studentAwardsError) throw studentAwardsError;

      // Get unique student IDs
      const studentIds = [...new Set(studentAwardsData?.map(sa => sa.student_id) || [])];

      // Fetch student details
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('user_id, name, position, party_number, constituency, state, city, photo_url')
        .in('user_id', studentIds)
        .eq('user_type', 'student');

      if (studentsError) throw studentsError;

      // Group awards by student
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

      const awardeesArray = Array.from(awardeesMap.values());
      setAwardees(awardeesArray);
    } catch (error) {
      console.error('Error fetching awardees:', error);
      toast({
        title: "Error",
        description: "Failed to load awardees data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('award-showcase-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_awards'
      }, () => {
        fetchAwardees();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'awards'
      }, () => {
        fetchAwardees();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % awardees.length);
  };

  const previousSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + awardees.length) % awardees.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const downloadPDF = async () => {
    try {
      toast({
        title: "Generating PDF",
        description: "Creating award showcase PDF...",
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Add title page
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Award Showcase', pageWidth / 2, 40, { align: 'center' });
      
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Young Indians Parliament', pageWidth / 2, 55, { align: 'center' });
      
      pdf.setFontSize(14);
      pdf.text('Recognizing Excellence', pageWidth / 2, 70, { align: 'center' });

      pdf.setFontSize(12);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 90, { align: 'center' });

      // Add each awardee
      for (let i = 0; i < awardees.length; i++) {
        const awardee = awardees[i];
        
        pdf.addPage();
        yPosition = margin;

        // Participant name
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text(awardee.student_name, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 12;

        // Position
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.text(awardee.position, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;

        // Party
        pdf.setFontSize(12);
        pdf.text(`Party: ${awardee.party_number}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;

        // Location
        pdf.text(`${awardee.city}, ${awardee.constituency}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // Separator line
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 15;

        // Awards heading
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Awards:', margin, yPosition);
        yPosition += 10;

        // List each award
        awardee.awards.forEach((award, index) => {
          // Check if we need a new page
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }

          // Award number
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${index + 1}. ${award.name}`, margin, yPosition);
          yPosition += 7;
          
          // Award description
          if (award.description) {
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            const splitDescription = pdf.splitTextToSize(award.description, pageWidth - margin * 2 - 5);
            pdf.text(splitDescription, margin + 5, yPosition);
            yPosition += splitDescription.length * 5 + 2;
          }
          
          // Award type
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'italic');
          pdf.text(
            award.assigned_by_jury_consensus ? 'Award Received' : 'Recognition Given', 
            margin + 5, 
            yPosition
          );
          yPosition += 10;
        });

        // Page number
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(
          `Page ${i + 2} of ${awardees.length + 1}`, 
          pageWidth / 2, 
          pageHeight - 10, 
          { align: 'center' }
        );
      }

      // Save the PDF
      pdf.save('award-showcase.pdf');
      
      toast({
        title: "PDF Downloaded",
        description: "Award showcase PDF has been downloaded successfully!",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-base sm:text-xl text-muted-foreground">Loading award showcase...</p>
        </div>
      </div>
    );
  }

  if (awardees.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center px-4">
        <Card className="bg-white/80 backdrop-blur-lg border border-white/25 shadow-xl p-6 sm:p-8 lg:p-12 text-center max-w-md">
          <CardContent className="space-y-4">
            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 mx-auto" />
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">No Awards Yet</h2>
            <p className="text-sm sm:text-base text-slate-600">No awards have been assigned yet. Check back later!</p>
            <Button onClick={() => navigate('/organizer')} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentAwardee = awardees[currentIndex];

  return (
    <div className="min-h-screen bg-surface relative overflow-hidden flex flex-col font-body antialiased">
      <Navbar />
      <div className="pt-16">
        <BreakingNewsTicker />
      </div>
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(59,130,246,0.15)_1px,_transparent_0)] bg-[length:40px_40px] animate-pulse"></div>
        <div className="absolute top-10 left-10 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce"></div>
        <div className="absolute top-10 right-10 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce delay-1000"></div>
        <div className="absolute bottom-10 left-1/2 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-2 sm:p-3 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
          <Button 
            onClick={() => navigate('/organizer')}
            variant="outline"
            className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 w-full sm:w-auto h-7 text-[10px]"
          >
            <ArrowLeft className="w-3 h-3 mr-1.5" />
            Back to Dashboard
          </Button>
          
          <div className="text-center flex-1">
            <h1 className="text-title-sm font-headline font-extrabold text-primary leading-tight -tracking-[0.03em] mb-0.5">
              🏆 Award Showcase
            </h1>
            <p className="text-[9px] text-on-surface-variant font-medium">
              Recognizing Excellence in Young Indians Parliament
            </p>
          </div>

          <div className="text-center sm:text-right w-full sm:w-auto">
            <Button
              onClick={downloadPDF}
              variant="outline"
              className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 mb-1.5 w-full sm:w-auto h-7 text-[9px]"
            >
              <Download className="w-2.5 h-2.5 mr-1.5" />
              Download PDF
            </Button>
            <div className="flex items-center justify-center sm:justify-end gap-2">
              <span className="text-xs font-bold text-slate-800">
                {currentIndex + 1} of {awardees.length}
              </span>
              <span className="text-[9px] text-slate-600">Awardees</span>
            </div>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex justify-center space-x-1 sm:space-x-1.5 mb-2 sm:mb-3 overflow-x-auto py-1">
          {awardees.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300 flex-shrink-0 ${
                index === currentIndex 
                  ? 'bg-yellow-500 scale-125 shadow-lg' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main showcase - flexible height */}
      <div className="relative z-10 px-4 flex-1 flex items-center">
        <div className="max-w-6xl mx-auto w-full">
          <Card className="bg-white/25 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden animate-fade-in">
            <CardContent className="p-6 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Photo and Basic Info */}
                <div className="text-center">
                  <div className="relative inline-block mb-2">
                    <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-full blur-sm opacity-75 animate-pulse"></div>
                    <Avatar className="relative w-20 h-20 lg:w-24 lg:h-24 border-2 border-white shadow-xl">
                      <AvatarImage 
                        src={currentAwardee.photo_url} 
                        alt={currentAwardee.student_name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white text-lg lg:text-2xl font-bold">
                        {currentAwardee.student_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <h2 className="text-lg md:text-xl font-black text-slate-800 mb-1">
                    {currentAwardee.student_name}
                  </h2>
                  
                  <div className="space-y-1.5">
                    <Badge 
                      variant="outline" 
                      className="text-[8px] px-2 py-0.5 bg-white/30 border-white/40 text-slate-700 font-bold"
                    >
                      {currentAwardee.position}
                    </Badge>
                    
                    <div className="flex justify-center scale-90">
                      <PartyBadge partyNumber={currentAwardee.party_number} size="sm" />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        <span className="font-medium text-[9px]">{currentAwardee.city}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        <span className="font-medium text-[9px]">{currentAwardee.constituency}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Awards */}
                <div className="space-y-3">
                  <div className="text-center">
                    <h3 className="text-base lg:text-lg font-headline font-bold text-primary mb-0.5">
                      🏆 Awards Received
                    </h3>
                    <p className="text-on-surface-variant font-medium text-[8px]">Recognition for Outstanding Performance</p>
                  </div>
                  
                  <div className="space-y-2 max-h-56 lg:max-h-72 overflow-y-auto pr-2">
                    {currentAwardee.awards.map((award, index) => (
                      <div 
                        key={award.id}
                        className="bg-gradient-to-r from-yellow-100/80 to-orange-100/80 backdrop-blur-sm rounded-lg p-3 border border-yellow-200/50 shadow-md animate-scale-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded flex items-center justify-center shadow-md flex-shrink-0">
                            <Trophy className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-[11px] font-black text-slate-800 mb-0.5 leading-tight uppercase">
                              {award.name}
                            </h4>
                            {award.description && (
                              <p className="text-slate-600 mb-1.5 font-medium text-[9px] leading-tight">
                                {award.description}
                              </p>
                            )}
                            <Badge 
                              variant={award.assigned_by_jury_consensus ? "default" : "secondary"}
                              className={`font-black text-[7px] uppercase tracking-wider h-4 ${
                                award.assigned_by_jury_consensus 
                                  ? "bg-blue-500/20 text-blue-700 border border-blue-500/30" 
                                  : "bg-purple-500/20 text-purple-700 border border-purple-500/30"
                              }`}
                            >
                              {award.assigned_by_jury_consensus ? "Award Received" : "Recognition Given"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="relative z-10 p-4 flex-shrink-0">
        <div className="flex items-center justify-center gap-4 bg-white/20 backdrop-blur-lg rounded-2xl border border-white/25 shadow-xl p-3 max-w-md mx-auto">
          <Button 
            onClick={previousSlide}
            variant="outline"
            size="lg"
            disabled={awardees.length <= 1}
            className="bg-white/20 border-white/30 text-slate-800 hover:bg-white/35 hover:scale-105 transition-all duration-300"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <div className="px-6 py-2 bg-white/30 rounded-xl">
            <span className="text-lg font-bold text-slate-800">
              {currentIndex + 1} / {awardees.length}
            </span>
          </div>
          
          <Button 
            onClick={nextSlide}
            variant="outline"
            size="lg"
            disabled={awardees.length <= 1}
            className="bg-white/20 border-white/30 text-slate-800 hover:bg-white/35 hover:scale-105 transition-all duration-300"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};