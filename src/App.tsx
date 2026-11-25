import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ProfileModal } from './components/ProfileModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { MatrimonyProvider, useMatrimony } from './context/MatrimonyContext';
import { ThemeProvider } from './context/ThemeContext';
import { AboutPage } from './pages/AboutPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ContactUsPage } from './pages/ContactUsPage';
import { CreateProfilePage } from './pages/CreateProfilePage';
import { EducationOccupationPage } from './pages/EducationOccupationPage';
import { FamilyDetailsPage } from './pages/FamilyDetailsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { JatakaDetailsPage } from './pages/JatakaDetailsPage';
import { LoginPage } from './pages/LoginPage';
import { MemberDashboardPage } from './pages/MemberDashboardPage';
import { MembershipPlansPage } from './pages/MembershipPlansPage';
import { PartnerPreferencesPage } from './pages/PartnerPreferencesPage';
import { PersonalDetailsPage } from './pages/PersonalDetailsPage';
import { PhotoGalleryPage } from './pages/PhotoGalleryPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReligionCommunityPage } from './pages/ReligionCommunityPage';
import { SearchMatchesPage } from './pages/SearchMatchesPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { TermsConditionsPage } from './pages/TermsConditionsPage';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const ToastBanner: React.FC = () => {
  const { toastMessage } = useMatrimony();
  if (!toastMessage) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 rounded-xl border border-brand-accent/50 bg-brand px-5 py-3 text-xs font-medium text-white shadow-xl"
    >
      {toastMessage}
    </div>
  );
};

export default function App() {
  return (
    <MatrimonyProvider>
      <ThemeProvider>
        <BrowserRouter>
          <ScrollToTop />
        <div className="flex min-h-screen flex-col bg-canvas text-ink">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/set-password" element={<SetPasswordPage />} />
              <Route path="/dashboard" element={<MemberDashboardPage />} />
              <Route path="/profile/create" element={<CreateProfilePage />} />
              <Route path="/profile/personal" element={<PersonalDetailsPage />} />
              <Route path="/profile/family" element={<FamilyDetailsPage />} />
              <Route path="/profile/religion" element={<ReligionCommunityPage />} />
              <Route path="/profile/education" element={<EducationOccupationPage />} />
              <Route path="/profile/jataka" element={<JatakaDetailsPage />} />
              <Route path="/profile/preferences" element={<PartnerPreferencesPage />} />
              <Route path="/profile/photos" element={<PhotoGalleryPage />} />
              <Route path="/search" element={<SearchMatchesPage />} />
              <Route path="/membership" element={<MembershipPlansPage />} />
              <Route path="/contact" element={<ContactUsPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsConditionsPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route
                path="/admin/profiles"
                element={<AdminDashboardPage initialSection="profiles" />}
              />
              <Route
                path="/admin/profile-approval"
                element={<AdminDashboardPage initialSection="profiles" />}
              />
              <Route
                path="/admin/photo-approval"
                element={<AdminDashboardPage initialSection="photos" />}
              />
              <Route
                path="/admin/reports"
                element={<AdminDashboardPage initialSection="reports" />}
              />
              <Route
                path="/admin/profile-reports"
                element={<AdminDashboardPage initialSection="profile_reports" />}
              />
              <Route
                path="/admin/profile-analytics"
                element={<AdminDashboardPage initialSection="profile_analytics" />}
              />
              <Route
                path="/admin/user-management"
                element={<AdminDashboardPage initialSection="user_management" />}
              />
              <Route
                path="/admin/subscriptions"
                element={<AdminDashboardPage initialSection="subscriptions" />}
              />
              <Route
                path="/admin/membership-plans"
                element={<AdminDashboardPage initialSection="membership_plans" />}
              />
              <Route
                path="/admin/payments"
                element={<AdminDashboardPage initialSection="payments" />}
              />
              <Route
                path="/admin/messages"
                element={<AdminDashboardPage initialSection="messages" />}
              />
              <Route
                path="/admin/master-data"
                element={<AdminDashboardPage initialSection="master_religion" />}
              />
              <Route
                path="/admin/education"
                element={<AdminDashboardPage initialSection="education" />}
              />
              <Route
                path="/admin/locations"
                element={<AdminDashboardPage initialSection="locations" />}
              />
              <Route
                path="/admin/support"
                element={<AdminDashboardPage initialSection="support" />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
          <ProfileModal />
          <ThemeSelectorModal />
          <ToastBanner />
          <OfflineIndicator />
        </div>
        </BrowserRouter>
      </ThemeProvider>
    </MatrimonyProvider>
  );
}
