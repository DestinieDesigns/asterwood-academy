import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Mascot } from "./components/Mascot";
import { AppShell } from "./components/AppShell";
import { useApp } from "./lib/store";
import { Landing } from "./pages/Landing";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { Tutor } from "./pages/Tutor";
import { LibraryWorld } from "./pages/LibraryWorld";
import { BookReader } from "./pages/BookReader";
import { Quests } from "./pages/Quests";
import { Achievements } from "./pages/Achievements";
import { Curator } from "./pages/Curator";
import { Reports } from "./pages/Reports";
import { Lessons } from "./pages/Lessons";
import { LessonView } from "./pages/LessonView";
import { Practice } from "./pages/Practice";
import { QuizView } from "./pages/QuizView";
import { Library } from "./pages/Library";
import { Progress } from "./pages/Progress";
import { Schedule } from "./pages/Schedule";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { Family, FamilySetup } from "./pages/Family";
import { Academy } from "./pages/Academy";
import { Studio } from "./pages/Studio";
import { Characters } from "./pages/Characters";

// Three.js and the academy world load only when the learner enters it.
const Adventure = lazy(() => import("./pages/Adventure").then((module) => ({ default: module.Adventure })));

export default function App() {
  const { ready, user, learner, meta } = useApp();

  if (!ready) {
    return (
      <div className="loading" style={{ minHeight: "100vh", flexDirection: "column" }}>
        <Mascot size={96} mood="happy" />
        <span>Waking up your tutor…</span>
      </div>
    );
  }

  // A static deployment has the interface but no Bun API behind it. Show the
  // landing page with an honest notice rather than spinning forever.
  if (!meta) return <Landing />;

  if (!user) return <Landing />;

  const isFamilyAccount = user.role === "parent" || user.role === "educator";
  if (!learner) {
    return isFamilyAccount ? <FamilySetup /> : <Navigate to="/" replace />;
  }

  if (!learner.onboarded) return <Onboarding />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tutor" element={<Tutor />} />
        <Route
          path="/adventure"
          element={
            <Suspense fallback={<div className="loading" style={{ minHeight: "70vh" }}><Mascot size={80} mood="happy" /><span>Opening the academy…</span></div>}>
              <Adventure />
            </Suspense>
          }
        />
        <Route path="/world" element={<LibraryWorld />} />
        <Route path="/world/:bookId" element={<BookReader />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/curator" element={<Curator />} />
        <Route path="/subjects" element={<Navigate to="/world" replace />} />
        <Route path="/lessons" element={<Lessons />} />
        <Route path="/lessons/:id" element={<LessonView />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:id" element={<QuizView />} />
        <Route path="/library" element={<Library />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/academy" element={<Academy />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/characters" element={<Characters />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/family" element={isFamilyAccount ? <Family /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
