import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-slate-50 border-t border-slate-200/30">
      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="text-xl font-black text-[#2E41AC] font-headline tracking-tighter">
              Young Indians Parliament
            </div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hidden md:block">
              The Digital Diplomat Initiative
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <Link className="text-slate-500 font-bold text-[10px] hover:text-[#2E41AC] transition-colors uppercase tracking-[0.2em]" to="/privacy-policy">Privacy</Link>
            <Link className="text-slate-500 font-bold text-[10px] hover:text-[#2E41AC] transition-colors uppercase tracking-[0.2em]" to="/terms">Terms</Link>
            <Link className="text-slate-500 font-bold text-[10px] hover:text-[#2E41AC] transition-colors uppercase tracking-[0.2em]" to="/results">Results</Link>
            <Link className="text-slate-500 font-bold text-[10px] hover:text-[#2E41AC] transition-colors uppercase tracking-[0.2em]" to="/faq">FAQ</Link>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">
              © 2026 Young Indians Parliament
            </div>
            <div className="text-slate-400 font-medium text-[9px] uppercase tracking-[0.3em]">
              Powered by <span className="text-[#2E41AC]">Strawlabs</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
