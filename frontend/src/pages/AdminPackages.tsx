import { useEffect, useState } from 'react';
import {
  PackageIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  LockIcon,
  CheckIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  DownloadIcon,
} from 'lucide-react';
import { authService, Offer } from '../services/authService';
import { dataCache } from '../utils/dataCache';
import { useToast } from '../context/useToast';
import { exportToPdf } from '../utils/exportPdf';

const PACKAGES_CACHE_KEY = 'admin:packages';

export function AdminPackages() {
  const { showToast } = useToast();
  const cachedOffers = dataCache.get<Offer[]>(PACKAGES_CACHE_KEY);
  const [offers, setOffers] = useState<Offer[]>(cachedOffers ?? []);
  const [loading, setLoading] = useState(!cachedOffers);
  const [reloading, setReloading] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = async (
    options: { forceRefresh?: boolean; isReload?: boolean } = {}
  ) => {
    const { forceRefresh = false, isReload = false } = options;

    if (!forceRefresh) {
      const cached = dataCache.get<Offer[]>(PACKAGES_CACHE_KEY);
      if (cached) {
        setOffers(cached);
        setLoading(false);
        return;
      }
    }

    if (isReload) {
      setReloading(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await authService.getAllOffersAdmin();
      setOffers(data);
      dataCache.set(PACKAGES_CACHE_KEY, data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load packages';
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
    loadOffers();
  }, []);

  const handleReload = async () => {
    dataCache.invalidate(PACKAGES_CACHE_KEY);
    await loadOffers({ forceRefresh: true, isReload: true });
  };

  const handleToggle = async (id: number) => {
    setToggling(id);
    try {
      const updated = await authService.toggleOffer(id);
      setOffers((prev) => {
        const next = prev.map((o) => (o.id === updated.id ? updated : o));
        dataCache.set(PACKAGES_CACHE_KEY, next);
        return next;
      });
      showToast(updated.is_active ? 'PACKAGE ENABLED' : 'PACKAGE DISABLED', updated.is_active ? 'success' : 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Toggle failed';
      console.error('Toggle failed:', err);
      showToast(message, 'error');
    } finally {
      setToggling(null);
    }
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: 'SUBSCRIPTION PACKAGES',
      subtitle: `${offers.length} packages - exported ${new Date().toISOString()}`,
      columns: ['ID', 'NAME', 'TIER', 'PRICE', 'ACTIVE', 'RECOMMENDED'],
      rows: offers.map((o) => [
        o.id,
        o.name,
        o.tier_label || `Tier ${o.tier}`,
        `$${o.price}`,
        o.is_active ? 'Yes' : 'No',
        o.is_recommended ? 'Yes' : 'No',
      ]),
      filename: `ares-packages-${Date.now()}`,
    });
  };

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <PackageIcon className="w-4 h-4 text-[#EF4444]" />
            <h1 className="font-sans text-xl font-bold text-white tracking-wide">
              SUBSCRIPTION PACKAGES
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={handleReload}
              disabled={loading || reloading}
              className="flex items-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
            >
              <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors"
            >
              <DownloadIcon className="w-3 h-3" />
              EXPORT PDF
            </button>
          </div>
        </div>
        <p className="font-mono text-[10px] text-[#404040] tracking-wider">
          ENABLE OR DISABLE PLANS — DISABLED PLANS ARE HIDDEN FROM USERS
        </p>
      </div>

      <div className="flex w-full gap-2 mb-6 md:hidden">
        <button
          onClick={handleReload}
          disabled={loading || reloading}
          className="flex-1 flex items-center justify-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
        >
          <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
        <button
          onClick={handleExportPdf}
          className="flex-1 flex items-center justify-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors"
        >
          <DownloadIcon className="w-3 h-3" />
          EXPORT PDF
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#22C55E]" />
          <span className="font-mono text-[9px] text-[#404040] tracking-widest">VISIBLE TO USERS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#404040]" />
          <span className="font-mono text-[9px] text-[#404040] tracking-widest">HIDDEN FROM USERS</span>
        </div>
        <div className="flex items-center gap-2">
          <LockIcon className="w-3 h-3 text-[#404040]" />
          <span className="font-mono text-[9px] text-[#404040] tracking-widest">LOCKED — ALWAYS VISIBLE</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border border-[#EF4444] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="font-mono text-[9px] text-[#404040] tracking-widest">LOADING PACKAGES...</p>
          </div>
        </div>
      ) : error ? (
        <div className="border border-[#EF4444]/30 bg-[#EF4444]/5 p-4">
          <p className="font-mono text-[10px] text-[#EF4444] tracking-widest">{error}</p>
        </div>
      ) : (
        <>
          {/* Offer cards grid */}
          <div className="overflow-x-auto md:overflow-visible mb-8">
            <div className="grid grid-flow-col auto-cols-[18rem] grid-rows-3 gap-px bg-[#262626] min-w-[720px] md:min-w-0 md:grid-flow-row md:auto-cols-auto md:grid-cols-3 md:grid-rows-1">
              {offers.map((offer) => {
                const isLocked = offer.tier === 1;
                return (
                  <div
                    key={offer.id}
                    className={`bg-[#0a0a0a] p-6 flex flex-col relative ${
                      !offer.is_active ? 'opacity-50' : ''
                    }`}
                  >
                  {/* Top accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: offer.is_active ? offer.color : '#262626' }}
                  />

                  {/* Status bar */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="font-mono text-[9px] tracking-widest"
                      style={{ color: offer.color }}
                    >
                      {offer.tier_label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isLocked ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 border border-[#262626]">
                          <LockIcon className="w-2.5 h-2.5 text-[#404040]" />
                          <span className="font-mono text-[8px] text-[#404040] tracking-widest">LOCKED</span>
                        </div>
                      ) : (
                        <>
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
                            title={offer.is_active ? 'Disable — hides from users' : 'Enable — shows to users'}
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* Name + price */}
                  <div className="mb-4">
                    <h2 className="font-sans text-lg font-bold text-white mb-1">{offer.name}</h2>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="font-mono text-2xl font-bold"
                        style={{ color: offer.tier === 1 ? '#ffffff' : offer.color }}
                      >
                        {offer.price_label}
                      </span>
                      {offer.price_suffix && (
                        <span className="font-mono text-[10px] text-[#404040]">{offer.price_suffix}</span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5 flex-1 mb-4">
                    {offer.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckIcon
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: offer.tier === 1 ? '#404040' : offer.color }}
                        />
                        <span className="font-mono text-[10px] text-[#666]">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA preview */}
                  <div
                    className={`mt-auto text-center py-2 border font-mono text-[9px] tracking-widest ${
                      offer.cta_type === 'link'
                        ? 'text-white'
                        : 'text-[#404040]'
                    }`}
                    style={
                      offer.cta_type === 'link'
                        ? { backgroundColor: offer.color, borderColor: offer.color }
                        : offer.cta_type === 'contact'
                        ? { borderColor: offer.color, color: offer.color }
                        : { borderColor: '#262626' }
                    }
                  >
                    {offer.cta_type === 'contact' ? (
                      <span className="flex items-center justify-center gap-1">
                        {offer.cta_label} <ArrowRightIcon className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      offer.cta_label
                    )}
                  </div>

                  {/* Recommended badge */}
                  {offer.is_recommended && (
                    <div className="mt-2">
                      <span className="font-mono text-[8px] font-bold text-white bg-[#EF4444] px-2 py-0.5 tracking-widest">
                        RECOMMENDED
                      </span>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table view */}
          <div className="border border-[#262626] overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#666] tracking-widest">ALL PACKAGES — STATUS OVERVIEW</span>
                <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                  {offers.filter((o) => o.is_active).length} ACTIVE /&nbsp;
                  {offers.filter((o) => !o.is_active).length} DISABLED
                </span>
              </div>
              <div className="divide-y divide-[#1a1a1a]">
                {offers.map((offer) => {
                  const isLocked = offer.tier === 1;
                  return (
                    <div key={offer.id} className="flex items-center gap-4 px-4 py-3">
                    {/* Color dot */}
                    <div
                      className="w-2 h-2 flex-shrink-0"
                      style={{ backgroundColor: offer.is_active ? offer.color : '#262626' }}
                    />

                    {/* Tier + name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                          {offer.tier_label}
                        </span>
                        {offer.is_recommended && (
                          <span className="font-mono text-[8px] font-bold text-[#EF4444] border border-[#EF4444]/30 px-1 tracking-widest">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-white">{offer.name}</span>
                    </div>

                    {/* Price */}
                    <span
                      className="font-mono text-sm font-bold w-20 text-right flex-shrink-0"
                      style={{ color: offer.color }}
                    >
                      {offer.price_label}
                      {offer.price_suffix && (
                        <span className="font-mono text-[9px] text-[#404040] ml-0.5">{offer.price_suffix}</span>
                      )}
                    </span>

                    {/* Features count */}
                    <span className="font-mono text-[9px] text-[#404040] w-24 text-right flex-shrink-0 tracking-widest">
                      {offer.features.length} FEATURES
                    </span>

                    {/* Status + toggle */}
                    <div className="flex items-center gap-3 flex-shrink-0 w-32 justify-end">
                      {isLocked ? (
                        <div className="flex items-center gap-1.5">
                          <LockIcon className="w-3 h-3 text-[#404040]" />
                          <span className="font-mono text-[9px] text-[#404040] tracking-widest">LOCKED</span>
                        </div>
                      ) : (
                        <>
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
                            title={offer.is_active ? 'Disable offer' : 'Enable offer'}
                            className={`flex items-center transition-colors disabled:opacity-50 ${
                              offer.is_active
                                ? 'text-[#22C55E] hover:text-[#EF4444]'
                                : 'text-[#404040] hover:text-[#22C55E]'
                            }`}
                          >
                            {toggling === offer.id ? (
                              <div className="w-4 h-4 border border-current border-t-transparent animate-spin" />
                            ) : offer.is_active ? (
                              <ToggleRightIcon className="w-5 h-5" />
                            ) : (
                              <ToggleLeftIcon className="w-5 h-5" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
