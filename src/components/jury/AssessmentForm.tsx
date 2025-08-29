import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Save, Send, Edit, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RubricCriteria {
  name: string;
  maxScore: number;
  subcriteria?: { [key: string]: number };
}

interface StudentProfile {
  id: string;
  name: string;
  position: string;
  party_number: number;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  user_type: string;
}

interface AssessmentFormProps {
  student: StudentProfile;
  onSubmit: (scores: Record<string, any>, notes: string, status: 'draft' | 'submitted') => void;
  initialScores?: Record<string, any>;
  initialNotes?: string;
  initialStatus?: 'draft' | 'submitted' | 'locked';
  isLocked?: boolean;
}

const RUBRICS: Record<string, Record<string, RubricCriteria>> = {
  speaker: {
    impartiality: { name: "Impartiality", maxScore: 30 },
    leadership_control: { name: "Leadership & Control", maxScore: 25 },
    knowledge_rules: { name: "Knowledge of Rules", maxScore: 20 },
    clarity_communication: { name: "Clarity of Communication", maxScore: 15 },
    time_management: { name: "Time Management", maxScore: 10 }
  },
  deputy_speaker: {
    support_speaker: { name: "Support to the Speaker", maxScore: 30 },
    impartiality: { name: "Impartiality", maxScore: 25 },
    leadership: { name: "Leadership", maxScore: 20 },
    communication_skills: { name: "Communication Skills", maxScore: 15 },
    adaptability: { name: "Adaptability", maxScore: 10 }
  },
  mp: {
    content_substance: { 
      name: "Content & Substance", 
      maxScore: 30,
      subcriteria: { 
        relevance: 10, // Relevance to the topic
        research: 10,  // Research  
        originality: 10 // Originality/Creativity
      }
    },
    communication_delivery: {
      name: "Communication & Delivery",
      maxScore: 25,
      subcriteria: { 
        clarity: 10,     // Clarity & Articulation
        confidence: 10,  // Confidence & Pose
        fluency: 5       // Fluency & Language
      }
    },
    parliamentary_conduct: {
      name: "Parliamentary Conduct & Decorum",
      maxScore: 20,
      subcriteria: { 
        rules: 10,       // Respect for Rules & Procedures
        engagement: 5,   // Engagement & Responsiveness
        respect: 5       // Respect for others
      }
    },
    argumentation_persuasion: {
      name: "Argumentation & Persuasion",
      maxScore: 15,
      subcriteria: { 
        strength: 10,    // Strength of Argument
        appeal: 5        // Emotional & Logical Appeal
      }
    },
    teamwork_collaboration: {
      name: "Teamwork & Collaboration",
      maxScore: 10,
      subcriteria: { 
        coordination: 5,      // Coordination with Team Members
        active_learning: 5    // Active Learning
      }
    }
  }
};

// Function to get proper labels for subcriteria
const getSubcriteriaLabel = (criteriaKey: string, subKey: string): string => {
  const labels: Record<string, Record<string, string>> = {
    content_substance: {
      relevance: "Relevance to the topic",
      research: "Research",
      originality: "Originality/Creativity"
    },
    communication_delivery: {
      clarity: "Clarity & Articulation",
      confidence: "Confidence & Pose",
      fluency: "Fluency & Language"
    },
    parliamentary_conduct: {
      rules: "Respect for Rules & Procedures",
      engagement: "Engagement & Responsiveness",
      respect: "Respect for others"
    },
    argumentation_persuasion: {
      strength: "Strength of Argument",
      appeal: "Emotional & Logical Appeal"
    },
    teamwork_collaboration: {
      coordination: "Coordination with Team Members",
      active_learning: "Active Learning"
    }
  };
  
  return labels[criteriaKey]?.[subKey] || subKey.replace('_', ' ');
};

export const AssessmentForm = ({ 
  student, 
  onSubmit, 
  initialScores = {}, 
  initialNotes = "", 
  initialStatus = 'draft',
  isLocked = false 
}: AssessmentFormProps) => {
  const [scores, setScores] = useState<Record<string, any>>(initialScores);
  const [notes, setNotes] = useState(initialNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [assessmentsLocked, setAssessmentsLocked] = useState(false);

  // Determine seat role from position
  const getSeatRole = (position: string): keyof typeof RUBRICS => {
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    return 'mp';
  };

  const seatRole = getSeatRole(student.position);
  const rubric = RUBRICS[seatRole];

  // Initialize scores with zero values
  useEffect(() => {
    if (Object.keys(scores).length === 0) {
      const initialScoreState: Record<string, any> = {};
      Object.keys(rubric).forEach(criteriaKey => {
        const criteria = rubric[criteriaKey];
        if (criteria.subcriteria) {
          initialScoreState[criteriaKey] = {};
          Object.keys(criteria.subcriteria).forEach(subKey => {
            initialScoreState[criteriaKey][subKey] = 0;
          });
        } else {
          initialScoreState[criteriaKey] = 0;
        }
      });
      setScores(initialScoreState);
    }
  }, [rubric, scores]);

  // Check assessment lock setting
  useEffect(() => {
    const checkAssessmentLock = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'assessments_locked')
          .limit(1);
        
        if (error) throw error;
        const lockValue = data && data.length ? data[0].setting_value : false;
        setAssessmentsLocked(lockValue === true || lockValue === 'true');
      } catch (error) {
        console.error('Error checking assessment lock:', error);
      }
    };
    
    checkAssessmentLock();
  }, []);

  // Auto-save to localStorage every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(scores).length > 0) {
        localStorage.setItem(`assessment_draft_${student.id}`, JSON.stringify({
          scores,
          notes,
          timestamp: new Date().toISOString()
        }));
        setLastSaved(new Date());
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [scores, notes, student.id]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`assessment_draft_${student.id}`);
    if (saved && Object.keys(initialScores).length === 0) {
      try {
        const { scores: savedScores, notes: savedNotes } = JSON.parse(saved);
        setScores(savedScores);
        setNotes(savedNotes);
      } catch (error) {
        console.error('Error loading saved assessment:', error);
      }
    }
  }, [student.id, initialScores]);

  const calculateTotal = () => {
    let total = 0;
    Object.keys(rubric).forEach(criteriaKey => {
      const criteria = rubric[criteriaKey];
      if (criteria.subcriteria) {
        Object.keys(criteria.subcriteria).forEach(subKey => {
          total += scores[criteriaKey]?.[subKey] || 0;
        });
      } else {
        total += scores[criteriaKey] || 0;
      }
    });
    return total;
  };

  const getMaxTotal = () => {
    return Object.values(rubric).reduce((sum, criteria) => sum + criteria.maxScore, 0);
  };

  const updateScore = (criteriaKey: string, value: number, subKey?: string) => {
    setScores(prev => {
      const newScores = { ...prev };
      if (subKey) {
        if (!newScores[criteriaKey]) newScores[criteriaKey] = {};
        newScores[criteriaKey][subKey] = value;
      } else {
        newScores[criteriaKey] = value;
      }
      return newScores;
    });
  };

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setIsSubmitting(true);
    try {
      await onSubmit(scores, notes, status);
      if (status === 'submitted') {
        localStorage.removeItem(`assessment_draft_${student.id}`);
        toast({
          title: "Assessment Submitted",
          description: "Your assessment has been submitted successfully.",
        });
      } else {
        toast({
          title: "Assessment Saved",
          description: "Your assessment has been saved as draft.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
  const total = calculateTotal();
  const maxTotal = getMaxTotal();
  const percentage = Math.round((total / maxTotal) * 100);

  return (
    <div className="space-y-8">
      {/* Enhanced Student Profile Header */}
      <div className="bg-white/15 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Avatar Section */}
          <div className="relative flex-shrink-0">
            <div className="relative">
              <Avatar className="w-32 h-32 ring-4 ring-white/25 shadow-xl border-4 border-white/20">
                <AvatarImage 
                  src={student.photo_url
                    ? (() => {
                        const raw = student.photo_url.includes('/file/d/')
                          ? `https://drive.google.com/uc?export=view&id=${student.photo_url.split('/d/')[1]?.split('/')[0]}`
                          : student.photo_url;
                        const suffix = raw.includes('?') ? '&' : '?';
                        return `${raw}${suffix}cb=${Date.now()}`;
                      })()
                    : undefined}
                  alt={student.name} 
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="text-3xl font-black bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-full border-2 border-white animate-pulse shadow-lg"></div>
            </div>
          </div>
          
          {/* Student Details */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-6">
              <h1 className="text-4xl font-black text-slate-800 mb-2">{student.name}</h1>
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                  {student.position.toLowerCase().includes('speaker') ? (
                    <span className="text-white text-xs font-black">S</span>
                  ) : (
                    <span className="text-white text-xs font-black">M</span>
                  )}
                </div>
                <Badge className="px-6 py-2 text-lg font-black bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 shadow-lg">
                  {student.position}
                </Badge>
              </div>
            </div>
            
            {/* Profile Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xs font-black">#</span>
                  </div>
                  <p className="text-slate-600 font-semibold text-sm">Serial Number</p>
                </div>
                <p className="font-black text-xl text-slate-800">{student.serial_number}</p>
              </div>
              
              <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xs font-black">P</span>
                  </div>
                  <p className="text-slate-600 font-semibold text-sm">Party Number</p>
                </div>
                <p className="font-black text-xl text-slate-800">Party {student.party_number}</p>
              </div>
              
              {student.constituency && (
                <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-black">C</span>
                    </div>
                    <p className="text-slate-600 font-semibold text-sm">Constituency</p>
                  </div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">{student.constituency}</p>
                </div>
              )}
              
              {student.state && (
                <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-black">S</span>
                    </div>
                    <p className="text-slate-600 font-semibold text-sm">State</p>
                  </div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">{student.state}</p>
                </div>
              )}
              
              {student.city && (
                <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-black">🏙</span>
                    </div>
                    <p className="text-slate-600 font-semibold text-sm">City</p>
                  </div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">{student.city}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Score Display */}
          <div className="flex-shrink-0">
            <div className="text-center bg-white/25 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-xl">
              <div className="mb-4">
                <div className="text-5xl font-black text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text mb-2">
                  {total}
                </div>
                <div className="text-sm font-bold text-slate-600 mb-4">out of {maxTotal}</div>
              </div>
              <div className="w-32">
                <Progress value={percentage} className="h-4 bg-white/30" />
                <p className="text-sm font-black text-slate-700 mt-2">{percentage}% Complete</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Form */}
      <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 border border-white/25 shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-3xl flex items-center justify-center shadow-lg">
              <Edit className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800">
                {seatRole.replace('_', ' ').toUpperCase()} Assessment Rubric
              </h3>
              <p className="text-slate-600 font-semibold">Evaluate student performance across all criteria</p>
            </div>
          </div>
          
          {lastSaved && (
            <div className="bg-white/30 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30">
              <span className="text-sm font-semibold text-slate-600">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {Object.entries(rubric).map(([criteriaKey, criteria]) => (
            <div key={criteriaKey} className="bg-white/15 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-black text-slate-800">{criteria.name}</h4>
                <div className="bg-white/40 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-lg font-black text-slate-800">
                    {criteria.subcriteria 
                      ? `${Object.values(scores[criteriaKey] || {}).reduce((a: number, b: number) => a + b, 0)} / ${criteria.maxScore}`
                      : `${scores[criteriaKey] || 0} / ${criteria.maxScore}`
                    }
                  </span>
                </div>
              </div>

              {criteria.subcriteria ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.entries(criteria.subcriteria).map(([subKey, maxScore]) => (
                    <div key={subKey} className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-slate-700">
                          {getSubcriteriaLabel(criteriaKey, subKey)}
                        </label>
                        <div className="bg-white/40 backdrop-blur-sm rounded-lg px-3 py-1">
                          <span className="text-sm font-black text-slate-800">
                            {scores[criteriaKey]?.[subKey] || 0} / {maxScore}
                          </span>
                        </div>
                      </div>
                      <Slider
                        value={[scores[criteriaKey]?.[subKey] || 0]}
                        onValueChange={([value]) => updateScore(criteriaKey, value, subKey)}
                        max={maxScore}
                        step={1}
                        className="w-full"
                        disabled={isLocked || initialStatus === 'locked' || assessmentsLocked}
                      />
                      <div className="flex justify-between text-xs font-semibold text-slate-500 mt-2">
                        <span>0</span>
                        <span>{Math.floor(maxScore / 2)}</span>
                        <span>{maxScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="mb-3">
                    <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                      <span>0</span>
                      <span>{Math.floor(criteria.maxScore / 2)}</span>
                      <span>{criteria.maxScore}</span>
                    </div>
                    <Slider
                      value={[scores[criteriaKey] || 0]}
                      onValueChange={([value]) => updateScore(criteriaKey, value)}
                      max={criteria.maxScore}
                      step={1}
                      className="w-full"
                      disabled={isLocked || initialStatus === 'locked' || assessmentsLocked}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Notes Section */}
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Edit className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-xl font-black text-slate-800">Additional Notes</h4>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional observations, comments, or feedback about the student's performance..."
              rows={4}
              disabled={isLocked || initialStatus === 'locked' || assessmentsLocked}
              className="bg-white/30 backdrop-blur-sm border-white/40 text-slate-800 placeholder:text-slate-500 rounded-xl font-medium"
            />
          </div>

          {/* Action Buttons */}
          {!isLocked && initialStatus !== 'locked' && !assessmentsLocked && (
            <div className="flex flex-wrap gap-4 pt-6">
              <Button
                onClick={() => handleSubmit('draft')}
                variant="outline"
                disabled={isSubmitting}
                className="bg-white/30 backdrop-blur-sm border-white/40 text-slate-800 hover:bg-white/40 hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3 font-bold"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSubmit('submitted')}
                disabled={isSubmitting || total === 0}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3 font-bold shadow-lg"
              >
                <Send className="w-5 h-5 mr-2" />
                Submit Assessment
              </Button>
              {initialStatus === 'submitted' && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="bg-white/20 backdrop-blur-sm border-white/30 text-slate-700 hover:bg-white/30 rounded-2xl px-4 py-2 font-semibold"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Submitted
                </Button>
              )}
            </div>
          )}

          {(isLocked || initialStatus === 'locked' || assessmentsLocked) && (
            <div className="bg-red-100/80 backdrop-blur-sm rounded-2xl p-6 border border-red-200/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-red-800">Assessment Locked</h4>
                  <p className="text-red-700 font-semibold">
                    {assessmentsLocked 
                      ? "Assessments have been globally locked by the organizer and cannot be modified."
                      : "This assessment has been locked and cannot be modified."
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};