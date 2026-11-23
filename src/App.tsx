import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { MainLayout } from './layouts/MainLayout';
import { CustomerLayout } from './layouts/CustomerLayout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import CustomerReviewPage from './pages/CustomerReviewPage';
import CustomerRestaurantMenuPage from './pages/CustomerRestaurantMenuPage';
import RestaurantStaffVerificationPage from './pages/RestaurantStaffVerificationPage';
import RestaurantKitchenDisplayPage from './pages/RestaurantKitchenDisplayPage';
import CustomerBarberQueuePage from './pages/CustomerBarberQueuePage';
import BarberStaffQueuePage from './pages/BarberStaffQueuePage';
import CustomerGymPage from './pages/CustomerGymPage';
import CustomerCafeHubPage from './pages/CustomerCafeHubPage';
import BusinessDashboard from './pages/BusinessDashboard';
import BarberOwnerDashboardPage from './pages/BarberOwnerDashboardPage';
import GymOwnerDashboardPage from './pages/GymOwnerDashboardPage';
import CafeOwnerDashboardPage from './pages/CafeOwnerDashboardPage';
import BusinessSetupPage from './pages/BusinessSetupPage';
import AdminPanelPage from './pages/admin/AdminPanelPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPanelPage />
              </RequireAuth>
            }
          />
          <Route element={<MainLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <BusinessDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/cafe/dashboard"
              element={
                <RequireAuth>
                  <CafeOwnerDashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/barber/dashboard"
              element={
                <RequireAuth>
                  <BarberOwnerDashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/gym/dashboard"
              element={
                <RequireAuth>
                  <GymOwnerDashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/setup"
              element={
                <RequireAuth>
                  <BusinessSetupPage />
                </RequireAuth>
              }
            />
          </Route>
          <Route
            path="/r/:businessSlug/kitchen"
            element={<RestaurantKitchenDisplayPage />}
          />
          <Route element={<CustomerLayout />}>
            <Route path="/r/:businessSlug" element={<CustomerReviewPage />} />
            <Route
              path="/r/:businessSlug/menu"
              element={<CustomerRestaurantMenuPage />}
            />
            <Route
              path="/r/:businessSlug/table/:tableKey"
              element={<CustomerRestaurantMenuPage />}
            />
            <Route
              path="/r/:businessSlug/staff"
              element={<RestaurantStaffVerificationPage />}
            />
            <Route
              path="/r/:businessSlug/queue"
              element={<CustomerBarberQueuePage />}
            />
            <Route
              path="/r/:businessSlug/barber-staff"
              element={<BarberStaffQueuePage />}
            />
            <Route
              path="/r/:businessSlug/gym"
              element={<CustomerGymPage />}
            />
            <Route
              path="/r/:businessSlug/cafe"
              element={<CustomerCafeHubPage />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
