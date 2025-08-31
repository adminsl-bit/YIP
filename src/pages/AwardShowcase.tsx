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

      // Add title page
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('🏆 Award Showcase', pageWidth / 2, 40, { align: 'center' });
      
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Young Indians Parliament', pageWidth / 2, 55, { align: 'center' });
      pdf.text('Recognizing Excellence', pageWidth / 2, 70, { align: 'center' });

      // Add current date
      pdf.setFontSize(12);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 85, { align: 'center' });

      let yPosition = 110;

      // Add each awardee
      for (let i = 0; i < awardees.length; i++) {
        const awardee = awardees[i];
        
        // Check if we need a new page
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = margin;
        }

        // Student name
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(awardee.student_name, margin, yPosition);
        yPosition += 10;

        // Position and party
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Position: ${awardee.position}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Party: ${awardee.party_number}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Location: ${awardee.city}, ${awardee.constituency}`, margin, yPosition);
        yPosition += 10;

        // Awards
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Awards:', margin, yPosition);
        yPosition += 8;

        awardee.awards.forEach(award => {
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`• ${award.name}`, margin + 5, yPosition);
          yPosition += 6;
          
          if (award.description) {
            pdf.setFont('helvetica', 'normal');
            const splitDescription = pdf.splitTextToSize(award.description, pageWidth - margin * 2 - 10);
            pdf.text(splitDescription, margin + 10, yPosition);
            yPosition += splitDescription.length * 5;
          }
          
          pdf.setFont('helvetica', 'italic');
          pdf.text(`Type: ${award.assigned_by_jury_consensus ? 'Award Received' : 'Recognition Given'}`, margin + 10, yPosition);
          yPosition += 8;
        });

        yPosition += 15; // Space between students
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
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground text-xl">Loading award showcase...</p>
        </div>
      </div>
    );
  }

  if (awardees.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-lg border border-white/25 shadow-xl p-12 text-center max-w-md">
          <CardContent className="space-y-4">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
            <h2 className="text-2xl font-bold text-slate-800">No Awards Yet</h2>
            <p className="text-slate-600">No awards have been assigned yet. Check back later!</p>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(59,130,246,0.15)_1px,_transparent_0)] bg-[length:40px_40px] animate-pulse"></div>
        <div className="absolute top-10 left-10 w-72 h-72 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce"></div>
        <div className="absolute top-10 right-10 w-72 h-72 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce delay-1000"></div>
        <div className="absolute bottom-10 left-1/2 w-72 h-72 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <Button 
            onClick={() => navigate('/organizer')}
            variant="outline"
            className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 bg-clip-text">
              🏆 Award Showcase
            </h1>
            <p className="text-slate-600 font-medium mt-2">
              Recognizing Excellence in Young Indians Parliament
            </p>
          </div>

          <div className="text-right space-y-2">
            <Button
              onClick={downloadPDF}
              variant="outline"
              className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 mb-2"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <div>
              <p className="text-lg font-bold text-slate-800">
                {currentIndex + 1} of {awardees.length}
              </p>
              <p className="text-sm text-slate-600">Awardees</p>
            </div>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex justify-center space-x-2 mb-8">
          {awardees.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-yellow-500 scale-125 shadow-lg' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main showcase */}
      <div className="relative z-10 px-6 pb-6">
        <div className="max-w-6xl mx-auto">
          <Card className="bg-white/25 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden animate-fade-in">
            <CardContent className="p-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Photo and Basic Info */}
                <div className="text-center">
                  <div className="relative inline-block mb-8">
                    <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-full blur-lg opacity-75 animate-pulse"></div>
                    <Avatar className="relative w-64 h-64 border-8 border-white shadow-2xl">
                      <AvatarImage 
                        src={currentAwardee.photo_url} 
                        alt={currentAwardee.student_name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white text-6xl font-bold">
                        {currentAwardee.student_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-black text-slate-800 mb-4">
                    {currentAwardee.student_name}
                  </h2>
                  
                  <div className="space-y-4">
                    <Badge 
                      variant="outline" 
                      className="text-xl px-6 py-3 bg-white/30 border-white/40 text-slate-700 font-bold"
                    >
                      {currentAwardee.position}
                    </Badge>
                    
                    <div className="flex justify-center">
                      <PartyBadge partyNumber={currentAwardee.party_number} size="md" />
                    </div>
                    
                    <div className="flex items-center justify-center gap-6 text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        <span className="font-medium">{currentAwardee.city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        <span className="font-medium">{currentAwardee.constituency}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Awards */}
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-3xl font-black text-transparent bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text mb-2">
                      🏆 Awards Received
                    </h3>
                    <p className="text-slate-600 font-medium">Recognition for Outstanding Performance</p>
                  </div>
                  
                  <div className="space-y-4">
                    {currentAwardee.awards.map((award, index) => (
                      <div 
                        key={award.id}
                        className="bg-gradient-to-r from-yellow-100/80 to-orange-100/80 backdrop-blur-sm rounded-2xl p-6 border border-yellow-200/50 shadow-lg animate-scale-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <Trophy className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xl font-black text-slate-800 mb-2">
                              {award.name}
                            </h4>
                            {award.description && (
                              <p className="text-slate-600 mb-3 font-medium">
                                {award.description}
                              </p>
                            )}
                            <Badge 
                              variant={award.assigned_by_jury_consensus ? "default" : "secondary"}
                              className={`font-medium ${
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
      <div className="relative z-10 fixed bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-4 bg-white/20 backdrop-blur-lg rounded-2xl border border-white/25 shadow-xl p-4">
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