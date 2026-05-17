import { useEffect, useState } from 'react';
import { CheckIcon, ZapIcon, ArrowRightIcon, RefreshCwIcon, SearchIcon, DownloadIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authService, Offer, Payment } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { dataCache } from '../utils/dataCache';
import { useToast } from '../context/useToast';

const OFFERS_CACHE_KEY = 'user:offers';
const PAYMENTS_CACHE_KEY = 'user:payments';

export function Billing() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const cachedOffers = dataCache.get<Offer[]>(OFFERS_CACHE_KEY);
  const cachedPayments = dataCache.get<Payment[]>(PAYMENTS_CACHE_KEY);
  const [offers, setOffers] = useState<Offer[]>(cachedOffers ?? []);
  const [offersLoading, setOffersLoading] = useState(!cachedOffers);
  const [payments, setPayments] = useState<Payment[]>(cachedPayments ?? []);
  const [paymentsLoading, setPaymentsLoading] = useState(!cachedPayments);
  const [reloading, setReloading] = useState(false);
  const [paymentsSearch, setPaymentsSearch] = useState('');

  const loadBillingData = async (
    options: { forceRefresh?: boolean; isReload?: boolean } = {}
  ) => {
    const { forceRefresh = false, isReload = false } = options;
    const cachedOffersData = !forceRefresh ? dataCache.get<Offer[]>(OFFERS_CACHE_KEY) : undefined;
    const cachedPaymentsData = !forceRefresh ? dataCache.get<Payment[]>(PAYMENTS_CACHE_KEY) : undefined;

    if (cachedOffersData) {
      setOffers(cachedOffersData);
      setOffersLoading(false);
    }

    if (cachedPaymentsData) {
      setPayments(cachedPaymentsData);
      setPaymentsLoading(false);
    }

    const needsOffers = forceRefresh || !cachedOffersData;
    const needsPayments = forceRefresh || !cachedPaymentsData;

    if (!needsOffers && !needsPayments) {
      return;
    }

    if (isReload) {
      setReloading(true);
    } else {
      if (needsOffers) {
        setOffersLoading(true);
      }
      if (needsPayments) {
        setPaymentsLoading(true);
      }
    }

    try {
      const requests: Promise<void>[] = [];

      if (needsOffers) {
        requests.push(
          authService
            .getActiveOffers()
            .then((data) => {
              setOffers(data);
              dataCache.set(OFFERS_CACHE_KEY, data);
            })
            .catch((error) => {
              console.error('Failed to load offers:', error);
            })
            .finally(() => {
              setOffersLoading(false);
            })
        );
      }

      if (needsPayments) {
        requests.push(
          authService
            .getPaymentHistory()
            .then((data) => {
              setPayments(data);
              dataCache.set(PAYMENTS_CACHE_KEY, data);
            })
            .catch((error) => {
              console.error('Failed to load payment history:', error);
            })
            .finally(() => {
              setPaymentsLoading(false);
            })
        );
      }

      await Promise.all(requests);
    } finally {
      if (isReload) {
        setReloading(false);
      }
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  const handleReload = async () => {
    dataCache.invalidate(OFFERS_CACHE_KEY);
    dataCache.invalidate(PAYMENTS_CACHE_KEY);
    await loadBillingData({ forceRefresh: true, isReload: true });
  };

  const auditsPerformed = user?.user_usage?.audits_performed ?? 0;
  const auditLimit = user?.user_usage?.audit_limit ?? 0;
  const roundsPerAudit = user?.user_usage?.rounds_per_audit ?? 3;
  const auditsRemaining = Math.max(auditLimit - auditsPerformed, 0);
  const usagePercent = auditLimit > 0 ? Math.min((auditsPerformed / auditLimit) * 100, 100) : 0;

  const filteredPayments = payments.filter((payment) => {
    const query = paymentsSearch.toLowerCase();
    const planName = payment.offer?.name?.toLowerCase() ?? 'plan';
    return planName.includes(query) || payment.status.toLowerCase().includes(query);
  });

  const activeTier = user?.subscription_tier?.toUpperCase() ?? 'FREE';
  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-1">
          <div className="flex items-center gap-2">
            <ZapIcon className="w-4 h-4 text-[#EF4444]" />
            <h1 className="font-sans text-xl font-bold text-white tracking-wide">
              BILLING &amp; PLANS
            </h1>
          </div>
          <button
            onClick={handleReload}
            disabled={offersLoading || paymentsLoading || reloading}
            className="hidden md:flex items-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>
        <div className="mt-3 md:hidden">
          <button
            onClick={handleReload}
            disabled={offersLoading || paymentsLoading || reloading}
            className="flex w-full items-center justify-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 py-2 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>
        <p className="font-mono text-[10px] text-[#404040] tracking-wider">
          CURRENT PLAN: {activeTier}
        </p>
      </div>

      {/* Current usage */}
      <div className="bg-[#0a0a0a] border border-[#262626] p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] text-[#666] tracking-widest">
            MONTHLY QUOTA USAGE
          </span>
          <span className="font-mono text-xs text-[#EF4444] font-bold">
            {auditsPerformed} / {auditLimit} AUDITS
          </span>
        </div>
        <div className="w-full h-2 bg-[#1a1a1a] mb-2">
          <div
            className="h-full bg-[#EF4444]"
            style={{
              width: `${usagePercent}%`
            }}
          />
        </div>
        <p className="font-mono text-[9px] text-[#404040]">
          {auditsRemaining} AUDITS REMAINING THIS CYCLE
        </p>
        <p className="font-mono text-[9px] text-[#404040] mt-1">
          ROUNDS PER AUDIT: {roundsPerAudit}
        </p>
      </div>

      {/* Pricing tiers - loaded from DB */}
      {offersLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border border-[#EF4444] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="font-mono text-[9px] text-[#404040] tracking-widest">LOADING PACKAGES...</p>
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-px bg-[#262626] mb-8 ${
            offers.length <= 1
              ? 'md:grid-cols-1'
              : offers.length === 2
              ? 'md:grid-cols-2'
              : offers.length === 3
              ? 'md:grid-cols-3'
              : 'md:grid-cols-2 xl:grid-cols-4'
          }`}
        >
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`bg-[#0a0a0a] p-6 flex flex-col relative ${
                offer.is_recommended ? 'border-t-2' : ''
              }`}
              style={offer.is_recommended ? { borderTopColor: offer.color } : {}}
            >
              {offer.is_recommended && (
                <div className="absolute top-0 right-4 -translate-y-1/2">
                  <span className="font-mono text-[9px] font-bold text-white bg-[#EF4444] px-2 py-0.5 tracking-widest">
                    RECOMMENDED
                  </span>
                </div>
              )}

              <div className="mb-4">
                <span className="font-mono text-[9px] tracking-widest" style={{ color: offer.color }}>
                  {offer.tier_label}
                </span>
                <h2 className="font-sans text-lg font-bold text-white mt-1">{offer.name}</h2>
                <div className="flex items-baseline gap-1 mt-2">
                  <span
                    className="font-mono text-3xl font-bold"
                    style={{ color: offer.price === 0 && offer.tier === 1 ? '#ffffff' : offer.color }}
                  >
                    {offer.price_label}
                  </span>
                  {offer.price_suffix && (
                    <span className="font-mono text-xs text-[#404040]">{offer.price_suffix}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
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

              {offer.cta_type === 'none' && (
                <button className="w-full py-2.5 border border-[#262626] text-[#404040] font-mono text-xs tracking-widest cursor-default">
                  {offer.cta_label}
                </button>
              )}
              {offer.cta_type === 'link' && activeTier === offer.name.toUpperCase() ? (
                <button
                  disabled
                  className="w-full py-2.5 border border-[#262626] text-[#404040] font-mono text-xs tracking-widest cursor-default"
                >
                  CURRENT PLAN
                </button>
              ) : offer.cta_type === 'link' ? (
                <Link
                  to={offer.cta_link}
                  className="w-full py-2.5 font-mono text-xs font-bold tracking-widest text-white text-center block transition-colors"
                  style={{ backgroundColor: offer.color }}
                >
                  {offer.cta_label}
                </Link>
              ) : offer.cta_type === 'contact' ? (
                <a
                  href={offer.cta_link}
                  className="w-full py-2.5 border font-mono text-xs font-bold tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2"
                  style={{ borderColor: offer.color, color: offer.color }}
                >
                  {offer.cta_label}
                  <ArrowRightIcon className="w-3 h-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Billing history */}
      <div className="border border-[#262626]">
        <div className="px-4 py-3 border-b border-[#262626]">
          <span className="font-mono text-[10px] text-[#666] tracking-widest">
            BILLING HISTORY
          </span>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#404040]" />
            <input
              type="text"
              value={paymentsSearch}
              onChange={(e) => setPaymentsSearch(e.target.value)}
              placeholder="SEARCH BILLING HISTORY..."
              className="w-full bg-[#0a0a0a] border border-[#262626] pl-9 pr-4 py-2.5 font-mono text-xs text-white placeholder-[#333] focus:border-[#3B82F6] focus:outline-none transition-colors"
            />
          </div>
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border border-[#EF4444] border-t-transparent animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <p className="font-mono text-[10px] text-[#333] text-center py-4">
              NO BILLING HISTORY
            </p>
          ) : filteredPayments.length === 0 ? (
            <p className="font-mono text-[10px] text-[#333] text-center py-4">
              NO RESULTS FOUND
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full table-auto">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest pb-2 pr-4 whitespace-nowrap">DATE</th>
                    <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest pb-2 pr-4 whitespace-nowrap">PLAN</th>
                    <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest pb-2 pr-4 whitespace-nowrap">AMOUNT</th>
                    <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest pb-2 whitespace-nowrap">STATUS</th>
                    <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest pb-2 whitespace-nowrap">RECEIPT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="border-b border-[#111] last:border-0">
                      <td className="font-mono text-[10px] text-[#666] py-2.5 pr-4 whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="font-mono text-[10px] text-white py-2.5 pr-4 whitespace-nowrap">
                        {p.offer?.name ?? 'PLAN'}
                      </td>
                      <td className="font-mono text-[10px] text-white py-2.5 pr-4 text-right whitespace-nowrap">
                        ${p.amount_paid.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <span
                          className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 ${
                            p.status === 'succeeded'
                              ? 'text-green-400 bg-green-400/10'
                              : p.status === 'pending'
                              ? 'text-yellow-400 bg-yellow-400/10'
                              : 'text-[#EF4444] bg-[#EF4444]/10'
                          }`}
                        >
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {p.status === 'succeeded' && (
                          <button
                            onClick={async () => {
                              try {
                                showToast('OPENING STRIPE RECEIPT', 'info');
                                const data = await authService.getPaymentReceipt(p.id);
                                window.open(data.receipt_url, '_blank');
                              } catch (err: any) {
                                showToast(err.message || 'Failed to fetch payment receipt', 'error');
                              }
                            }}
                            className="ml-auto flex items-center gap-1 px-2 py-1 border border-[#262626] text-[#666] font-mono text-[9px] tracking-widest hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                          >
                            <DownloadIcon className="w-3 h-3" />
                            RECEIPT
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
