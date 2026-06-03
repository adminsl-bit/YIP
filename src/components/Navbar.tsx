import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const location = useLocation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "The Mission", to: "/about" },
    { label: "Sessions", to: "/sessions" },
    { label: "Recognitions", to: "/results" },
    { label: "FAQ", to: "/faq" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const getDashboardRoute = () => {
    if (!user || !profile?.user_type) return "/login";
    switch (profile.user_type) {
      case "student": return "/student";
      case "jury": return "/jury";
      case "organizer": return "/organizer";
      default: return "/login";
    }
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 rounded-full w-[92%] max-w-4xl z-50 glass-nav shadow-[0_24px_48px_-15px_rgba(46,65,172,0.12)] flex justify-between items-center px-5 py-1.5 border border-white/20 pointer-events-auto">
        <Link to="/" onClick={closeMobile} className="text-sm md:text-lg font-black text-primary dark:text-white tracking-tighter font-headline shrink-0">
          Young Indians Parliament
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex gap-4 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              className={`font-headline font-medium tracking-tight text-sm transition-all duration-300 ${
                isActive(link.to)
                  ? "text-primary border-b-2 border-primary pb-0.5"
                  : "text-on-surface-variant hover:scale-[1.02] hover:text-primary"
              }`}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link to={getDashboardRoute()}>
              <button className="bg-primary text-white px-5 py-1.5 rounded-full font-bold font-headline text-sm hover:scale-[1.02] active:opacity-80 transition-all duration-300 shadow-md shadow-primary/20">
                Enter Parliament
              </button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-on-surface-variant font-bold font-headline text-sm hover:text-primary transition-all">
                Login
              </Link>
              <Link to="/register">
                <button className="bg-primary text-white px-5 py-1.5 rounded-full font-bold font-headline text-sm hover:scale-[1.02] active:opacity-80 transition-all duration-300 shadow-md shadow-primary/20">
                  Register
                </button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-primary/8 transition-colors"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className="material-symbols-outlined text-primary text-[22px]">
            {mobileOpen ? "close" : "menu"}
          </span>
        </button>
      </nav>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-40 bg-white/95 backdrop-blur-xl rounded-[1.5rem] shadow-2xl shadow-primary/10 border border-white/30 p-5 flex flex-col gap-1"
          >
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMobile}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-headline font-semibold text-sm transition-all ${
                  isActive(link.to)
                    ? "bg-primary/8 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-outline-variant/20 mt-2 pt-3 flex flex-col gap-2">
              {user ? (
                <Link to={getDashboardRoute()} onClick={closeMobile}>
                  <button className="w-full bg-primary text-white px-5 py-3 rounded-xl font-bold font-headline text-sm shadow-md shadow-primary/20">
                    Enter Parliament
                  </button>
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={closeMobile} className="flex items-center justify-center px-5 py-3 rounded-xl border border-outline-variant/30 font-bold font-headline text-sm text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all">
                    Login
                  </Link>
                  <Link to="/register" onClick={closeMobile}>
                    <button className="w-full bg-primary text-white px-5 py-3 rounded-xl font-bold font-headline text-sm shadow-md shadow-primary/20">
                      Register
                    </button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay to close mobile menu */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default Navbar;
