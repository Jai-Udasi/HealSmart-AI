import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SymptomCheckerPage from './pages/SymptomCheckerPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import DashboardPage from './pages/DashboardPage';
import { GlassCard } from './components/UI';

function NotFoundPage() {
  return (
    <GlassCard style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>404 — Page Not Found</h1>
      <p className="page-description" style={{ marginBottom: '1.25rem' }}>
        The requested route does not exist in HealSmartAI.
      </p>
      <Link to="/" className="btn btn-primary">
        Return Home
      </Link>
    </GlassCard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="symptoms" element={<SymptomCheckerPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
