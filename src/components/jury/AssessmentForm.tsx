import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Save, Send, Edit, Lock, CheckCircle } from "lucide-react";
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
  administrator: {
    recording_proceedings: {
      name: "Recording Proceedings",
      maxScore: 20,
      subcriteria: {
        accuracy: 7,     // Accuracy of notes
        impartiality: 7, // Impartiality & objectivity
        clarity: 6       // Clarity & use of templates
      }
    },
    managing_agenda: {
      name: "Managing the Agenda",
      maxScore: 20,
      subcriteria: {
        adherence: 7,     // Adherence to schedule
        time_reminders: 7, // Effective time reminders
        coordination: 6   // Coordination with Speaker
      }
    },
    documenting_bills: {
      name: "Documenting Bills & Resolutions",
      maxScore: 20,
      subcriteria: {
        registration: 7,   // Registering bills/resolutions
        amendments: 7,     // Recording amendments
        documentation: 6   // Timely & neat documentation
      }
    },
    support_leadership: {
      name: "Support to Speaker & Deputy Speaker",
      maxScore: 15,
      subcriteria: {
        responsiveness: 5, // Responsiveness
        updates: 5,        // Quick updates/data
        conduct: 5         // Neutral & professional conduct
      }
    },
    teamwork_support: {
      name: "Teamwork & Mutual Support",
      maxScore: 15,
      subcriteria: {
        coordination: 5,    // Role division & coordination
        flexibility: 5,     // Stepping in when needed
        communication: 5    // Communication & collaboration
      }
    },
    attitude_commitment: {
      name: "Attitude, Commitment & Presence",
      maxScore: 10,
      subcriteria: {
        punctuality: 4,     // Punctuality & preparedness
        composure: 3,       // Calm under pressure
        enthusiasm: 3       // Enthusiasm & ownership
      }
    }
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
    recording_proceedings: {
      accuracy: "Accuracy of notes",
      impartiality: "Impartiality & objectivity",
      clarity: "Clarity & use of templates"
    },
    managing_agenda: {
      adherence: "Adherence to schedule",
      time_reminders: "Effective time reminders",
      coordination: "Coordination with Speaker"
    },
    documenting_bills: {
      registration: "Registering bills/resolutions",
      amendments: "Recording amendments",
      documentation: "Timely & neat documentation"
    },
    support_leadership: {
      responsiveness: "Responsiveness",
      updates: "Quick updates/data",
      conduct: "Neutral & professional conduct"
    },
    teamwork_support: {
      coordination: "Role division & coordination",
      flexibility: "Stepping in when needed",
      communication: "Communication & collaboration"
    },
    attitude_commitment: {
      punctuality: "Punctuality & preparedness",
      composure: "Calm under pressure",
      enthusiasm: "Enthusiasm & ownership"
    },
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
  const [scores, setScores] = useState<Record<string, any>>(initialScores || {});
  const [notes, setNotes] = useState(initialNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [assessmentsLocked, setAssessmentsLocked] = useState(false);

  // Determine seat role from position (for UI rubric)
  const getUIRubricRole = (position: string): keyof typeof RUBRICS => {
    if (!position) return 'mp';
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    if (pos.includes('administrator') || pos.includes('admin')) return 'administrator';
    if (pos.includes('minister') || pos.includes('shadow minister')) return 'mp';
    return 'mp';
  };

  // Determine seat role from position (for database storage - constrained values)
  const getDBSeatRole = (position: string): string => {
    if (!position) return 'mp';
    const pos = position.toLowerCase();
    if (pos.includes('speaker') && pos.includes('deputy')) return 'deputy_speaker';
    if (pos.includes('speaker')) return 'speaker';
    // Map admin/administrator and ministers to MP for DB constraint
    if (pos.includes('administrator') || pos.includes('admin')) return 'mp';
    if (pos.includes('minister') || pos.includes('shadow minister')) return 'mp';
    return 'mp';
  };

  const seatRole = getUIRubricRole(student?.position || '');
  const rubric = RUBRICS[seatRole] || RUBRICS.mp;

  // Initialize scores with zero values
  useEffect(() => {
    if (!student || !rubric) return;
    
    if (!scores || Object.keys(scores || {}).length === 0) {
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
  }, [rubric, scores, student]);

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
      if (scores && Object.keys(scores || {}).length > 0) {
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
    if (saved && Object.keys(initialScores || {}).length === 0) {
      try {
        const { scores: savedScores, notes: savedNotes } = JSON.parse(saved);
        if (savedScores) {
          setScores(savedScores);
        }
        if (savedNotes) {
          setNotes(savedNotes);
        }
      } catch (error) {
        console.error('Error loading saved assessment:', error);
      }
    }
  }, [student.id, initialScores]);

  const calculateTotal = () => {
    if (!scores || !rubric || !student) return 0;
    let total = 0;
    try {
      Object.keys(rubric).forEach(criteriaKey => {
        const criteria = rubric[criteriaKey];
        if (criteria && criteria.subcriteria) {
          Object.keys(criteria.subcriteria).forEach(subKey => {
            total += scores[criteriaKey]?.[subKey] || 0;
          });
        } else if (criteria) {
          total += scores[criteriaKey] || 0;
        }
      });
    } catch (error) {
      console.error('Error calculating total:', error);
      return 0;
    }
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
      }
    } catch (error) {
      // Error toast is now handled in JuryStudentList
      console.error('Error submitting assessment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = student?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UN';
  const total = calculateTotal();
  const maxTotal = getMaxTotal();
  const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
  
  // Early return if essential data is missing
  if (!student || !rubric) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  
  // Force cache clear for changes
  useEffect(() => {
    console.log('AssessmentForm component loaded with enhanced profile design');
    console.log('Student data:', student);
  }, [student]);

  return (
    <div className="space-y-8">
      {/* Assessment Rubric Section - Clean separation */}
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
                {initialStatus === 'submitted' ? 'Update Assessment' : 'Submit Assessment'}
              </Button>
              {initialStatus === 'submitted' && (
                <div className="w-full bg-green-100/80 backdrop-blur-sm rounded-xl p-4 border border-green-200/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div className="text-sm">
                      <span className="font-bold text-green-800">Assessment Previously Submitted</span>
                      <p className="text-green-700">You can modify the scores and notes above, then click "Update Assessment" to save changes.</p>
                    </div>
                  </div>
                </div>
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