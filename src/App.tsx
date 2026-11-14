import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { CustomerLayout } from './layouts/CustomerLayout';
import LandingPage from './pages/LandingPage';
import CustomerReviewPage from './pages/CustomerReviewPage';
import BusinessDashboard from './pages/BusinessDashboard';
import BusinessSetupPage from './pages/BusinessSetupPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<BusinessDashboard />} />
          <Route path="/setup" element={<BusinessSetupPage />} />
        </Route>
        <Route element={<CustomerLayout />}>
          <Route path="/r/:businessSlug" element={<CustomerReviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
