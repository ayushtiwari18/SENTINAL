import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy-loaded pages
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const Attacks         = lazy(() => import('./pages/Attacks'));
const Alerts          = lazy(() => import('./pages/Alerts'));
const ActionQueuePage = lazy(() => import('./pages/ActionQueuePage'));
const Blocklist       = lazy(() => import('./pages/Blocklist'));
const AuditLog        = lazy(() => import('./pages/AuditLog'));
const PcapAnalyzer    = lazy(() => import('./pages/PcapAnalyzer'));
const CopilotPage     = lazy(() => import('./pages/CopilotPage'));
const CorrelationPage = lazy(() => import('./pages/CorrelationPage'));
const SimulateAttack  = lazy(() => import('./pages/SimulateAttack'));
const ForensicsPage   = lazy(() => import('./pages/ForensicsPage'));
const ExplorePage     = lazy(() => import('./pages/ExplorePage'));
const Services        = lazy(() => import('./pages/Services'));
const Logs            = lazy(() => import('./pages/Logs'));
const Settings        = lazy(() => import('./pages/Settings'));
const Landing         = lazy(() => import('./pages/Landing'));
const Docs            = lazy(() => import('./pages/Docs'));
const NotFound        = lazy(() => import('./pages/NotFound'));
const GeoThreatMap    = lazy(() => import('./pages/GeoThreatMap')); // ← NEW

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
  </div>
);

export default function App() {
  return (
    <Router>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"         element={<Landing />} />
          <Route path="/docs"     element={<Docs />} />
          <Route element={<Layout />}>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/attacks"      element={<Attacks />} />
            <Route path="/alerts"       element={<Alerts />} />
            <Route path="/action-queue" element={<ActionQueuePage />} />
            <Route path="/blocklist"    element={<Blocklist />} />
            <Route path="/audit"        element={<AuditLog />} />
            <Route path="/pcap"         element={<PcapAnalyzer />} />
            <Route path="/copilot"      element={<CopilotPage />} />
            <Route path="/correlation"  element={<CorrelationPage />} />
            <Route path="/simulate"     element={<SimulateAttack />} />
            <Route path="/forensics"    element={<ForensicsPage />} />
            <Route path="/explore"      element={<ExplorePage />} />
            <Route path="/services"     element={<Services />} />
            <Route path="/logs"         element={<Logs />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="/geo"          element={<GeoThreatMap />} /> {/* ← NEW */}
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
