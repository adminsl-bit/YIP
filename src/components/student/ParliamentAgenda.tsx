import React from 'react';
import { Calendar, Coffee, Mic2, Star, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface AgendaItem {
  time: string;
  session: string;
  type: 'session' | 'break' | 'ceremony' | 'activity';
}

interface DayAgenda {
  day: number;
  date: string;
  duration: string;
  items: AgendaItem[];
}

const agenda: DayAgenda[] = [
  {
    day: 1,
    date: 'Saturday, 15 November 2025',
    duration: '09:00 AM - 06:00 PM',
    items: [
      { time: '09:00 AM', session: 'Registration & Welcome Kit Collection', type: 'session' },
      { time: '10:00 AM', session: 'Opening Ceremony & Keynote Address', type: 'ceremony' },
      { time: '11:30 AM', session: 'Introductory Parliamentary Briefing', type: 'session' },
      { time: '01:00 PM', session: 'Networking Lunch', type: 'break' },
      { time: '02:00 PM', session: 'Session I: Legislative Resolution Drafting', type: 'session' },
      { time: '04:00 PM', session: 'High Tea & Peer Discussion', type: 'break' },
      { time: '04:30 PM', session: 'Mock Debate: Practice Round', type: 'activity' },
      { time: '06:00 PM', session: 'Day 1 Adjournment', type: 'ceremony' },
    ]
  },
  {
    day: 2,
    date: 'Sunday, 16 November 2025',
    duration: '09:30 AM - 05:30 PM',
    items: [
      { time: '09:30 AM', session: 'Morning Briefing & Strategy Alignment', type: 'session' },
      { time: '10:30 AM', session: 'Session II: The Great Debate', type: 'session' },
      { time: '01:00 PM', session: 'Networking Lunch', type: 'break' },
      { time: '02:00 PM', session: 'Voting & Resolution Passing', type: 'activity' },
      { time: '03:30 PM', session: 'Jury Deliberation & Feedback', type: 'session' },
      { time: '04:30 PM', session: 'Awards & Valedictory Ceremony', type: 'ceremony' },
      { time: '05:30 PM', session: 'Grand Finale & Closing', type: 'ceremony' },
    ]
  }
];

export const ParliamentAgenda = () => {
  const getSessionIcon = (type: string) => {
    switch(type) {
      case 'break': return <Coffee className="w-4 h-4" />;
      case 'ceremony': return <Trophy className="w-4 h-4" />;
      case 'activity': return <Star className="w-4 h-4" />;
      default: return <Mic2 className="w-4 h-4" />;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-12 space-y-20">
      {/* Header Section - Editorial Style */}
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 bg-surface-container-highest/50 backdrop-blur-xl rounded-[2.5rem] shadow-inner"
        >
          <Calendar className="w-10 h-10 text-primary" />
        </motion.div>
        <div className="space-y-4">
          <h2 className="text-display-md lg:text-display-lg font-display font-black text-on-surface tracking-[-0.03em] uppercase italic leading-none">
            Grand Assembly <br />
            <span className="text-primary/40">Legislative Agenda</span>
          </h2>
          <div className="flex items-center justify-center gap-4 text-label-lg font-bold uppercase tracking-[0.3em] text-on-surface-variant/40 italic">
            <span>New Delhi</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary/20"></span>
            <span>Nov 15-16, 2025</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {agenda.map((day) => (
          <motion.div 
            key={day.day}
            initial={{ opacity: 0, x: day.day === 1 ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col bg-surface-container-low/40 rounded-[3.5rem] overflow-hidden"
          >
            {/* Day Header - Tonal Layering */}
            <div className="p-10 bg-surface-container-low border-b border-white/5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-primary font-black text-label-sm uppercase tracking-[0.25em]">Day {day.day}</span>
                <h3 className="text-title-lg font-display font-black text-on-surface uppercase italic tracking-tight">
                  {day.date.split(',')[0]}
                </h3>
                <p className="text-on-surface-variant/40 text-label-xs font-bold uppercase tracking-widest">{day.duration}</p>
              </div>
              <div className="w-16 h-16 rounded-[2rem] bg-white/50 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20">
                <span className="text-display-xs font-display font-black text-primary/20 italic">0{day.day}</span>
              </div>
            </div>

            {/* Agenda Items */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="p-6 lg:p-10 space-y-4"
            >
              {day.items.map((item, idx) => (
                <motion.div 
                  key={idx} 
                  variants={itemVariants}
                  className="group relative flex items-center gap-6 p-6 bg-surface-container-lowest/80 rounded-[2.5rem] transition-all hover:bg-surface-container-lowest hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.98]"
                >
                  <div className="flex-shrink-0 w-24">
                    <span className="text-label-sm font-black text-primary uppercase tracking-tighter">
                      {item.time}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className={`p-3 rounded-2xl bg-surface-container-high text-on-surface-variant transition-all group-hover:bg-primary group-hover:text-on-primary group-hover:scale-110 shadow-sm shadow-black/5`}>
                      {getSessionIcon(item.type)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h4 className="font-display font-bold text-body-md text-on-surface group-hover:text-primary transition-colors leading-tight truncate">
                        {item.session}
                      </h4>
                      <span className="text-label-xs font-bold text-on-surface-variant/30 uppercase tracking-widest mt-1">
                        {item.type}
                      </span>
                    </div>
                  </div>

                  {/* Hover Accent */}
                  <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(19,41,143,0.3)]" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Footer Disclaimer - Editorial Style */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="max-w-xl mx-auto"
      >
        <div className="p-8 rounded-[2.5rem] bg-surface-container-high/30 backdrop-blur-sm border border-white/5 text-center space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-primary/20" />)}
          </div>
          <p className="text-label-xs text-on-surface-variant/40 font-black uppercase tracking-[0.25em] leading-relaxed italic">
            Institutional Note: All session timings are indicative and subject to the flow of parliamentary debate. 
            Delegates are expected to remain in the chamber until official adjournment.
          </p>
        </div>
      </motion.div>
    </div>
  );
}