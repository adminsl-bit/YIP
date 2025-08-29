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
    date: "Day 1 Structure",
    duration: "9:00 AM to 4:00 PM",
    items: [
      { time: "09:00 – 09:03", session: "National Anthem", type: "ceremony" },
      { time: "09:03 – 09:06", session: "Yi Anthem", type: "ceremony" },
      { time: "09:06 – 09:45", session: "Inaugural Ceremony", type: "ceremony" },
      { time: "09:45 – 09:47", session: "Oath of Affirmation", type: "ceremony" },
      { time: "09:47 – 10:00", session: "Break for re-organizing the House", type: "break" },
      { time: "10:00 – 11:55", session: "Question Hour", type: "session" },
      { time: "11:55 – 12:05", session: "Tea Break", type: "break" },
      { time: "12:05 – 01:05", session: "Zero Hour", type: "session" },
      { time: "01:05 – 02:00", session: "Lunch Break", type: "break" },
      { time: "02:00 – 03:45", session: "Committee Presentation, Debates & Discussions (Committees led by Cabinet Ministers)", type: "discussion" },
      { time: "03:45 – 04:00", session: "Day Adjournment", type: "ceremony" }
    ]
  },
  {
    day: 2,
    date: "Day 2 Structure",
    duration: "9:30 AM to 5:00 PM",
    items: [
      { time: "09:30 – 11:30", session: "Question Hour (Day 2)", type: "session" },
      { time: "11:30 – 11:45", session: "Tea Break", type: "break" },
      { time: "11:45 – 01:15", session: "Private Members Bill (Debated & Voted)", type: "voting" },
      { time: "01:15 – 02:15", session: "Lunch Break", type: "break" },
      { time: "02:15 – 03:45", session: "Bills Presentation, Debates & Discussions (Ruling Bills)", type: "discussion" },
      { time: "03:45 – 04:15", session: "Observations by Administrators (Review on the key contents discussed)", type: "session" },
      { time: "04:15 – 04:45", session: "Closing Remarks by Prime Minister & Leader of Opposition", type: "ceremony" },
      { time: "04:45 – 05:00", session: "Valedictory Session & National Anthem", type: "ceremony" }
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