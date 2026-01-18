import React from 'react';
import { 
  LayoutDashboard, FileText, LogOut, 
  Settings, Truck, User 
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  userRole?: 'ADMIN' | 'SECURITY' | 'MANAGER';
  onLogout?: () => void; // Tambahan prop untuk handle logout
}

const Layout: React.FC<LayoutProps> = ({ children, userRole = 'ADMIN', onLogout }) => {
  
  const handleLogoutClick = () => {
    if (confirm('Keluar dari sistem?')) {
      if (onLogout) {
        onLogout(); // Panggil fungsi dari App.tsx
      } else {
        window.location.reload(); // Fallback
      }
    }
  };

  const menuItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', active: true },
    { icon: <FileText className="w-5 h-5" />, label: 'Laporan', active: false },
    { icon: <Settings className="w-5 h-5" />, label: 'Pengaturan', active: false },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* --- SIDEBAR (KIRI) --- */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-30 shadow-2xl transition-all">
        
        {/* Logo Area */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">GateFlow</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin Pro</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-bold text-slate-500 px-4 py-2 uppercase tracking-wider">Menu Utama</div>
          {menuItems.map((item, idx) => (
            <button 
              key={idx}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                item.active 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Profile & Logout (Bottom Sidebar) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <User className="w-5 h-5 text-slate-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">Administrator</p>
              <p className="text-xs text-slate-500 truncate">Traffic Division</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" /> KELUAR SISTEM
          </button>
        </div>
      </aside>

      {/* --- CONTENT AREA (KANAN) --- */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-[1600px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>

    </div>
  );
};

export default Layout;
