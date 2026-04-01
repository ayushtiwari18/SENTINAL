import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout        from './components/AppLayout';
import Landing         from './pages/Landing';
import Dashboard       from './pages/Dashboard';
import Attacks         from './pages/Attacks';
import ForensicsPage   from './pages/ForensicsPage';
import Alerts          from './pages/Alerts';
import Logs            from './pages/Logs';
import Services        from './pages/Services';
import Settings        from './pages/Settings';
import Docs            from './pages/Docs';
import PcapAnalyzer    from './pages/PcapAnalyzer';
import ActionQueuePage from './pages/ActionQueuePage';
import AuditLog        from './pages/AuditLog';
import SimulateAttack  from './pages/SimulateAttack';
import ExplorePage     from './pages/ExplorePage';
import CopilotPage     from './pages/CopilotPage';
import CorrelationPage from './pages/CorrelationPage';
import NotFound        from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/explore"       element={<ExplorePage />} />
          <Route path="/attacks"       element={<Attacks />} />
          <Route path="/attacks/:id"   element={<ForensicsPage />} />
          <Route path="/alerts"        element={<Alerts />} />
          <Route path="/logs"          element={<Logs />} />
          <Route path="/pcap"          element={<PcapAnalyzer />} />
          <Route path="/services"      element={<Services />} />
          <Route path="/settings"      element={<Settings />} />
          <Route path="/docs"          element={<Docs />} />
          <Route path="/action-queue"  element={<ActionQueuePage />} />
          <Route path="/audit"         element={<AuditLog />} />
          <Route path="/simulate"      element={<SimulateAttack />} />
          {/* Gemini AI features */}
          <Route path="/copilot"       element={<CopilotPage />} />
          <Route path="/correlation"   element={<CorrelationPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
