import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const location = useLocation();
  const { user, profile } = useAuth();

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
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 rounded-full w-[90%] max-w-7xl z-50 glass-nav shadow-[0_32px_64px_-15px_rgba(46,65,172,0.15)] flex justify-between items-center px-8 py-3 border border-white/20">
      <Link to="/" className="hover:opacity-80 transition-opacity">
        <div className="text-xl font-black text-[#2E41AC] tracking-tighter font-headline">
          Young Indians Parliament
        </div>
      </Link>

      <div className="hidden md:flex gap-8 items-center">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            className={`font-headline text-sm font-semibold tracking-tight transition-all duration-300 ${
              isActive(link.to)
                ? "text-[#2E41AC] border-b-2 border-[#2E41AC] pb-1"
                : "text-slate-600 hover:scale-105 hover:text-[#2E41AC]"
            }`}
            to={link.to}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <Link to={getDashboardRoute()}>
            <button className="bg-[#2E41AC] text-white px-6 py-2 rounded-full font-bold font-headline hover:scale-105 active:opacity-80 transition-all duration-300 shadow-lg shadow-primary/20">
              Enter Parliament
            </button>
          </Link>
        ) : (
          <>
            <Link to="/login" className="text-slate-600 font-bold font-headline text-sm hover:text-[#2E41AC] transition-all">
              Login
            </Link>
            <Link to="/register">
              <button className="bg-[#2E41AC] text-white px-6 py-2 rounded-full font-bold font-headline hover:scale-105 active:opacity-80 transition-all duration-300 shadow-lg shadow-primary/20">
                Register 2026
              </button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
