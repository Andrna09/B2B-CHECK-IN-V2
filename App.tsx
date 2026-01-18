import React, { useState } from 'react';
import Layout from './components/Layout'; 
import DriverCheckIn from './components/DriverCheckIn';
import DriverStatus from './components/DriverStatus';
import AdminDashboard from './components/AdminDashboard';
import AdminReports from './components/AdminReports';
import SecurityDashboard from './components/SecurityDashboard';
import PublicMonitor from './components/PublicMonitor';
import SystemManagerDashboard from './components/CommandCenter'; 
import { LoginPage } from './components/LoginPage'; 
import SystemOverview from './components/SystemOverview';
import { ArrowRight, Activity, Lock, Info } from 'lucide-react';
import { UserProfile } from './types';

const App: React.FC = () => {
  const [view, setView] = useState('home'); 
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // --- 1. HALAMAN DEPAN (LANDING PAGE) ---
  const LandingPage = () => (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-6 lg:px-12 py-10 bg-slate-50">
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-pink-200/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="w-full max-w-[1440px] grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        <div className="lg:col-span-5 text-left space-y-8 pl-4">
          <div className="space-y-2">
            <h1 className="text-6xl font-bold text-slate-900">Logistik Gudang</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-5 pt-4">
            <button onClick={() => setView('public-monitor')} className="px-8 py-4 bg-purple-600 text-white font-bold rounded-full shadow-lg hover:scale-105 transition-all flex items-center gap-3">
               <Activity className="w-5 h-5" /> MONITOR ANTRIAN
            </button>
            <button onClick={() => setView('checkin')} className="px-8 py-4 bg-white border-2 border-pink-500 text-pink-600 font-bold rounded-full hover:scale-105 transition-all flex items-center gap-3">
               DRIVER CHECK-IN <ArrowRight className="w-5 h-5"/>
            </button>
          </div>
          <div className="flex items-center gap-6 pt-8 text-sm font-medium text-slate-400">
            <button onClick={() => setView('login')} className="hover:text-pink-600 flex items-center gap-2"><Lock className="w-4 h-4"/> Staff Login</button>
          </div>
        </div>
      </div>
    </div>
  );

  const handleCheckInSuccess = (id: string) => {
    setCurrentDriverId(id);
    setView('status');
  };

  const handleLoginSuccess = (user: UserProfile) => {
      setCurrentUser(user);
      setIsTransitioning(true);
      setTimeout(() => {
          if (user.role === 'ADMIN') setView('admin-dashboard');
          else if (user.role === 'SECURITY') setView('security-dashboard');
          else if (user.role === 'MANAGER') setView('system-manager');
          else setView('home');
          setIsTransitioning(false);
      }, 1000);
  };

  // --- 2. RENDER CONTENT ---
  const renderContent = () => {
    switch (view) {
      // HALAMAN TANPA SIDEBAR
      case 'home': return <LandingPage />;
      case 'checkin': return <DriverCheckIn onSuccess={handleCheckInSuccess} onBack={() => setView('home')} />;
      case 'status': return currentDriverId ? <DriverStatus driverId={currentDriverId} onBack={() => setView('home')} /> : <LandingPage />;
      case 'public-monitor': return <PublicMonitor onBack={() => setView('home')} />;
      case 'security-dashboard': return <SecurityDashboard onBack={() => setView('home')} currentUser={currentUser} />;
      case 'system-manager': return <SystemManagerDashboard onBack={() => setView('home')} />;
      case 'system-overview': return <SystemOverview onNavigate={setView} onBack={() => setView('home')} />;
      
      // HALAMAN DENGAN SIDEBAR (ADMIN SAJA)
      case 'admin-dashboard': return <AdminDashboard onBack={() => setView('home')} />;
      case 'admin-reports': return <AdminReports />;
      case 'settings': return <div className="p-8">Halaman Settings</div>;
      
      default: return <LandingPage />;
    }
  };

  // --- 3. LOGIKA UTAMA (INI YANG BIKIN SIDEBAR HILANG) ---
  // Kita cek: Apakah view sekarang adalah halaman Admin?
  const isAdminPage = ['admin-dashboard', 'admin-reports', 'settings'].includes(view);

  return (
    <>
      {isTransitioning && (
        <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center">Loading...</div>
      )}

      {view === 'login' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
           <LoginPage onLoginSuccess={handleLoginSuccess} onBack={() => setView('home')} />
        </div>
      )}

      {/* JIKA HALAMAN ADMIN -> PAKAI LAYOUT (SIDEBAR) */}
      {isAdminPage ? (
        <Layout 
          currentView={view} 
          onViewChange={setView} 
          isAdmin={true}
          userRole={currentUser?.role || 'ADMIN'}
        >
          {renderContent()}
        </Layout>
      ) : (
        // JIKA BUKAN ADMIN (CHECKIN, STATUS, DLL) -> JANGAN PAKAI LAYOUT (FULL SCREEN)
        <div className="min-h-screen bg-slate-50">
          {renderContent()}
        </div>
      )}
    </>
  );
};

export default App;
