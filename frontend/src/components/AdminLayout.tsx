import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ActivityIcon,
  UsersIcon,
  FileTextIcon,
  AudioLinesIcon,
  PackageIcon,
  CreditCardIcon,
  KeyIcon,
  ShieldAlertIcon,
  LogOutIcon,
  PanelLeftIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon } from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { useToast } from '../context/useToast';
type AdminLayoutProps = {
  children: React.ReactNode;
};
const adminNavItems = [
{
  path: '/admin',
  label: 'OVERVIEW',
  icon: ActivityIcon
},
{
  path: '/admin/users',
  label: 'USERS',
  icon: UsersIcon
},
{
  path: '/admin/documents',
  label: 'DOCUMENTS',
  icon: FileTextIcon
},
{
  path: '/admin/audio-debates',
  label: 'AUDIO DEBATES',
  icon: AudioLinesIcon
},
{
  path: '/admin/packages',
  label: 'PACKAGES',
  icon: PackageIcon
},
{
  path: '/admin/payments',
  label: 'PAYMENTS',
  icon: CreditCardIcon
},
{
  path: '/admin/sessions',
  label: 'SESSIONS',
  icon: KeyIcon
}];

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const handleLogout = () => {
    setShowLogoutModal(true);
  };
  const confirmLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      showToast('SESSION TERMINATED', 'info');
      logout();
      navigate('/');
    }
  };
  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden">
      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="w-full max-w-md bg-[#0a0a0a] border border-[#EF4444]/30 p-6 sm:p-8 relative mx-4 sm:mx-0">
            <div className="flex items-center gap-2 mb-4">
              <LogOutIcon className="w-4 h-4 text-[#EF4444]" />
              <span className="font-mono text-xs font-bold text-white tracking-widest">CONFIRM LOGOUT</span>
            </div>
            <p className="font-mono text-[11px] text-[#666] tracking-wider mb-6">
              ARE YOU SURE YOU WANT TO END YOUR ADMIN SESSION?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 border border-[#262626] text-[#666] font-mono text-[10px] tracking-widest hover:border-[#404040] hover:text-[#999] transition-colors">
                CANCEL
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 bg-[#EF4444] text-white font-mono text-[10px] font-bold tracking-widest hover:bg-[#dc2626] transition-colors">
                LOGOUT
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MOBILE OVERLAY ── */}
      {mobileOpen &&
      <div
        className="fixed inset-0 bg-black/70 z-30 lg:hidden"
        onClick={() => setMobileOpen(false)} />

      }

      {/* ── SIDEBAR ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 flex flex-col bg-[#050505] border-r border-[#262626]
          transition-transform duration-150 ease-linear
          lg:static lg:z-auto lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-12' : 'lg:w-56'}
          w-56
        `}
        style={{
          willChange: 'transform, width'
        }}>

        {/* Logo + Admin Badge */}
        <div
          className={`flex items-center border-b border-[#262626] flex-shrink-0 ${
            collapsed ? 'flex-col gap-1 px-0 py-3' : 'px-4 py-5'
          }`}>

          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setCollapsed(false)}
                className="flex items-center justify-center w-8 h-8 text-[#EF4444] hover:bg-[#0a0a0a] transition-colors"
                title="Expand sidebar"
              >
                <ShieldAlertIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCollapsed(false)}
                className="flex items-center justify-center w-6 h-6 border border-[#262626] text-[#404040] hover:text-white hover:border-[#404040] transition-colors"
                title="Expand sidebar"
              >
                <ChevronRightIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldAlertIcon className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                  <span className="font-mono text-sm font-bold text-white tracking-widest">
                    ARES AI
                  </span>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden flex items-center justify-center w-6 h-6 border border-[#262626] text-[#404040] hover:text-white transition-colors ml-auto flex-shrink-0"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="hidden lg:flex items-center justify-center w-6 h-6 border border-[#262626] text-[#404040] hover:text-white hover:border-[#404040] transition-colors flex-shrink-0 ml-2"
              >
                <ChevronLeftIcon className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {/* Admin Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-hidden">
          {adminNavItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 py-2.5 text-xs font-mono tracking-wider transition-colors border-l-2 ${collapsed ? 'px-0 justify-center' : 'px-3'} ${active ? 'bg-[#0f0f0f] text-white border-[#EF4444]' : 'text-[#666] hover:text-[#999] hover:bg-[#0a0a0a] border-transparent'}`}>

                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>);

          })}
        </nav>

        {/* Logout */}
        <div
          className={`border-t border-[#262626] flex-shrink-0 ${collapsed ? 'px-0 py-3 flex justify-center' : 'px-4 py-3'}`}>

          <button
            onClick={handleLogout}
            title={collapsed ? 'LOGOUT' : undefined}
            className={`flex items-center gap-2 font-mono text-[10px] text-[#404040] hover:text-[#EF4444] hover:bg-[#0a0a0a] tracking-wider transition-colors ${collapsed ? 'p-2' : 'w-full px-3 py-2'}`}>

            <LogOutIcon className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && 'LOGOUT'}
          </button>
        </div>
      </aside>

      {/* ── RIGHT SIDE ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top nav */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[#262626] bg-[#050505] flex-shrink-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center w-8 h-8 border border-[#262626] text-[#666] hover:text-white hover:border-[#404040] transition-colors flex-shrink-0">

            <PanelLeftIcon className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlertIcon className="w-3.5 h-3.5 text-[#EF4444]" />
            <span className="font-mono text-sm font-bold text-white tracking-widest">
              ARES AI
            </span>
            <span className="font-mono text-[9px] font-bold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-1.5 py-0.5">
              ADMIN
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#050505]">{children}</main>
      </div>
    </div>);

}