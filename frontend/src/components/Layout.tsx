import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  FlaskConicalIcon,
  ActivityIcon,
  CreditCardIcon,
  ZapIcon,
  ChevronUpIcon,
  LogOutIcon,
  PanelLeftIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/useToast';
type LayoutProps = {
  children: React.ReactNode;
};
const navItems = [
{
  path: '/dashboard',
  label: 'DASHBOARD',
  icon: LayoutDashboardIcon
},
{
  path: '/audit/demo-001',
  label: 'AUDIT LAB',
  icon: FlaskConicalIcon
},
{
  path: '/billing',
  label: 'BILLING',
  icon: CreditCardIcon
}];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { showToast } = useToast();
  const isTemp = user?.is_temp || false;
  const auditsPerformed = user?.user_usage?.audits_performed ?? 0;
  const auditLimit = user?.user_usage?.audit_limit ?? 0;
  const isUnlimitedPlan = auditLimit >= 9999;
  const auditsRemaining = Math.max(auditLimit - auditsPerformed, 0);
  const usagePercent =
    isUnlimitedPlan ? 100 : auditLimit > 0 ? Math.min(auditsPerformed / auditLimit * 100, 100) : 0;
  // Desktop: collapsed (icon-only) state
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: sidebar open state
  const [mobileOpen, setMobileOpen] = useState(false);
  // Logout confirmation modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  // Close mobile sidebar on resize to desktop
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
  const confirmLogout = () => {
    showToast('SESSION TERMINATED', 'info');
    logout();
    navigate('/');
  };
  const isActive = (path: string) =>
  location.pathname === path ||
  location.pathname.startsWith(path.split('/').slice(0, 2).join('/'));
  const visibleNavItems = navItems.filter((item) => {
    if (isTemp && item.path === '/billing') return false;
    return true;
  });
  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden">
      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-md bg-[#0a0a0a] border border-[#262626] p-6 sm:p-8 relative mx-4 sm:mx-0">
            <div className="flex items-center gap-2 mb-4">
              <LogOutIcon className="w-4 h-4 text-[#EF4444]" />
              <span className="font-mono text-xs font-bold text-white tracking-widest">CONFIRM LOGOUT</span>
            </div>
            <p className="font-mono text-[11px] text-[#666] tracking-wider mb-6">
              ARE YOU SURE YOU WANT TO LOG OUT OF YOUR SESSION?
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
      {location.pathname !== '/' && (
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

        {/* Logo row */}
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
                <ZapIcon className="w-4 h-4" />
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
                  <ZapIcon className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                    <span className="font-mono text-sm font-bold text-white tracking-widest whitespace-nowrap">
                      ARES AI
                    </span>
                </div>
                <p className="font-mono text-[10px] text-[#404040] mt-1 tracking-widest">
                  STRESS-TEST ENGINE
                </p>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="hidden lg:flex items-center justify-center w-6 h-6 border border-[#262626] text-[#404040] hover:text-white hover:border-[#404040] transition-colors flex-shrink-0 ml-2"
              >
                <ChevronLeftIcon className="w-3 h-3" />
              </button>
            </>
          )}

          {/* Mobile close — only when expanded */}
          {!collapsed && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden flex items-center justify-center w-6 h-6 border border-[#262626] text-[#404040] hover:text-white transition-colors ml-2 flex-shrink-0"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-hidden">
          {visibleNavItems.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);

            if (label === 'AUDIT LAB') {
              return (
                <div
                  key={path}
                  className={`flex items-center gap-3 py-2.5 text-[#333] cursor-not-allowed ${collapsed ? 'px-0 justify-center' : 'px-4'}`}
                  title="Select a document from Dashboard to inspect"
                >
                  <ActivityIcon className="w-4 h-4" />
                  {!collapsed && (
                    <span className="font-mono text-[10px] tracking-widest">AUDIT LAB</span>
                  )}
                </div>
              );
            }

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

        {/* Usage meter — hidden when collapsed */}
        {!collapsed &&
        <div className="px-4 py-4 border-t border-[#262626] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#666] tracking-widest">
                QUOTA
              </span>
              <span className="font-mono text-[10px] text-[#EF4444] font-bold">
                {auditsPerformed}/{isUnlimitedPlan ? '∞' : auditLimit}
              </span>
            </div>
            <div className="w-full h-1 bg-[#1a1a1a] mb-3">
              <div
              className={`h-full ${isUnlimitedPlan ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}
              style={{
                width: `${usagePercent}%`
              }} />

            </div>
            <p className="font-mono text-[9px] text-[#404040] mb-3 tracking-wider">
              {isUnlimitedPlan ? '∞ AUDITS REMAINING' : `${auditsRemaining} AUDITS REMAINING`}
            </p>
            {!isTemp && (
              <Link
                to="/billing"
                className="w-full py-2 text-[10px] font-mono font-bold tracking-widest text-[#EF4444] border border-[#EF4444] hover:bg-[#EF4444] hover:text-white transition-colors flex items-center justify-center gap-1"
              >
                <ChevronUpIcon className="w-3 h-3" />
                UPGRADE TO PRO
              </Link>
            )}

            {isTemp && (
              <div className="mt-2">
                <span className="font-mono text-[9px] text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/30 px-2 py-0.5 tracking-widest">
                  TEMP ACCESS
                </span>
                {user?.expires_at && (
                  <p className="font-mono text-[9px] text-[#404040] mt-1">
                    EXPIRES: {new Date(user.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        }

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
      )}

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
            <ZapIcon className="w-3.5 h-3.5 text-[#EF4444]" />
            <span className="font-mono text-sm font-bold text-white tracking-widest whitespace-nowrap">
              ARES AI
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#050505]">{children}</main>
      </div>
    </div>);

}