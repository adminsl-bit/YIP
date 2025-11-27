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
        description: "Creating award showcase PDF. This may take a moment...",
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '794px'; // A4 width in pixels at 96 DPI
      container.style.backgroundColor = '#ffffff';
      document.body.appendChild(container);

      try {
        // Add title page
        container.innerHTML = `
          <div style="width: 794px; height: 1123px; background: linear-gradient(135deg, #EFF6FF 0%, #FEF3C7 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; padding: 40px;">
            <div style="text-align: center;">
              <div style="font-size: 48px; font-weight: 900; background: linear-gradient(to right, #D97706, #EA580C, #DC2626); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px;">
                🏆 Award Showcase
              </div>
              <div style="font-size: 28px; font-weight: 600; color: #475569; margin-bottom: 12px;">
                Young Indians Parliament
              </div>
              <div style="font-size: 24px; font-weight: 500; color: #64748B; margin-bottom: 40px;">
                Recognizing Excellence
              </div>
              <div style="font-size: 18px; color: #64748B;">
                Generated on: ${new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        `;

        const titleCanvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const titleImgData = titleCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(titleImgData, 'JPEG', 0, 0, pageWidth, pageHeight);

        // Add each awardee
        for (let i = 0; i < awardees.length; i++) {
          const awardee = awardees[i];
          
          pdf.addPage();

          // Create awardee page
          container.innerHTML = `
            <div style="width: 794px; min-height: 1123px; background: linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 50%, #FEF3C7 100%); padding: 40px; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
              <div style="background: rgba(255, 255, 255, 0.9); border-radius: 24px; padding: 40px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1); box-sizing: border-box;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 40px;">
                  <div style="margin: 0 auto 20px auto; width: 180px; height: 180px;">
                    ${awardee.photo_url 
                      ? `<img src="${awardee.photo_url}" style="width: 180px; height: 180px; border-radius: 50%; object-fit: cover; border: 6px solid #fff; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); display: block;" crossorigin="anonymous" />`
                      : `<div style="width: 180px; height: 180px; border-radius: 50%; background: linear-gradient(135deg, #64748B, #475569); display: flex; align-items: center; justify-content: center; border: 6px solid #fff; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); box-sizing: border-box;">
                           <span style="color: white; font-size: 48px; font-weight: 900; display: block;">${awardee.student_name.split(' ').map(n => n[0]).join('')}</span>
                         </div>`
                    }
                  </div>
                  
                  <h1 style="font-size: 36px; font-weight: 900; color: #1E293B; margin: 0 auto 16px auto; text-align: center; display: block;">
                    ${awardee.student_name}
                  </h1>
                  
                  <div style="text-align: center; margin: 0 auto 12px auto;">
                    <div style="display: inline-block; background: rgba(59, 130, 246, 0.1); border: 2px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 8px 24px;">
                      <span style="font-size: 18px; font-weight: 700; color: #1E40AF; display: block;">
                        ${awardee.position}
                      </span>
                    </div>
                  </div>
                  
                  <div style="text-align: center; margin: 0 auto 16px auto;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #8B5CF6); border-radius: 12px; padding: 8px 24px;">
                      <span style="font-size: 16px; font-weight: 700; color: white; display: block;">
                        Party ${awardee.party_number}
                      </span>
                    </div>
                  </div>
                  
                  <div style="text-align: center; margin: 0 auto;">
                    <span style="color: #64748B; font-size: 14px; font-weight: 600;">📍 ${awardee.city}</span>
                    <span style="color: #64748B; font-size: 14px; font-weight: 600; margin: 0 12px;">•</span>
                    <span style="color: #64748B; font-size: 14px; font-weight: 600;">👥 ${awardee.constituency}</span>
                  </div>
                </div>

                <!-- Awards Section -->
                <div style="margin-top: 40px;">
                  <h2 style="text-align: center; font-size: 28px; font-weight: 900; background: linear-gradient(to right, #D97706, #EA580C); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 auto 24px auto; display: block;">
                    🏆 Awards Received
                  </h2>
                  
                  <div style="width: 100%;">
                    ${awardee.awards.map(award => `
                      <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%); border: 2px solid #FCD34D; border-radius: 16px; padding: 20px; margin-bottom: 16px; width: 100%; box-sizing: border-box;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="width: 48px; vertical-align: top; padding-right: 16px;">
                              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #F59E0B, #EA580C); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(251, 146, 60, 0.4);">
                                <span style="font-size: 24px; display: block;">🏆</span>
                              </div>
                            </td>
                            <td style="vertical-align: top;">
                              <h3 style="font-size: 20px; font-weight: 900; color: #1E293B; margin: 0 0 8px 0; display: block;">
                                ${award.name}
                              </h3>
                              ${award.description ? `
                                <p style="font-size: 14px; font-weight: 500; color: #475569; margin: 0 0 12px 0; line-height: 1.6; display: block;">
                                  ${award.description}
                                </p>
                              ` : ''}
                              <div style="display: inline-block; background: ${award.assigned_by_jury_consensus ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)'}; border: 1px solid ${award.assigned_by_jury_consensus ? 'rgba(59, 130, 246, 0.4)' : 'rgba(168, 85, 247, 0.4)'}; border-radius: 8px; padding: 4px 12px;">
                                <span style="font-size: 12px; font-weight: 700; color: ${award.assigned_by_jury_consensus ? '#1E40AF' : '#6B21A8'}; display: block;">
                                  ${award.assigned_by_jury_consensus ? 'Award Received' : 'Recognition Given'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Page number -->
                <div style="text-align: center; margin-top: 40px; color: #94A3B8; font-size: 14px; font-weight: 600; display: block;">
                  Page ${i + 2} of ${awardees.length + 1}
                </div>
              </div>
            </div>
          `;

          const awardeeCanvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            allowTaint: true
          });

          const awardeeImgData = awardeeCanvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(awardeeImgData, 'JPEG', 0, 0, pageWidth, pageHeight);
        }

        // Save the PDF
        pdf.save('award-showcase.pdf');
        
        toast({
          title: "PDF Downloaded",
          description: "Award showcase PDF has been downloaded successfully!",
        });
      } finally {
        // Clean up
        document.body.removeChild(container);
      }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative overflow-hidden flex flex-col">
      <BreakingNewsTicker />
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(59,130,246,0.15)_1px,_transparent_0)] bg-[length:40px_40px] animate-pulse"></div>
        <div className="absolute top-10 left-10 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce"></div>
        <div className="absolute top-10 right-10 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce delay-1000"></div>
        <div className="absolute bottom-10 left-1/2 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full mix-blend-multiply filter blur-xl animate-bounce delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-3 sm:p-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <Button 
            onClick={() => navigate('/organizer')}
            variant="outline"
            className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="text-center flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 bg-clip-text">
              🏆 Award Showcase
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Recognizing Excellence in Young Indians Parliament
            </p>
          </div>

          <div className="text-center sm:text-right w-full sm:w-auto">
            <Button
              onClick={downloadPDF}
              variant="outline"
              className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-800 hover:bg-white/35 mb-2 w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-800">
                {currentIndex + 1} of {awardees.length}
              </p>
              <p className="text-xs sm:text-sm text-slate-600">Awardees</p>
            </div>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex justify-center space-x-1.5 sm:space-x-2 mb-3 sm:mb-4 overflow-x-auto py-2">
          {awardees.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-300 flex-shrink-0 ${
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
                  <div className="relative inline-block mb-4">
                    <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-full blur-lg opacity-75 animate-pulse"></div>
                    <Avatar className="relative w-40 h-40 lg:w-52 lg:h-52 border-6 border-white shadow-2xl">
                      <AvatarImage 
                        src={currentAwardee.photo_url} 
                        alt={currentAwardee.student_name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white text-3xl lg:text-5xl font-bold">
                        {currentAwardee.student_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 mb-3">
                    {currentAwardee.student_name}
                  </h2>
                  
                  <div className="space-y-3">
                    <Badge 
                      variant="outline" 
                      className="text-base lg:text-lg px-4 py-2 bg-white/30 border-white/40 text-slate-700 font-bold"
                    >
                      {currentAwardee.position}
                    </Badge>
                    
                    <div className="flex justify-center">
                      <PartyBadge partyNumber={currentAwardee.party_number} size="md" />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium text-sm">{currentAwardee.city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="font-medium text-sm">{currentAwardee.constituency}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Awards */}
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-xl lg:text-2xl font-black text-transparent bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text mb-2">
                      🏆 Awards Received
                    </h3>
                    <p className="text-slate-600 font-medium text-sm">Recognition for Outstanding Performance</p>
                  </div>
                  
                  <div className="space-y-3 max-h-64 lg:max-h-80 overflow-y-auto pr-2">
                    {currentAwardee.awards.map((award, index) => (
                      <div 
                        key={award.id}
                        className="bg-gradient-to-r from-yellow-100/80 to-orange-100/80 backdrop-blur-sm rounded-xl p-4 border border-yellow-200/50 shadow-lg animate-scale-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <Trophy className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-black text-slate-800 mb-1">
                              {award.name}
                            </h4>
                            {award.description && (
                              <p className="text-slate-600 mb-2 font-medium text-sm">
                                {award.description}
                              </p>
                            )}
                            <Badge 
                              variant={award.assigned_by_jury_consensus ? "default" : "secondary"}
                              className={`font-medium text-xs ${
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