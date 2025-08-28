import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import JuryDashboard from "./pages/JuryDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import TimerDisplay from "./pages/TimerDisplay";
import PollDisplay from "./pages/PollDisplay";
import LeaderboardDisplay from "./pages/LeaderboardDisplay";
import NotFound from "./pages/NotFound";
import { AuthenticatedRoute } from "./components/AuthenticatedRoute";

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
            <Route path="/jury" element={
              <AuthenticatedRoute>
                <JuryDashboard />
              </AuthenticatedRoute>
            } />
            <Route path="/organizer" element={
              <AuthenticatedRoute>
                <OrganizerDashboard />
              </AuthenticatedRoute>
            } />
            <Route path="/display/timer" element={<TimerDisplay />} />
            <Route path="/display/polls" element={<PollDisplay />} />
            <Route path="/display/leaderboard" element={<LeaderboardDisplay />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;