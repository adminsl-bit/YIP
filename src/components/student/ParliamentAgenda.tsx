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
    date: "15 November 2025 (Saturday)",
    duration: "8:00 AM to 5:30 PM",
    items: [
      { time: "08:00", session: "Registration & Networking Breakfast", type: "break" },
      { time: "08:45 - 09:00", session: "Inauguration & Oath of Affirmation - Formal opening; all MPs inducted into the House", type: "ceremony" },
      { time: "09:00 - 10:30", session: "Voice of the Nation – Special Address Series on the Central Theme - Party Leaders, Shadow Ministers, Cabinet Ministers, Leader of Opposition, and Prime Minister share their visions", type: "session" },
      { time: "10:30 - 10:45", session: "Networking & Tea Break", type: "break" },
      { time: "10:45 - 13:00", session: "Question Hour (6 mins per question) - 14 starred/pre-selected questions with 5-6 surprise inclusions", type: "session" },
      { time: "13:00 - 13:45", session: "Lunch & Cross-Party Consultations - Journalists interact with members and collect statements", type: "break" },
      { time: "13:45 - 15:00", session: "Government Bills (20 min each) - Ministers present bills, members debate, and voting takes place", type: "voting" },
      { time: "15:00 - 15:05", session: "Opening Remarks by Ms Sangeetha Muthuavinashiappan, Chair-Thalir", type: "ceremony" },
      { time: "15:05 - 15:15", session: "Welcome Address by Mr Tarang Khurana, Yi National Chairman", type: "ceremony" },
      { time: "15:15 - 15:35", session: "Inaugural Address by Chief Guest Shri Baijayant Panda, Hon'ble Member of Parliament", type: "ceremony" },
      { time: "15:35 - 15:40", session: "Vote of Thanks by Mr Aseem Abhyankar, Co-Chair-Thalir", type: "ceremony" },
      { time: "16:00 - 17:00", session: "Government Bills (Continued) - Remaining government bills presentation, debate, and voting", type: "voting" },
      { time: "17:00", session: "Adjournment - Speaker closes proceedings of the day", type: "ceremony" },
      { time: "17:00 - 17:30", session: "High Tea - End of Program on Day I", type: "break" }
    ]
  },
  {
    day: 2,
    date: "16 November 2025 (Sunday)",
    duration: "8:00 AM to 5:00 PM",
    items: [
      { time: "08:00", session: "Reporting & Breakfast - Arrival at India Habitat Centre with breakfast served at venue", type: "break" },
      { time: "09:00 - 11:00", session: "Private Members' Bills (15 min each) - Private member bills presentation, debate, and voting", type: "voting" },
      { time: "11:00 - 12:45", session: "Committee Reports (15 min each) - Committees present reports; House debates and discusses each point", type: "discussion" },
      { time: "12:45 - 13:30", session: "Lunch & Networking - Journalists interact with members and collect statements", type: "break" },
      { time: "13:30 - 15:15", session: "Zero Hour - Breaking news items circulated; members share views, ministers and shadow ministers respond, PM gives final remarks", type: "session" },
      { time: "15:15 - 15:30", session: "Administrator Observations & closing remarks by LoP, PM and Speakers - Visionary reflections on The Assembly experience", type: "ceremony" },
      { time: "15:30 - 15:40", session: "Valedictory Session: Remarks by Ms Sangeetha Muthuavinashiappan", type: "ceremony" },
      { time: "15:40 - 15:50", session: "Valedictory Session: Remarks by Mr Aseem Abhyankar", type: "ceremony" },
      { time: "15:50 - 16:00", session: "Valedictory Session: Special Remarks by Mr Darshan Mutha, Mentor, The Assembly & Chair-Accessibility", type: "ceremony" },
      { time: "16:00 - 16:55", session: "Recognition to Winners", type: "ceremony" },
      { time: "16:55 - 17:00", session: "Concluding & Vote of thanks by Mr Aseem Abhyankar - End of the Program", type: "ceremony" }
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
            <h2 className="text-3xl font-headline font-black text-foreground">Grand Assembly Agenda</h2>
            <p className="text-muted-foreground font-body">15-16 November 2025, New Delhi</p>
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
                  <CardTitle className="text-2xl font-headline font-bold text-white">
                    {day.date}
                  </CardTitle>
                  <p className="text-white/90 mt-1 font-body">{day.duration}</p>
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
                          <h3 className="font-headline font-semibold text-foreground leading-tight">
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
        <p className="text-sm text-muted-foreground font-body">
          All timings are indicative. Please stay updated with any announcements during the session.
        </p>
      </div>
    </div>
  );
};