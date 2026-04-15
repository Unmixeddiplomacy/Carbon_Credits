import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import HomePage from "./pages/dashboard/HomePage.jsx";
import MarketplacePage from "./pages/marketplace/MarketplacePage.jsx";
import CreditsPage from "./pages/credits/CreditsPage.jsx";
import VerificationPage from "./pages/verification/VerificationPage.jsx";
import MyTreesPage from "./pages/my-trees/MyTreesPage.jsx";
import TransactionsPage from "./pages/transactions/TransactionsPage.jsx";
import SidebarLayout from "./components/layout/SidebarLayout.jsx";
import PublicLayout from "./components/layout/PublicLayout.jsx";
import SupportPage from "./pages/SupportPage.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import NonAdminRoute from "./components/NonAdminRoute.jsx";

function App() {
  return (
    <Routes>
      {/* Public pages with public layout */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Authenticated pages with sidebar layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<SidebarLayout />}>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>

          <Route element={<NonAdminRoute />}>
            <Route path="/app" element={<HomePage />} />
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/credits" element={<CreditsPage />} />
            <Route path="/verification" element={<VerificationPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/my-trees" element={<MyTreesPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/app/support" element={<SupportPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;