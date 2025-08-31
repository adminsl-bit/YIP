import { Clock, Calendar, Coffee, Gavel, Users, FileText, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AgendaItem {
  time: string;
  session: string;
  type: 'ceremony' | 'break' | 'session' | 'discussion' | 'voting';
}

interface DaySchedule {
  day: number;
  date: string;
  duration: string;
  items: AgendaItem[];
}

const getSessionIcon = (type: string) => {
  switch (type) {
    case 'ceremony':
      return <Gavel className="w-4 h-4" />;
    case 'break':
      return <Coffee className="w-4 h-4" />;
    case 'session':
      return <MessageSquare className="w-4 h-4" />;
    case 'discussion':
      return <Users className="w-4 h-4" />;
    case 'voting':
      return <FileText className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getSessionColor = (type: string) => {
  switch (type) {
    case 'ceremony':
      return 'bg-gradient-to-r from-purple-500 to-indigo-600';
    case 'break':
      return 'bg-gradient-to-r from-green-500 to-emerald-600';
    case 'session':
      return 'bg-gradient-to-r from-blue-500 to-cyan-600';
    case 'discussion':
      return 'bg-gradient-to-r from-orange-500 to-red-600';
    case 'voting':
      return 'bg-gradient-to-r from-pink-500 to-rose-600';
    default:
      return 'bg-gradient-to-r from-gray-500 to-slate-600';
  }
};

const scheduleData: DaySchedule[] = [
  {
    day: 1,
    date: "YIP 2.0 SRTN Regional Day 1 Agenda",
    duration: "9:00 AM to 5:00 PM",
    items: [
      { time: "9:00 AM - 9:30 AM", session: "0. Technical Demo", type: "session" },
      { time: "9:30 - 10:15 AM", session: "1. Inaugural Event", type: "ceremony" },
      { time: "10:16 AM onwards", session: "2. Floor officially handed over to the event chairman", type: "ceremony" },
      { time: "10:16 - 10:30 AM", session: "3. Introduction of the 7 Political Parties", type: "ceremony" },
      { time: "10:30 - 10:45 AM", session: "4. Oath of Affirmation", type: "ceremony" },
      { time: "10:45 - 11:00 AM", session: "5. Tea Break & break for reorganizing the house", type: "break" },
      { time: "11:00 AM - 12:55 PM", session: "6. Question Hour", type: "session" },
      { time: "1:00 - 2:00 PM", session: "7. Lunch Break", type: "break" },
      { time: "2:00 - 3:00 PM", session: "8. Zero Hour", type: "session" },
      { time: "3:00 - 4:45 PM", session: "9. Committee Presentation, Debates & Discussion (committees led by cabinet ministers)", type: "discussion" },
      { time: "4:45 - 5:00 PM", session: "10. Day 1 Adjournment with High Tea", type: "ceremony" }
    ]
  },
  {
    day: 2,
    date: "31st August 2025 Host: Yi Madurai - YIP 2.0 SRTN Regional Day 2 Agenda",
    duration: "8:30 AM to 5:30 PM",
    items: [
      { time: "8:30 AM - 10:00 AM", session: "11. Committee Presentation, Debates & Discussion (committees led by cabinet ministers)", type: "discussion" },
      { time: "10:00 AM - 11:00 AM", session: "12. Question Hour", type: "session" },
      { time: "11:00 AM - 11:15 AM", session: "13. Tea Break", type: "break" },
      { time: "11:15 AM - 12:15 AM", session: "14. Private Members Bill (Debated & Voted)", type: "voting" },
      { time: "12:15 PM - 1:15 PM", session: "15. Zero Hour", type: "session" },
      { time: "1:15 PM - 2:15 PM", session: "16. Lunch Break", type: "break" },
      { time: "2:15 PM - 3:45 PM", session: "17. Bills Presentation Debates and Discussion (Ruling Bills)", type: "discussion" },
      { time: "3:45 PM - 4:15 PM", session: "18. Observation by administrators (review on key contents discussed)", type: "session" },
      { time: "4:15 PM - 4:30 PM", session: "19. Closing remarks by prime minister and leader of opposition", type: "ceremony" },
      { time: "4:30 - 5:30 PM", session: "20. Valedictory Ceremony & National Anthem", type: "ceremony" },
      { time: "5:30 PM", session: "High Tea", type: "break" }
    ]
  }
];

export const ParliamentAgenda = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
            <Calendar className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">Parliament Agenda</h2>
            <p className="text-muted-foreground">Technical Session Flow</p>
          </div>
        </div>
      </div>

      {/* Schedule Cards */}
      <div className="grid gap-8">
        {scheduleData.map((day) => (
          <Card key={day.day} className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className={`${getSessionColor('ceremony')} text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-white">
                    {day.date}
                  </CardTitle>
                  <p className="text-white/90 mt-1">{day.duration}</p>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  Day {day.day}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="space-y-0">
                {day.items.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-start gap-4 p-6 hover:bg-muted/30 transition-colors">
                      {/* Time Badge */}
                      <div className="flex-shrink-0">
                        <Badge 
                          variant="outline" 
                          className="px-3 py-1 text-sm font-mono bg-background border-muted-foreground/20"
                        >
                          {item.time}
                        </Badge>
                      </div>

                      {/* Session Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${getSessionColor(item.type)} text-white`}>
                            {getSessionIcon(item.type)}
                          </div>
                          <h3 className="font-semibold text-foreground leading-tight">
                            {item.session}
                          </h3>
                        </div>
                      </div>

                      {/* Session Type Indicator */}
                      <div className="flex-shrink-0">
                        <Badge 
                          variant="secondary"
                          className="capitalize text-xs"
                        >
                          {item.type}
                        </Badge>
                      </div>
                    </div>
                    
                    {index < day.items.length - 1 && (
                      <Separator className="ml-6" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer Note */}
      <div className="text-center p-6 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          All timings are indicative. Please stay updated with any announcements during the session.
        </p>
      </div>
    </div>
  );
};