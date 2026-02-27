import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import BrandsPage from './pages/BrandsPage';
import CampaignsPage from './pages/CampaignsPage';
import VouchersPage from './pages/VouchersPage';
import LotteryPage from './pages/LotteryPage';
import BotsPage from './pages/BotsPage';
import BroadcastPage from './pages/BroadcastPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/brands" element={<BrandsPage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/vouchers" element={<VouchersPage />} />
                <Route path="/lottery" element={<LotteryPage />} />
                <Route path="/bots" element={<BotsPage />} />
                <Route path="/broadcast" element={<BroadcastPage />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
