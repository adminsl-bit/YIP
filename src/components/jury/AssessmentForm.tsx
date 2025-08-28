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
    <div className="space-y-6">
      {/* Student Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={student.photo_url} alt={student.name} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-2xl font-bold">{student.name}</h2>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {student.position}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>Serial: <span className="font-medium">{student.serial_number}</span></div>
                <div>Party: <span className="font-medium">{student.party_number}</span></div>
                <div>Constituency: <span className="font-medium">{student.constituency}</span></div>
                <div>State: <span className="font-medium">{student.state}</span></div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{total}</div>
              <div className="text-sm text-muted-foreground">out of {maxTotal}</div>
              <Progress value={percentage} className="mt-2 w-24" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Assessment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{seatRole.replace('_', ' ').toUpperCase()} Assessment Rubric</span>
            {lastSaved && (
              <span className="text-sm text-muted-foreground">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(rubric).map(([criteriaKey, criteria]) => (
            <div key={criteriaKey} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{criteria.name}</h3>
                <span className="text-sm text-muted-foreground">
                  {criteria.subcriteria 
                    ? `${Object.values(scores[criteriaKey] || {}).reduce((a: number, b: number) => a + b, 0)} / ${criteria.maxScore}`
                    : `${scores[criteriaKey] || 0} / ${criteria.maxScore}`
                  }
                </span>
              </div>

              {criteria.subcriteria ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                  {Object.entries(criteria.subcriteria).map(([subKey, maxScore]) => (
                    <div key={subKey} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium capitalize">
                          {getSubcriteriaLabel(criteriaKey, subKey)}
                        </label>
                        <span className="text-sm">
                          {scores[criteriaKey]?.[subKey] || 0} / {maxScore}
                        </span>
                      </div>
                      <Slider
                        value={[scores[criteriaKey]?.[subKey] || 0]}
                        onValueChange={([value]) => updateScore(criteriaKey, value, subKey)}
                        max={maxScore}
                        step={1}
                        className="w-full"
                        disabled={isLocked || initialStatus === 'locked'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <Slider
                    value={[scores[criteriaKey] || 0]}
                    onValueChange={([value]) => updateScore(criteriaKey, value)}
                    max={criteria.maxScore}
                    step={1}
                    className="w-full"
                    disabled={isLocked || initialStatus === 'locked'}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Notes Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional observations or comments..."
              rows={4}
              disabled={isLocked || initialStatus === 'locked'}
            />
          </div>

          {/* Action Buttons */}
          {!isLocked && initialStatus !== 'locked' && (
            <div className="flex space-x-4 pt-4">
              <Button
                onClick={() => handleSubmit('draft')}
                variant="outline"
                disabled={isSubmitting}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSubmit('submitted')}
                disabled={isSubmitting || total === 0}
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Assessment
              </Button>
              {initialStatus === 'submitted' && (
                <Button variant="ghost" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Submitted
                </Button>
              )}
            </div>
          )}

          {(isLocked || initialStatus === 'locked') && (
            <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
              <Lock className="w-4 h-4" />
              <span className="text-sm">This assessment has been locked by the organizer.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};