import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import AdminStudentDashboard from "./pages/AdminStudentDashboard";
import JuryDashboard from "./pages/JuryDashboard";
import JournalistDashboard from "./pages/JournalistDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import TimerDisplay from "./pages/TimerDisplay";
import SessionDisplay from "./pages/SessionDisplay";
import PollDisplay from "./pages/PollDisplay";
import LeaderboardDisplay from "./pages/LeaderboardDisplay";
import NotFound from "./pages/NotFound";
import { AwardShowcase } from "./pages/AwardShowcase";
import { AuthenticatedRoute } from "./components/AuthenticatedRoute";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import SeedDemoUsers from "./pages/SeedDemoUsers";
import About from "./pages/About";
import Results from "./pages/Results";
import Sessions from "./pages/Sessions";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Disclaimer from "./pages/Disclaimer";
import FAQ from "./pages/FAQ";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/student" element={
              <AuthenticatedRoute>
                <StudentDashboard />
              </AuthenticatedRoute>
            } />
            <Route path="/admin-student" element={
              <RoleProtectedRoute allowedUserType="student" allowedRole="admin_student">
                <AdminStudentDashboard />
              </RoleProtectedRoute>
            } />
            <Route path="/jury" element={
              <RoleProtectedRoute allowedUserType="jury">
                <JuryDashboard />
              </RoleProtectedRoute>
            } />
            <Route path="/journalist" element={
              <RoleProtectedRoute allowedUserType="student" allowedRole="journalist">
                <JournalistDashboard />
              </RoleProtectedRoute>
            } />
            <Route path="/organizer" element={
              <RoleProtectedRoute allowedUserType="organizer">
                <OrganizerDashboard />
              </RoleProtectedRoute>
            } />
            <Route path="/display/timer" element={<SessionDisplay />} />
            <Route path="/display/session" element={<SessionDisplay />} />
            <Route path="/display/polls" element={<PollDisplay />} />
            <Route path="/display/leaderboard" element={<LeaderboardDisplay />} />
            <Route path="/display/awards" element={<AwardShowcase />} />
            <Route path="/seed-demo" element={<SeedDemoUsers />} />
            {/* Public info pages */}
            <Route path="/about" element={<About />} />
            <Route path="/results" element={<Results />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/faq" element={<FAQ />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;