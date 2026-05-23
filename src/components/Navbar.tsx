import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const Navbar = () => {
  const location = useLocation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

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

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 rounded-full w-[90%] max-w-4xl z-50 glass-nav shadow-[0_24px_48px_-15px_rgba(46,65,172,0.12)] flex justify-between items-center px-5 py-1.5 border border-white/20 pointer-events-auto">
      <Link to="/" className="text-lg font-black text-primary dark:text-white tracking-tighter font-headline shrink-0">
        Young Indians Parliament
      </Link>
      
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

      <div className="flex items-center gap-3">
        {user ? (
          <Link to={getDashboardRoute()}>
            <button className="bg-primary text-white px-5 py-1.5 rounded-full font-bold font-headline text-xs md:text-sm hover:scale-[1.02] active:opacity-80 transition-all duration-300 shadow-md shadow-primary/20">
              Enter Parliament
            </button>
          </Link>
        ) : (
          <>
            <Link to="/login" className="text-on-surface-variant font-bold font-headline text-xs md:text-sm hover:text-primary transition-all">
              Login
            </Link>
            <Link to="/register">
              <button className="bg-primary text-white px-5 py-1.5 rounded-full font-bold font-headline text-xs md:text-sm hover:scale-[1.02] active:opacity-80 transition-all duration-300 shadow-md shadow-primary/20">
                Register
              </button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
