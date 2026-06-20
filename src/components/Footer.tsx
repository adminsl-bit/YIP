import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-surface-container-low dark:bg-surface-container-highest border-t border-outline-variant/20">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-4">

        {/* Main row */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <Link to="/" className="text-lg font-black text-primary dark:text-white font-headline tracking-tighter shrink-0">
            Young Indians Parliament
          </Link>

          {/* Nav links — forced single line with scroll on very small screens */}
          <div className="flex items-center gap-5 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <Link to="/about"   className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">The Mission</Link>
            <Link to="/sessions" className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Sessions</Link>
            <Link to="/results"  className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Recognitions</Link>
            <Link to="/faq"      className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">FAQ</Link>
            <Link to="/privacy"  className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Privacy Policy</Link>
            <Link to="/terms"    className="text-on-surface-variant dark:text-slate-400 font-bold text-xs hover:text-primary transition-colors uppercase tracking-widest">Terms</Link>
          </div>

          <div className="text-on-surface-variant dark:text-slate-400 font-medium text-xs shrink-0">
            © 2026 Young Indians Parliament.
          </div>
        </div>

        {/* Powered by Strawlabs */}
        <div className="flex justify-center items-center border-t border-outline-variant/10 pt-4">
          <a
            href="https://www.strawlabs.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 group"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 group-hover:text-on-surface-variant transition-colors">
              Powered by
            </span>
            <img
              src="/partners/strawlabs-logo.png"
              alt="Strawlabs"
              className="h-8 w-auto object-contain opacity-60 group-hover:opacity-100 transition-opacity"
            />
          </a>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
