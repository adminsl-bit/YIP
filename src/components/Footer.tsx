import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-surface-container-low dark:bg-surface-container-highest border-t border-outline-variant/20">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
        <Link to="/" className="text-lg font-black text-primary dark:text-white font-headline tracking-tighter">
          Young Indians Parliament
        </Link>
        <div className="flex flex-wrap justify-center gap-6">
          <Link to="/about" className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">The Mission</Link>
          <Link to="/sessions" className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Sessions</Link>
          <Link to="/results" className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Recognitions</Link>
          <Link to="/faq" className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">FAQ</Link>
          <Link to="/privacy" className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Privacy Policy</Link>
          <Link to="/terms" className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Terms of Service</Link>
        </div>
        <div className="text-on-surface-variant dark:text-slate-400 font-medium text-xs">
          © 2026 Young Indians Parliament.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
