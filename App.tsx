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

// --- OPTIMIZATION: Landing Page dipisah agar tidak re-render berat ---
interface LandingPageProps {
  onNavigate: (view: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => (
  <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-6 lg:px-12 py-10">
    <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-pink-200/20 rounded-full blur-[100px] animate-pulse"></div>
    <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-200/10 rounded-full blur-[120px]"></div>
    
    <div className="w-full max-w-[1440px] grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
      <div className="lg:col-span-5 text-left space-y-8 pl-4">
        <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/50 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-pink-600 tracking-widest uppercase">Warehouse V4.0</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl md:text-7xl font-serif font-bold text-slate-900 leading-tight">Logistik</h1>
          <h1 className="text-6xl md:text-7xl font-sans font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 leading-tight">Gudang</h1>
        </div>
        <p className="text-lg text-slate-500 font-light leading-relaxed max-w-md">
          Platform manajemen distribusi terintegrasi untuk <strong className="text-pink-600 font-medium">Sociolla Indonesia</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-5 pt-4">
          <button onClick={() => onNavigate('public-monitor')} className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-lg rounded-full shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-3">
             <Activity className="w-5 h-5" /> MONITOR ANTRIAN
          </button>
          <button onClick={() => onNavigate('checkin')} className="px-8 py-4 bg-white border-2 border-pink-500 text-pink-600 font-bold text-lg rounded-full hover:bg-pink-50 hover:scale-105 transition-all flex items-center justify-center gap-3">
             DRIVER CHECK-IN <ArrowRight className="w-5 h-5"/>
          </button>
        </div>
        <div className="flex items-center gap-6 pt-8 text-sm font-medium text-slate-400">
          <button onClick={() => onNavigate('system-overview')} className="hover:text-pink-600 flex items-center gap-2 transition-colors"><Info className="w-4 h-4"/> Tentang Sistem</button>
          <button onClick={() => onNavigate('login')} className="hover:text-pink-600 flex items-center gap-2 transition-colors"><Lock className="w-4 h-4"/> Staff Login</button>
        </div>
      </div>
      <div className="hidden lg:block lg:col-span-7 relative h-[600px]">
        <div className="relative w-full h-full rounded-[3rem] overflow-hidden border-[6px] border-white shadow-2xl">
           <img src="https://lh3.googleusercontent.com/gps-cs-s/AG0ilSyUnU3OugVJpRf26RWFVCuVaFLhm_b6RKgTqLCDJdQyybIi9U5jNGoFoF1jrRWtWJmggqd9VZm5kUwbTdKH1AG22qGrImduifg6Msj1iSgTXpqdBH0OSmX8BYhsdTZp9riWEPeDHw=s680-w680-h510-rw" alt="Sociolla Warehouse" className="w-full h-full object-cover"/>
           <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-lg max-w-xs border border-white/50">
             <h3 className="font-serif font-bold text-slate-900 text-lg">PT Social Bella Indonesia</h3>
             <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mt-0.5">Secure Integrated System</p>
           </div>
        </div>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  // Routing State
  const [view, setView] = useState('home'); 
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  // Transition State
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionRole, setTransitionRole] = useState<'ADMIN' | 'SECURITY' | 'MANAGER' | null>(null);

  const handleCheckInSuccess = (id: string) => {
    setCurrentDriverId(id);
    setView('status');
  };

  const handleLoginSuccess = (user: UserProfile) => {
      setCurrentUser(user);
      setTransitionRole(user.role);
      setIsTransitioning(true);
      setTimeout(() => {
          if (user.role === 'ADMIN') setView('admin-dashboard');
          else if (user.role === 'SECURITY') setView('security-dashboard');
          else if (user.role === 'MANAGER') setView('system-manager');
          else setView('home');
          
          setTimeout(() => {
              setIsTransitioning(false);
              setTransitionRole(null);
          }, 500);
      }, 2000);
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setView('home');
  };

  const renderContent = () => {
    switch (view) {
      case 'system-overview': return <SystemOverview onNavigate={setView} onBack={() => setView('home')} />;
      case 'checkin': return <DriverCheckIn onSuccess={handleCheckInSuccess} onBack={() => setView('home')} />;
      case 'status': return currentDriverId ? <DriverStatus driverId={currentDriverId} onBack={() => setView('home')} /> : <LandingPage onNavigate={setView} />;
      case 'admin-dashboard': return <AdminDashboard onBack={handleLogout} />;
      case 'admin-reports': return <AdminReports />;
      case 'security-dashboard': return <SecurityDashboard onBack={handleLogout} currentUser={currentUser} />;
      case 'public-monitor': return <PublicMonitor onBack={() => setView('home')} />;
      case 'system-manager': return <SystemManagerDashboard onBack={handleLogout} />;
      default: return null;
    }
  };

  const isAdminView = ['admin-dashboard', 'admin-reports'].includes(view);

  return (
    <>
        {isTransitioning && (
          <div className="fixed inset-0 z-[100] bg-[#FDF2F4] flex flex-col items-center justify-center font-sans">
              <div className="mb-6 animate-bounce w-24 h-24 bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-white">
                  <img src="https://play-lh.googleusercontent.com/J0NYr2cNJmhQiGbDXJHOqa4o9WhPeqC4BGuaD-YKp28KxH1xoW83A3dJyQMsaNwpx0Pv" alt="Sociolla" className="w-full h-full object-cover"/>
              </div>
              <h1 className="text-4xl font-serif font-bold text-pink-600 mb-3 tracking-tight">Sociolla</h1>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] animate-pulse">Loading System...</p>
          </div>
        )}

        {view === 'login' && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
             <LoginPage onLoginSuccess={handleLoginSuccess} onBack={() => setView('home')} />
          </div>
        )}

        {/* Home / Landing Page */}
        {(view === 'home') && <LandingPage onNavigate={setView} />}

        {/* Logic Render Utama */}
        {view !== 'home' && view !== 'login' && (
            isAdminView ? (
              <Layout userRole="ADMIN" onLogout={handleLogout}>
                   {renderContent()}
              </Layout>
            ) : (
              renderContent()
            )
        )}
    </>
  );
};

export default App;
