import React, { useState, useEffect } from 'react';
import {
  UsersIcon,
  TrashIcon,
  PlusIcon,
  DownloadIcon,
  XIcon,
  SearchIcon,
  CalendarIcon,
  EyeIcon,
  UserXIcon,
  UserCheckIcon,
  AlertTriangleIcon,
  ShieldAlertIcon,
  RefreshCwIcon } from
'lucide-react';
import { authService, User as APIUser } from '../services/authService';
import { dataCache } from '../utils/dataCache';
import { useToast } from '../context/useToast';
import { exportToPdf } from '../utils/exportPdf';

const USERS_CACHE_KEY = 'admin:users';

type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
type PlanHistoryItem = {
  planName: string;
  createdAt: string;
  status: string;
  amountPaid: number;
};

type User = {
  id: number;
  name: string;
  email: string;
  latestPlan: string;
  previousPlans: PlanHistoryItem[];
  status: UserStatus;
  auditsPerformed: number;
  auditLimit: number;
  joined: string;
  lastActive: string;
  apiUser: APIUser; // Store original API user data
};

type TempUserModal = {
  show: boolean;
  name: string;
  email: string;
  expiry: string;
};

export function AdminUsers() {
  const { showToast } = useToast();
  const todayIso = new Date().toISOString().split('T')[0];
  const cachedUsers = dataCache.get<User[]>(USERS_CACHE_KEY);
  const [users, setUsers] = useState<User[]>(cachedUsers ?? []);
  const [search, setSearch] = useState('');
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [loading, setLoading] = useState(!cachedUsers);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const [planHistoryTarget, setPlanHistoryTarget] = useState<User | null>(null);
  const [tempModal, setTempModal] = useState<TempUserModal>({
    show: false,
    name: '',
    email: '',
    expiry: ''
  });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingTempUser, setGeneratingTempUser] = useState(false);

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (
    options: { forceRefresh?: boolean; isReload?: boolean } = {}
  ) => {
    const { forceRefresh = false, isReload = false } = options;

    if (!forceRefresh) {
      const cached = dataCache.get<User[]>(USERS_CACHE_KEY);
      if (cached) {
        setUsers(cached);
        setLoading(false);
        return;
      }
    }

    try {
      if (isReload) {
        setReloading(true);
      } else {
        setLoading(true);
      }
      setError('');
      const [apiUsers, payments] = await Promise.all([
        authService.getAllUsers(),
        authService.getAllPayments(),
      ]);

      const paymentHistoryByUser = new Map<number, PlanHistoryItem[]>();
      payments
        .filter((payment) => payment.offer_id !== null || payment.offer)
        .forEach((payment) => {
          const planName = payment.offer?.name || payment.offer?.tier_label || (payment.offer_id !== null ? `OFFER #${payment.offer_id}` : 'UNKNOWN');
          const item: PlanHistoryItem = {
            planName,
            createdAt: payment.created_at,
            status: payment.status,
            amountPaid: payment.amount_paid,
          };

          const existing = paymentHistoryByUser.get(payment.user_id) ?? [];
          existing.push(item);
          paymentHistoryByUser.set(payment.user_id, existing);
        });

      paymentHistoryByUser.forEach((items, userID) => {
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        paymentHistoryByUser.set(userID, items);
      });
      
      // Transform API users to local format
      const transformedUsers = apiUsers.map((apiUser) => ({
        id: apiUser.id,
        name: apiUser.email.split('@')[0], // Use email prefix as name
        email: apiUser.email,
        latestPlan: paymentHistoryByUser.get(apiUser.id)?.[0]?.planName || apiUser.subscription_tier,
        previousPlans: paymentHistoryByUser.get(apiUser.id)?.slice(1) ?? [],
        status: 'ACTIVE' as UserStatus,
        auditsPerformed: apiUser.user_usage?.audits_performed ?? 0,
        auditLimit: apiUser.user_usage?.audit_limit ?? 0,
        joined: new Date(apiUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        lastActive: new Date(apiUser.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        apiUser,
      }));

      setUsers(transformedUsers);
      dataCache.set(USERS_CACHE_KEY, transformedUsers);
    } catch (err: any) {
      const message = err.message || 'Failed to fetch users';
      setError(message);
      showToast(message, 'error');
    } finally {
      if (isReload) {
        setReloading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleReload = async () => {
    dataCache.invalidate(USERS_CACHE_KEY);
    await fetchUsers({ forceRefresh: true, isReload: true });
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.latestPlan.toLowerCase().includes(search.toLowerCase()) ||
        u.previousPlans.some((plan) => plan.planName.toLowerCase().includes(search.toLowerCase())) ||
      u.status.toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspendToggle = async (user: User) => {
    try {
      const newStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      const backendStatus = newStatus === 'SUSPENDED' ? 'suspended' : 'active';
      
      // Call API to update user status
      await authService.updateUser(user.id, { status: backendStatus });
      
      // Update local state
      setUsers((prev) => {
        const next = prev.map((u) =>
          u.id === user.id
            ? { ...u, status: newStatus }
            : u
        );
        dataCache.set(USERS_CACHE_KEY, next);
        return next;
      });
      
      // Keep view modal in sync
      if (viewUser?.id === user.id) {
        setViewUser((prev) =>
          prev
            ? { ...prev, status: newStatus }
            : prev
        );
      }
      showToast('USER STATUS UPDATED', 'success');
    } catch (err: any) {
      const message = err.message || 'Failed to update user';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleDelete = async (user: User) => {
    try {
      // Call API to delete user
      await authService.deleteUser(user.id);
      
      // Update local state
      setUsers((prev) => {
        const next = prev.filter((u) => u.id !== user.id);
        dataCache.set(USERS_CACHE_KEY, next);
        return next;
      });
      setDeleteTarget(null);
      setViewUser(null);
      showToast('USER DELETED', 'success');
    } catch (err: any) {
      const message = err.message || 'Failed to delete user';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleGenerateKey = async () => {
    if (!tempModal.name.trim() || !tempModal.email.trim() || !tempModal.expiry) {
      showToast('NAME, EMAIL, AND EXPIRY ARE REQUIRED', 'error');
      return;
    }

    try {
      setGeneratingTempUser(true);
      const response = await authService.generateTempUser({
        operator_name: tempModal.name.trim(),
        email: tempModal.email.trim(),
        expires_at: new Date(tempModal.expiry).toISOString(),
      });

      setGeneratedKey(response.access_key);
      await fetchUsers({ forceRefresh: true });
      showToast('TEMP USER CREATED', 'success');
    } catch (err: any) {
      const message = err.message || 'Failed to create temp user';
      setError(message);
      showToast(message, 'error');
    } finally {
      setGeneratingTempUser(false);
    }
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: 'ENTITY MANAGEMENT - USER REGISTRY',
      subtitle: `${users.length} users - exported ${new Date().toISOString()}`,
      columns: ['ID', 'OPERATOR', 'EMAIL', 'PLAN', 'STATUS', 'AUDITS', 'JOINED'],
      rows: users.map((u) => [
        u.id,
        u.apiUser.operator_name,
        u.email,
        u.latestPlan,
        u.status,
        `${u.auditsPerformed}/${u.auditLimit}`,
        u.joined,
      ]),
      filename: `ares-users-${Date.now()}`,
    });
  };

  const planStyle = (planName: string): string => {
    const lower = planName.toLowerCase();
    if (lower.includes('titan') || lower.includes('pro')) {
      return 'text-[#EF4444] bg-[#EF4444]/15 border border-[#EF4444]/40';
    }

    if (lower.includes('strategist') || lower.includes('enterprise')) {
      return 'text-[#3B82F6] bg-[#3B82F6]/15 border border-[#3B82F6]/40';
    }

    if (lower.includes('starter') || lower.includes('free')) {
      return 'text-[#9CA3AF] bg-[#1a1a1a] border border-[#3a3a3a]';
    }

    return 'text-[#EAB308] bg-[#EAB308]/15 border border-[#EAB308]/40';
  };

  const statusStyle: Record<UserStatus, string> = {
    ACTIVE: 'text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20',
    SUSPENDED: 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20',
    PENDING: 'text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/20'
  };

  if (loading) {
    return (
      <div className="p-6 min-h-full flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-sm text-[#404040]">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <UsersIcon className="w-4 h-4 text-[#EF4444]" />
              <h1 className="font-sans text-xl font-bold text-white tracking-wide">
                ENTITY MANAGEMENT
              </h1>
            </div>
            <p className="font-mono text-[10px] text-[#404040] tracking-widest">
              {users.length} REGISTERED OPERATORS —{' '}
              {users.filter((u) => u.status === 'ACTIVE').length} ACTIVE
            </p>
          </div>
          <div className="hidden md:grid grid-cols-2 gap-2 w-fit ml-auto">
            <button
              onClick={handleReload}
              disabled={loading || reloading}
              className="flex items-center justify-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
            >
              <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center justify-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors"
            >
              <DownloadIcon className="w-3 h-3" />
              EXPORT PDF
            </button>
            <button
              onClick={() =>
                setTempModal({
                  show: true,
                  name: '',
                  email: '',
                  expiry: ''
                })
              }
              className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-[#EF4444] text-white font-mono text-[9px] font-bold tracking-widest hover:bg-[#dc2626] transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
              GENERATE TEMP USER
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-2 md:hidden">
        <div className="flex w-full gap-2">
          <button
            onClick={handleReload}
            disabled={loading || reloading}
            className="flex-1 flex items-center justify-center gap-2 font-mono text-xs text-[#666] tracking-widest border border-[#262626] px-3 py-2.5 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${reloading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
          <button
            onClick={handleExportPdf}
            className="flex-1 flex items-center justify-center gap-2 font-mono text-xs text-[#666] tracking-widest border border-[#262626] px-3 py-2.5 hover:border-[#404040] hover:text-[#999] transition-colors"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            EXPORT PDF
          </button>
        </div>
        <button
          onClick={() =>
            setTempModal({
              show: true,
              name: '',
              email: '',
              expiry: ''
            })
          }
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EF4444] text-white font-mono text-xs font-bold tracking-widest hover:bg-[#dc2626] transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          GENERATE TEMP USER
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444] text-[#EF4444] font-mono text-xs rounded">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#404040]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH OPERATORS..."
          className="w-full bg-[#0a0a0a] border border-[#262626] pl-9 pr-4 py-2.5 font-mono text-xs text-white placeholder-[#333] focus:border-[#3B82F6] transition-colors focus:outline-none" />

      </div>

      {/* Table */}
      <div className="border border-[#262626] overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#262626] bg-[#0a0a0a]">
              {[
              'ID',
              'OPERATOR',
              'PLAN',
              'STATUS',
              'AUDITS USED',
              'JOINED',
              'LAST ACTIVE',
              'ACTIONS'].
              map((h) =>
              <th
                key={h}
                className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">

                  {h}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {filtered.length === 0 &&
            <tr>
                <td
                colSpan={8}
                className="px-4 py-8 text-center font-mono text-[10px] text-[#333]">

                  NO RESULTS FOUND
                </td>
              </tr>
            }
            {filtered.map((user) =>
            <tr
              key={user.id}
              className="hover:bg-[#0a0a0a] transition-colors">

                <td className="px-4 py-3 font-mono text-[9px] text-[#333] whitespace-nowrap">
                  {user.id}
                </td>
                <td className="px-4 py-3">
                  <div className="font-sans text-xs text-white font-medium">
                    {user.name}
                  </div>
                  <div className="font-mono text-[9px] text-[#404040]">
                    {user.email}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="inline-flex flex-col gap-1">
                    <button
                      onClick={() => setPlanHistoryTarget(user)}
                      className={`font-mono text-[9px] font-bold px-1.5 py-0.5 tracking-widest text-left transition-colors hover:text-white ${planStyle(user.latestPlan)}`}
                      title="Open plan history"
                    >
                      {user.latestPlan.toUpperCase()}
                    </button>
                    <button
                      onClick={() => setPlanHistoryTarget(user)}
                      className="font-mono text-[8px] text-[#404040] hover:text-white text-left transition-colors"
                    >
                      {user.previousPlans.length > 0 ? `VIEW PREVIOUS (${user.previousPlans.length})` : 'VIEW PLAN HISTORY'}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                  className={`font-mono text-[9px] font-bold px-1.5 py-0.5 tracking-widest ${statusStyle[user.status]}`}>

                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white whitespace-nowrap">
                  {user.auditsPerformed} / {user.auditLimit}
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-[#666] whitespace-nowrap">
                  {user.joined}
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-[#666] whitespace-nowrap">
                  {user.lastActive}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                    onClick={() => setViewUser(user)}
                    className="flex items-center gap-1 px-2 py-1 border border-[#262626] text-[#666] font-mono text-[9px] tracking-widest hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                    title="View">

                      <EyeIcon className="w-3 h-3" />
                      VIEW
                    </button>
                    <button
                    onClick={() => handleSuspendToggle(user)}
                    className={`flex items-center gap-1 px-2 py-1 border font-mono text-[9px] tracking-widest transition-colors ${user.status === 'SUSPENDED' ? 'border-[#22C55E]/40 text-[#22C55E] hover:border-[#22C55E] hover:bg-[#22C55E]/10' : 'border-[#EAB308]/40 text-[#EAB308] hover:border-[#EAB308] hover:bg-[#EAB308]/10'}`}
                    title={
                    user.status === 'SUSPENDED' ? 'Restore' : 'Suspend'
                    }>

                      {user.status === 'SUSPENDED' ?
                    <>
                          <UserCheckIcon className="w-3 h-3" />
                          RESTORE
                        </> :

                    <>
                          <UserXIcon className="w-3 h-3" />
                          SUSPEND
                        </>
                    }
                    </button>
                    <button
                    onClick={() => setDeleteTarget(user)}
                    className="flex items-center gap-1 px-2 py-1 border border-[#EF4444]/30 text-[#EF4444] font-mono text-[9px] tracking-widest hover:border-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                    title="Delete">

                      <TrashIcon className="w-3 h-3" />
                      DELETE
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── VIEW MODAL ── */}
      {viewUser &&
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#050505] border border-[#262626] w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <ShieldAlertIcon className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-white tracking-widest">
                  OPERATOR RECORD
                </span>
              </div>
              <button
              onClick={() => setViewUser(null)}
              className="text-[#404040] hover:text-white transition-colors">

                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-2 divide-y divide-[#1a1a1a]">
              {(
            [
            ['OPERATOR ID', viewUser.id],
            ['FULL NAME', viewUser.name],
            ['EMAIL ADDRESS', viewUser.email],
            ['PLAN', viewUser.latestPlan.toUpperCase()],
            ['STATUS', viewUser.status],
            ['AUDITS PERFORMED', String(viewUser.auditsPerformed)],
            ['AUDIT LIMIT', String(viewUser.auditLimit)],
            ['JOINED', viewUser.joined],
            ['LAST ACTIVE', viewUser.lastActive]] as
            [string, string][]).
            map(([label, value]) =>
            <div
              key={label}
              className="flex items-center justify-between py-2.5">

                  <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                    {label}
                  </span>
                  <span
                className={`font-mono text-[10px] font-medium ${label === 'STATUS' ? viewUser.status === 'ACTIVE' ? 'text-[#22C55E]' : viewUser.status === 'SUSPENDED' ? 'text-[#EF4444]' : 'text-[#EAB308]' : 'text-white'}`}>

                    {value}
                  </span>
                </div>
            )}
            </div>
            <div className="px-5 py-4 border-t border-[#262626] flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                onClick={() => handleSuspendToggle(viewUser)}
                className={`flex-1 py-2.5 border font-mono text-xs font-bold tracking-widest transition-colors ${viewUser.status === 'SUSPENDED' ? 'border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/10' : 'border-[#EAB308]/40 text-[#EAB308] hover:bg-[#EAB308]/10'}`}>

                  {viewUser.status === 'SUSPENDED' ?
                'RESTORE ACCESS' :
                'SUSPEND USER'}
                </button>
                <button
                onClick={() => {
                  setDeleteTarget(viewUser);
                  setViewUser(null);
                }}
                className="flex-1 py-2.5 border border-[#EF4444]/30 text-[#EF4444] font-mono text-xs font-bold tracking-widest hover:bg-[#EF4444]/10 transition-colors">

                  DELETE
                </button>
              </div>
              <button
              onClick={() => setViewUser(null)}
              className="w-full py-2.5 border border-[#262626] text-[#666] font-mono text-xs font-bold tracking-widest hover:border-[#404040] hover:text-white transition-colors">

                CLOSE
              </button>
            </div>
          </div>
        </div>
      }

      {/* ── PREVIOUS PLANS MODAL ── */}
      {planHistoryTarget &&
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#050505] border border-[#262626] w-full max-w-md max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="font-mono text-xs font-bold text-white tracking-widest">
                  PREVIOUS PLANS
                </span>
              </div>
              <button
                onClick={() => setPlanHistoryTarget(null)}
                className="text-[#404040] hover:text-white transition-colors">

                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 border-b border-[#1a1a1a]">
              <div className="font-mono text-[10px] text-white">{planHistoryTarget.name}</div>
              <div className="font-mono text-[9px] text-[#404040]">
                CURRENT: {planHistoryTarget.latestPlan.toUpperCase()}
              </div>
            </div>
            <div className="p-5 overflow-auto space-y-2">
              {planHistoryTarget.previousPlans.length === 0 ?
              <span className="font-mono text-[9px] text-[#404040]">NO PREVIOUS PLANS</span> :
              planHistoryTarget.previousPlans.map((plan, index) =>
              <div key={`${planHistoryTarget.id}-${plan.createdAt}-${index}`} className="border border-[#1a1a1a] bg-[#0b0b0b] px-3 py-2">
                  <div className="font-mono text-[9px] text-white">{plan.planName.toUpperCase()}</div>
                  <div className="font-mono text-[8px] text-[#666] mt-0.5">
                    {new Date(plan.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {' · '}
                    {plan.status.toUpperCase()}
                    {' · $'}
                    {plan.amountPaid.toFixed(2)}
                  </div>
                </div>
              )
              }
            </div>
          </div>
        </div>
      }

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteTarget &&
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#050505] border border-[#EF4444]/30 w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-[#EF4444] tracking-widest">
                  CONFIRM DELETION
                </span>
              </div>
              <button
              onClick={() => setDeleteTarget(null)}
              className="text-[#404040] hover:text-white transition-colors">

                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="font-mono text-[10px] text-[#888] leading-relaxed mb-4">
                YOU ARE ABOUT TO PERMANENTLY DELETE THIS OPERATOR RECORD AND ALL
                ASSOCIATED AUDIT DATA. THIS ACTION CANNOT BE UNDONE.
              </p>
              <div className="bg-[#0a0a0a] border border-[#262626] px-4 py-3">
                <div className="font-mono text-xs text-white font-bold">
                  {deleteTarget.name}
                </div>
                <div className="font-mono text-[9px] text-[#404040] mt-0.5">
                  {deleteTarget.email} · {deleteTarget.id}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
              onClick={() => handleDelete(deleteTarget)}
              className="flex-1 py-2.5 bg-[#EF4444] text-white font-mono text-xs font-bold tracking-widest hover:bg-[#dc2626] transition-colors">

                DELETE
              </button>
              <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 border border-[#262626] text-[#666] font-mono text-xs font-bold tracking-widest hover:border-[#404040] hover:text-white transition-colors">

                CANCEL
              </button>
            </div>
          </div>
        </div>
      }

      {/* ── GENERATE TEMP USER MODAL ── */}
      {tempModal.show &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-md bg-[#0a0a0a] border border-[#262626] p-6 sm:p-8 relative mx-4 sm:mx-0">
            <button
            onClick={() => {
              setTempModal({
                show: false,
                name: '',
                email: '',
                expiry: ''
              });
              setGeneratedKey(null);
            }}
            className="absolute top-4 right-4 text-[#404040] hover:text-white transition-colors">

              <XIcon className="w-4 h-4" />
            </button>
            <h2 className="font-sans text-base font-bold text-white mb-1">
              CREATE TEMPORARY ACCESS KEY
            </h2>
            <p className="font-mono text-[10px] text-[#404040] mb-5 tracking-wider">
              CREATE TEMPORARY ACCESS KEY
            </p>
            <div className="scanning-bar mb-5" />
            {!generatedKey ?
          <div className="space-y-4">
                <div>
                  <label className="block font-mono text-[10px] text-[#666] tracking-widest mb-1.5">
                    OPERATOR NAME
                  </label>
                  <input
                type="text"
                value={tempModal.name}
                onChange={(e) =>
                setTempModal((m) => ({
                  ...m,
                  name: e.target.value
                }))
                }
                placeholder="Enterprise Contact Name"
                className="w-full bg-[#050505] border border-[#262626] px-3 py-2.5 text-sm font-mono text-white placeholder-[#333] focus:border-[#3B82F6] focus:outline-none transition-colors" />

                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#666] tracking-widest mb-1.5">
                    EMAIL ADDRESS
                  </label>
                  <input
                type="email"
                value={tempModal.email}
                onChange={(e) =>
                setTempModal((m) => ({
                  ...m,
                  email: e.target.value
                }))
                }
                placeholder="contact@enterprise.com"
                className="w-full bg-[#050505] border border-[#262626] px-3 py-2.5 text-sm font-mono text-white placeholder-[#333] focus:border-[#3B82F6] focus:outline-none transition-colors" />

                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#666] tracking-widest mb-1.5">
                    <CalendarIcon className="w-3 h-3 inline mr-1" />
                    ACCESS EXPIRY DATE
                  </label>
                  <input
                type="date"
                value={tempModal.expiry}
                onChange={(e) =>
                setTempModal((m) => ({
                  ...m,
                  expiry: e.target.value
                }))
                }
                  min={todayIso}
                className="w-full bg-[#050505] border border-[#262626] px-3 py-2.5 text-sm font-mono text-white focus:border-[#3B82F6] focus:outline-none transition-colors [color-scheme:dark]" />

                </div>
                <button
              onClick={handleGenerateKey}
              disabled={generatingTempUser}
              className="w-full py-3 bg-[#EF4444] text-white font-mono text-sm font-bold tracking-widest hover:bg-[#dc2626] transition-colors">

                  {generatingTempUser ? 'GENERATING...' : 'GENERATE ACCESS KEY'}
                </button>
              </div> :

          <div className="space-y-4">
                <div className="bg-[#050505] border border-[#22C55E]/30 p-4">
                  <div className="font-mono text-[9px] text-[#22C55E] tracking-widest mb-2">
                    ACCESS KEY GENERATED
                  </div>
                  <div className="font-mono text-sm text-white font-bold break-all">
                    {generatedKey}
                  </div>
                </div>
                <div className="font-mono text-[9px] text-[#404040]">
                  <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                    ACTIVE UNTIL: {tempModal.expiry ? new Date(tempModal.expiry).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : '—'} — TEMPORARY ACCESS
                  </span>
                </div>
                <button
              onClick={() => {
                setTempModal({
                  show: false,
                  name: '',
                  email: '',
                  expiry: ''
                });
                setGeneratedKey(null);
              }}
              className="w-full py-2.5 border border-[#262626] text-[#666] font-mono text-xs tracking-widest hover:border-[#404040] hover:text-white transition-colors">

                  CLOSE
                </button>
              </div>
          }
          </div>
        </div>
      }
    </div>);

}