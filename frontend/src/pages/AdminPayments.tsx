import { useEffect, useState } from 'react';
import { CreditCardIcon, RefreshCwIcon, SearchIcon, DownloadIcon } from 'lucide-react';
import { authService, Payment } from '../services/authService';
import { dataCache } from '../utils/dataCache';
import { useToast } from '../context/useToast';
import { exportToPdf } from '../utils/exportPdf';

const PAYMENTS_CACHE_KEY = 'admin:payments';

export function AdminPayments() {
  const { showToast } = useToast();
  const cachedPayments = dataCache.get<Payment[]>(PAYMENTS_CACHE_KEY);
  const [payments, setPayments] = useState<Payment[]>(cachedPayments ?? []);
  const [loading, setLoading] = useState(!cachedPayments);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async (
    options: { forceRefresh?: boolean; isReload?: boolean } = {}
  ) => {
    const { forceRefresh = false, isReload = false } = options;

    if (!forceRefresh) {
      const cached = dataCache.get<Payment[]>(PAYMENTS_CACHE_KEY);
      if (cached) {
        setPayments(cached);
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
      const data = await authService.getAllPayments();
      setPayments(data);
      dataCache.set(PAYMENTS_CACHE_KEY, data);
    } catch (err: any) {
      const message = err.message || 'Failed to load payments.';
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

  useEffect(() => { load(); }, []);

  const handleReload = async () => {
    dataCache.invalidate(PAYMENTS_CACHE_KEY);
    await load({ forceRefresh: true, isReload: true });
  };

  const totalRevenue = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount_paid, 0);

  const filteredPayments = payments.filter((payment) => {
    const query = search.toLowerCase();
    const userEmail = payment.user?.email?.toLowerCase() ?? '';
    const offerName = payment.offer?.name?.toLowerCase() ?? '';
    const status = payment.status.toLowerCase();

    return (
      userEmail.includes(query) ||
      offerName.includes(query) ||
      status.includes(query)
    );
  });

  const handleExportPdf = () => {
    exportToPdf({
      title: 'PAYMENT TRANSACTIONS',
      subtitle: `${payments.length} payments - exported ${new Date().toISOString()}`,
      columns: ['ID', 'USER', 'OFFER', 'AMOUNT', 'STATUS', 'DATE'],
      rows: payments.map((p) => [
        p.id,
        p.user?.email || '-',
        p.offer?.name || '-',
        `$${p.amount_paid}`,
        p.status,
        new Date(p.created_at).toLocaleDateString(),
      ]),
      filename: `ares-payments-${Date.now()}`,
    });
  };

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <CreditCardIcon className="w-4 h-4 text-[#EF4444]" />
            <h1 className="font-sans text-xl font-bold text-white tracking-wide">
              PAYMENTS
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
          ALL STRIPE TRANSACTIONS
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

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-px bg-[#262626] mb-8">
        <div className="bg-[#0a0a0a] p-4">
          <p className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">TOTAL TRANSACTIONS</p>
          <p className="font-sans text-2xl font-bold text-white">{payments.length}</p>
        </div>
        <div className="bg-[#0a0a0a] p-4">
          <p className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">SUCCEEDED</p>
          <p className="font-sans text-2xl font-bold text-green-400">
            {payments.filter((p) => p.status === 'succeeded').length}
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-4 col-span-2">
          <p className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">TOTAL REVENUE</p>
          <p className="font-sans text-2xl font-bold text-[#EF4444]">
            ${totalRevenue.toFixed(2)}
          </p>
        </div>
      </div>

          {/* Search (placed outside the table container) */}
          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#404040]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH USER, PLAN, OR STATUS..."
              className="w-full bg-[#0a0a0a] border border-[#262626] pl-9 pr-4 py-2.5 font-mono text-xs text-white placeholder-[#333] focus:border-[#3B82F6] focus:outline-none transition-colors"
            />
          </div>

          {/* Table */}
          <div className="border border-[#262626]">
            <div className="px-4 py-3 border-b border-[#262626]">
              <span className="font-mono text-[10px] text-[#666] tracking-widest">TRANSACTION LOG</span>
            </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-8 h-8 border border-[#EF4444] border-t-transparent animate-spin mx-auto mb-3" />
              <p className="font-mono text-[9px] text-[#404040] tracking-widest">
                LOADING TRANSACTIONS...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#EF4444]">{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#333]">NO TRANSACTIONS YET</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#333]">NO RESULTS FOUND</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">
                    ID
                  </th>
                  <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">
                    USER
                  </th>
                  <th className="text-left font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">
                    PLAN
                  </th>
                  <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">
                    AMOUNT
                  </th>
                  <th className="text-center font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">
                    STATUS
                  </th>
                  <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">
                    DATE
                  </th>
                  <th className="text-right font-mono text-[9px] text-[#404040] tracking-widest px-4 py-3">
                    RECEIPT
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="border-b border-[#111] last:border-0 hover:bg-[#0f0f0f] transition-colors">
                    <td className="font-mono text-[10px] text-[#404040] px-4 py-3 whitespace-nowrap">
                      #{p.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[10px] text-[#999]">
                        {p.user?.email ?? `USER #${p.user_id}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[10px] text-white">
                        {p.offer?.name ?? '—'}
                      </span>
                    </td>
                    <td className="font-mono text-[10px] text-white px-4 py-3 text-right whitespace-nowrap">
                      ${p.amount_paid.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
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
                    <td className="font-mono text-[10px] text-[#666] px-4 py-3 text-right">
                      {new Date(p.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          showToast('OPENING STRIPE RECEIPT', 'info');
                          window.open(`https://dashboard.stripe.com/payments/${p.stripe_session_id}`, '_blank');
                        }}
                        className="ml-auto flex items-center gap-1 px-2 py-1 border border-[#262626] text-[#666] font-mono text-[9px] tracking-widest hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                      >
                        OPEN
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
