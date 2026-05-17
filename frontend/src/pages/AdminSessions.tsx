import { useEffect, useMemo, useState } from 'react';
import { KeyIcon, RefreshCwIcon, SearchIcon, TrashIcon, DownloadIcon } from 'lucide-react';
import { authService, Session } from '../services/authService';
import { exportToPdf } from '../utils/exportPdf';

/* eslint-disable react-hooks/exhaustive-deps */
import { dataCache } from '../utils/dataCache';
import { useToast } from '../context/useToast';

const SESSIONS_CACHE_KEY = 'admin:sessions';

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
};

export function AdminSessions() {
  const { showToast } = useToast();
  const cachedSessions = dataCache.get<Session[]>(SESSIONS_CACHE_KEY);
  const [sessions, setSessions] = useState<Session[]>(cachedSessions ?? []);
  const [loading, setLoading] = useState(!cachedSessions);
  const [reloading, setReloading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  const load = async (
    options: { forceRefresh?: boolean; isReload?: boolean } = {}
  ) => {
    const { forceRefresh = false, isReload = false } = options;

    if (!forceRefresh) {
      const cached = dataCache.get<Session[]>(SESSIONS_CACHE_KEY);
      if (cached) {
        setSessions(cached);
        setLoading(false);
        return;
      }
    }

    if (isReload) {
      setReloading(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const data = await authService.getAllSessions();
      setSessions(data);
      dataCache.set(SESSIONS_CACHE_KEY, data);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load sessions.');
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

  useEffect(() => {
    // intentionally not adding 'load' to deps to mirror other admin pages
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
  }, []);

  const handleReload = async () => {
    dataCache.invalidate(SESSIONS_CACHE_KEY);
    await load({ forceRefresh: true, isReload: true });
  };

  const handleClearExpired = async () => {
    setClearing(true);
    setError('');

    try {
      const { deleted } = await authService.clearExpiredSessions();
      setDeletedCount(deleted);
      showToast(`${deleted} EXPIRED SESSIONS CLEARED`, 'success');
      dataCache.invalidate(SESSIONS_CACHE_KEY);
      await load({ forceRefresh: true, isReload: true });

      window.setTimeout(() => {
        setDeletedCount(null);
      }, 3000);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to clear expired sessions.');
      setError(message);
      showToast(message, 'error');
    } finally {
      setClearing(false);
    }
  };

  const getSessionStatus = (expiresAt: string) => {
    return new Date(expiresAt).getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED';
  };

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;

    return sessions.filter((session) => {
      const status = getSessionStatus(session.expires_at).toLowerCase();
      const email = session.user?.email?.toLowerCase() ?? '';
      const operatorName = session.user?.operator_name?.toLowerCase() ?? '';

      return (
        email.includes(query) ||
        operatorName.includes(query) ||
        status.includes(query)
      );
    });
  }, [search, sessions]);

  const handleExportPdf = () => {
    // lightweight export for sessions
    // reuse export util used across admin pages
    exportToPdf({
      title: 'SESSION LOG',
      subtitle: `${sessions.length} sessions - exported ${new Date().toISOString()}`,
      columns: ['ID', 'USER', 'EMAIL', 'ROLE', 'CREATED', 'EXPIRES', 'STATUS'],
      rows: sessions.map((s) => [
        `#${s.id}`,
        s.user?.operator_name || `USER #${s.user_id}`,
        s.user?.email ?? '—',
        s.user?.roles?.[0]?.name ?? '—',
        new Date(s.created_at).toLocaleString(),
        new Date(s.expires_at).toLocaleString(),
        getSessionStatus(s.expires_at),
      ]),
      filename: `ares-sessions-${Date.now()}`,
    });
  };

  const stats = useMemo(() => {
    const now = Date.now();
    const active = sessions.filter(
      (session) => new Date(session.expires_at).getTime() > now
    ).length;

    return {
      total: sessions.length,
      active,
      expired: sessions.length - active,
    };
  }, [sessions]);

  return (
    <div className="p-6 min-h-full">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <KeyIcon className="w-4 h-4 text-[#EF4444]" />
              <h1 className="font-sans text-xl font-bold text-white tracking-wide">SESSIONS</h1>
            </div>
            <p className="font-mono text-[10px] text-[#404040] tracking-wider">REFRESH TOKEN SESSIONS</p>
            {deletedCount !== null && (
              <p className="mt-2 font-mono text-[10px] text-green-400 tracking-widest">
                CLEARED {deletedCount} EXPIRED SESSION{deletedCount === 1 ? '' : 'S'}
              </p>
            )}
          </div>

          <div className="hidden md:grid grid-cols-2 gap-2 w-fit ml-auto">
            <button
              onClick={handleReload}
              disabled={loading || reloading || clearing}
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
              onClick={handleClearExpired}
              disabled={loading || reloading || clearing}
              className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-[#EF4444] text-white font-mono text-[9px] font-bold tracking-widest hover:bg-[#dc2626] transition-colors"
            >
              <TrashIcon className={`w-3 h-3 ${clearing ? 'animate-pulse' : ''}`} />
              CLEAR EXPIRED
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-2 md:hidden">
          <div className="flex w-full gap-2">
            <button
              onClick={handleReload}
              disabled={loading || reloading || clearing}
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
            onClick={handleClearExpired}
            disabled={loading || reloading || clearing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EF4444] text-white font-mono text-xs font-bold tracking-widest hover:bg-[#dc2626] transition-colors"
          >
            <TrashIcon className={`w-3.5 h-3.5 ${clearing ? 'animate-pulse' : ''}`} />
            CLEAR EXPIRED
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[#262626] mb-8">
        <div className="bg-[#0a0a0a] p-4">
          <p className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">TOTAL SESSIONS</p>
          <p className="font-sans text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-[#0a0a0a] p-4">
          <p className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">ACTIVE</p>
          <p className="font-sans text-2xl font-bold text-green-400">{stats.active}</p>
        </div>
        <div className="bg-[#0a0a0a] p-4 col-span-2">
          <p className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">EXPIRED</p>
          <p className="font-sans text-2xl font-bold text-[#EF4444]">{stats.expired}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#404040]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH USER EMAIL, OPERATOR, OR STATUS..."
          className="w-full bg-[#0a0a0a] border border-[#262626] pl-9 pr-4 py-2.5 font-mono text-xs text-white placeholder-[#333] focus:border-[#3B82F6] focus:outline-none transition-colors"
        />
      </div>

      <div className="border border-[#262626]">
        <div className="px-4 py-3 border-b border-[#262626]">
          <span className="font-mono text-[10px] text-[#666] tracking-widest">SESSION LOG</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-8 h-8 border border-[#EF4444] border-t-transparent animate-spin mx-auto mb-3" />
              <p className="font-mono text-[9px] text-[#404040] tracking-widest">
                LOADING SESSIONS...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#EF4444]">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#333]">NO SESSIONS YET</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#333]">NO RESULTS FOUND</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">ID</th>
                  <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">USER</th>
                  <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">EMAIL</th>
                  <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">ROLE</th>
                  <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">CREATED</th>
                  <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">EXPIRES</th>
                  <th className="text-center font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => {
                  const status = getSessionStatus(session.expires_at);
                  return (
                    <tr key={session.id} className="border-b border-[#111] last:border-0 hover:bg-[#0f0f0f] transition-colors">
                      <td className="font-mono text-[10px] text-[#404040] px-4 py-3 whitespace-nowrap">
                        #{session.id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-white">
                          {session.user?.operator_name || `USER #${session.user_id}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-[#999]">
                          {session.user?.email ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-[#999]">
                          {session.user?.roles?.[0]?.name ?? '—'}
                        </span>
                      </td>
                      <td className="font-mono text-[10px] text-[#666] px-4 py-3 text-right whitespace-nowrap">
                        {new Date(session.created_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="font-mono text-[10px] text-[#666] px-4 py-3 text-right whitespace-nowrap">
                        {new Date(session.expires_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 ${
                            status === 'ACTIVE'
                              ? 'text-green-400 bg-green-400/10'
                              : 'text-[#EF4444] bg-[#EF4444]/10'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
