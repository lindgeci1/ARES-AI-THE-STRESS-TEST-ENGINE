import { useEffect, useState } from 'react';
import {
  ActivityIcon,
  PackageIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  RefreshCwIcon,
  BarChart3Icon,
} from 'lucide-react';
import { authService, type AdminStats, type Offer } from '../services/authService';
import { dataCache } from '../utils/dataCache';

const OFFERS_CACHE_KEY = 'admin:offers';
const STATS_CACHE_KEY = 'admin:stats';

export function AdminDashboard() {
  const cachedOffers = dataCache.get<Offer[]>(OFFERS_CACHE_KEY);
  const cachedStats = dataCache.get<AdminStats>(STATS_CACHE_KEY);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState<AdminStats | null>(cachedStats);
  const [offers, setOffers] = useState<Offer[]>(cachedOffers ?? []);
  const [loading, setLoading] = useState(!cachedStats);
  const [offersLoading, setOffersLoading] = useState(!cachedOffers);
  const [reloading, setReloading] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = async (options: { forceRefresh?: boolean; isReload?: boolean } = {}) => {
    const { forceRefresh = false, isReload = false } = options;

    if (!forceRefresh) {
      const cachedStatsData = dataCache.get<AdminStats>(STATS_CACHE_KEY);
      const cachedOffersData = dataCache.get<Offer[]>(OFFERS_CACHE_KEY);

      if (cachedStatsData) {
        setStats(cachedStatsData);
        setLoading(false);
      }

      if (cachedOffersData) {
        setOffers(cachedOffersData);
        setOffersLoading(false);
      }

      if (cachedStatsData && cachedOffersData) {
        return;
      }
    }

    if (isReload) {
      setReloading(true);
    } else {
      setLoading(true);
    }
    setOffersLoading(true);

    try {
      const [statsData, offersData] = await Promise.all([
        authService.getAdminStats(),
        authService.getAllOffersAdmin(),
      ]);

      setStats(statsData);
      dataCache.set(STATS_CACHE_KEY, statsData);
      setOffers(offersData);
      dataCache.set(OFFERS_CACHE_KEY, offersData);
    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
    } finally {
      setOffersLoading(false);
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleReload = async () => {
    dataCache.invalidate(STATS_CACHE_KEY);
    dataCache.invalidate(OFFERS_CACHE_KEY);
    await loadDashboard({ forceRefresh: true, isReload: true });
  };

  const handleToggle = async (id: number) => {
    setToggling(id);
    try {
      const updated = await authService.toggleOffer(id);
      setOffers((prev) => {
        const next = prev.map((o) => (o.id === updated.id ? updated : o));
        dataCache.set(OFFERS_CACHE_KEY, next);
        return next;
      });
    } catch {
      // silently ignore
    } finally {
      setToggling(null);
    }
  };

  const primaryRevenue = stats?.total_revenue ?? 0;
  const activeUsers = stats?.active_users ?? 0;
  const totalUsers = stats?.total_users ?? 0;
  const processedDocs = stats?.processed_docs ?? 0;
  const pendingDocs = stats?.pending_docs ?? 0;
  const failedDocs = stats?.failed_docs ?? 0;
  const totalDocs = stats?.total_documents ?? 0;
  const totalAudits = stats?.total_audit_reports ?? 0;
  const totalDebates = stats?.total_audio_debates ?? 0;
  const avgResilience = stats?.avg_resilience ?? 0;
  const totalPayments = stats?.total_payments ?? 0;

  return (
    <div className="p-6 min-h-full">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ActivityIcon className="w-4 h-4 text-[#EF4444]" />
            <h1 className="font-sans text-xl font-bold text-white tracking-wide">
              GLOBAL DASHBOARD
            </h1>
          </div>
          <p className="font-mono text-[10px] text-[#404040] tracking-widest">
            {currentTime.toISOString().replace('T', ' ').slice(0, 19)} UTC
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30">
            <div className="w-1.5 h-1.5 bg-[#EF4444] animate-pulse" />
            <span className="font-mono text-[9px] text-[#EF4444] tracking-widest">
              LIVE DATABASE METRICS
            </span>
          </div>
          <button
            onClick={handleReload}
            disabled={loading || reloading}
            className="flex items-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border border-[#EF4444] border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#262626] mb-px">
            <div className="bg-[#0a0a0a] px-6 py-5">
              <div className="font-mono text-[10px] text-[#404040] tracking-widest mb-2">TOTAL DOCUMENTS</div>
              <div className="font-mono text-3xl font-bold text-white">
                {totalDocs.toLocaleString() || '—'}
              </div>
              <div className="font-mono text-[9px] text-[#404040] mt-1">
                {pendingDocs || 0} pending · {failedDocs || 0} failed
              </div>
            </div>
            <div className="bg-[#0a0a0a] px-6 py-5">
              <div className="font-mono text-[10px] text-[#404040] tracking-widest mb-2">ACTIVE USERS</div>
              <div className="font-mono text-3xl font-bold text-[#3B82F6]">
                {activeUsers.toLocaleString() || '—'}
              </div>
              <div className="font-mono text-[9px] text-[#404040] mt-1">
                of {totalUsers || 0} registered
              </div>
            </div>
            <div className="bg-[#0a0a0a] px-6 py-5">
              <div className="font-mono text-[10px] text-[#404040] tracking-widest mb-2">TOTAL REVENUE</div>
              <div className="font-mono text-3xl font-bold text-[#22C55E]">
                ${primaryRevenue.toLocaleString() || '0'}
              </div>
              <div className="font-mono text-[9px] text-[#404040] mt-1">
                {totalPayments || 0} successful payments
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#262626] mb-6">
            <div className="bg-[#0a0a0a] px-6 py-5">
              <div className="font-mono text-[10px] text-[#404040] tracking-widest mb-2">PROCESSED DOCS</div>
              <div className="font-mono text-3xl font-bold text-[#22C55E]">
                {processedDocs.toLocaleString() || '—'}
              </div>
            </div>
            <div className="bg-[#0a0a0a] px-6 py-5">
              <div className="font-mono text-[10px] text-[#404040] tracking-widest mb-2">TOTAL AUDITS</div>
              <div className="font-mono text-3xl font-bold text-[#EAB308]">
                {totalAudits.toLocaleString() || '—'}
              </div>
              <div className="font-mono text-[9px] text-[#404040] mt-1">
                {totalDebates || 0} audio debates
              </div>
            </div>
            <div className="bg-[#0a0a0a] px-6 py-5">
              <div className="font-mono text-[10px] text-[#404040] tracking-widest mb-2">AVG RESILIENCE</div>
              <div
                className="font-mono text-3xl font-bold"
                style={{
                  color: !avgResilience
                    ? '#404040'
                    : avgResilience < 40
                    ? '#EF4444'
                    : avgResilience < 70
                    ? '#EAB308'
                    : '#22C55E',
                }}
              >
                {avgResilience ? `${avgResilience}%` : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="border border-[#262626] bg-[#0a0a0a]">
              <div className="px-4 py-3 border-b border-[#262626] flex items-center gap-2">
                <ActivityIcon className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="font-mono text-[10px] text-[#666] tracking-widest">
                  RECENT ACTIVITY
                </span>
              </div>
              <div className="divide-y divide-[#1a1a1a] max-h-[340px] overflow-y-auto">
                {!stats?.recent_activity?.length ? (
                  <div className="px-4 py-6 text-center">
                    <span className="font-mono text-[9px] text-[#404040]">NO RECENT ACTIVITY</span>
                  </div>
                ) : (
                  stats.recent_activity.map((activity, index) => (
                    <div key={`${activity.document_id}-${index}`} className="flex items-center gap-4 px-4 py-3">
                      <span className="font-mono text-[9px] text-[#404040] flex-shrink-0">
                        {new Date(activity.created_at).toLocaleString()}
                      </span>
                      <span
                        className={`font-mono text-[9px] font-bold tracking-widest flex-shrink-0 px-1.5 py-0.5 ${
                          activity.status === 'processed'
                            ? 'text-[#22C55E] bg-[#22C55E]/10'
                            : activity.status === 'pending'
                            ? 'text-[#EAB308] bg-[#EAB308]/10'
                            : 'text-[#EF4444] bg-[#EF4444]/10'
                        }`}
                      >
                        {activity.status.toUpperCase()}
                      </span>
                      <span className="font-mono text-[10px] text-[#666] truncate">
                        {activity.file_name}
                      </span>
                      <span className="font-mono text-[9px] text-[#333] ml-auto flex-shrink-0">
                        {activity.user_email}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border border-[#262626] bg-[#0a0a0a]">
              <div className="px-4 py-3 border-b border-[#262626] flex items-center gap-2">
                <BarChart3Icon className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="font-mono text-[10px] text-[#666] tracking-widest">
                  PLATFORM BREAKDOWN
                </span>
              </div>
              <div className="px-4 py-3 space-y-4">
                {[
                  { label: 'PROCESSED', value: processedDocs, total: totalDocs || 1, color: '#22C55E' },
                  { label: 'PENDING', value: pendingDocs, total: totalDocs || 1, color: '#EAB308' },
                  { label: 'FAILED', value: failedDocs, total: totalDocs || 1, color: '#EF4444' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-[10px] text-[#666]">{item.label}</span>
                      <span className="font-mono text-[10px]" style={{ color: item.color }}>
                        {item.value}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#1a1a1a]">
                      <div
                        className="h-full"
                        style={{
                          width: `${(item.value / item.total) * 100}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-[#262626]">
            <div className="overflow-x-auto">
              <div className="min-w-[720px] md:min-w-0">
                <div className="px-4 py-3 border-b border-[#262626] flex items-center gap-2">
                  <PackageIcon className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span className="font-mono text-[10px] text-[#666] tracking-widest">
                    SUBSCRIPTION PACKAGES
                  </span>
                </div>

                {offersLoading ? (
                  <div className="p-6 text-center">
                    <div className="w-6 h-6 border border-[#EF4444] border-t-transparent animate-spin mx-auto mb-2" />
                    <p className="font-mono text-[9px] text-[#404040] tracking-widest">LOADING PACKAGES...</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-rows-3 gap-px bg-[#1a1a1a]">
                      {offers.map((offer) => (
                        <div
                          key={offer.id}
                          className="bg-[#0a0a0a] px-4 py-3 flex flex-wrap items-center gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: offer.color }} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                                  {offer.tier_label}
                                </span>
                                {offer.is_recommended && (
                                  <span className="font-mono text-[8px] font-bold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-1.5 py-0.5 tracking-widest">
                                    RECOMMENDED
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-sm font-bold text-white tracking-wide">
                                {offer.name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-baseline gap-1 min-w-[140px]">
                            <span className="font-mono text-base font-bold" style={{ color: offer.color }}>
                              {offer.price_label}
                            </span>
                            {offer.price_suffix && (
                              <span className="font-mono text-[9px] text-[#404040]">{offer.price_suffix}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 min-w-[140px]">
                            <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                              {offer.features.length} FEATURES
                            </span>
                          </div>

                          <div className="ml-auto flex items-center gap-3">
                            <span
                              className={`font-mono text-[9px] font-bold tracking-widest ${
                                offer.is_active ? 'text-[#22C55E]' : 'text-[#404040]'
                              }`}
                            >
                              {offer.is_active ? 'ACTIVE' : 'DISABLED'}
                            </span>
                            <button
                              onClick={() => handleToggle(offer.id)}
                              disabled={toggling === offer.id}
                              title={offer.is_active ? 'Disable this offer' : 'Enable this offer'}
                              className={`flex items-center transition-colors disabled:opacity-50 ${
                                offer.is_active
                                  ? 'text-[#22C55E] hover:text-[#EF4444]'
                                  : 'text-[#404040] hover:text-[#22C55E]'
                              }`}
                            >
                              {toggling === offer.id ? (
                                <div className="w-5 h-5 border border-current border-t-transparent animate-spin" />
                              ) : offer.is_active ? (
                                <ToggleRightIcon className="w-6 h-6" />
                              ) : (
                                <ToggleLeftIcon className="w-6 h-6" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
