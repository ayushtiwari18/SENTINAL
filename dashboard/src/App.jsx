import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout    from './components/AppLayout';
import Landing      from './pages/Landing';
import Dashboard   from './pages/Dashboard';
import Attacks     from './pages/Attacks';
import ForensicsPage from './pages/ForensicsPage';
import Alerts      from './pages/Alerts';
import Logs        from './pages/Logs';
import Services    from './pages/Services';
import Settings    from './pages/Settings';
import Docs        from './pages/Docs';
import NotFound    from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/attacks"   element={<Attacks />} />
          <Route path="/attacks/:id" element={<ForensicsPage />} />
          <Route path="/alerts"    element={<Alerts />} />
          <Route path="/logs"      element={<Logs />} />
          <Route path="/services"  element={<Services />} />
          <Route path="/settings"  element={<Settings />} />
          <Route path="/docs"      element={<Docs />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
