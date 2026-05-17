import React, { useEffect, useMemo, useState } from 'react';
import {
  FileTextIcon,
  TrashIcon,
  SearchIcon,
  DownloadIcon,
  EyeIcon,
  XIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  ActivityIcon,
} from 'lucide-react';
import {
  authService,
  type Document as BackendDocument,
  type User as APIUser,
  type AuditReport,
} from '../services/authService';
import { dataCache } from '../utils/dataCache';
import { useToast } from '../context/useToast';
import { exportToPdf } from '../utils/exportPdf';

const DOCUMENTS_CACHE_KEY = 'admin:documents';

type DocumentsCachePayload = {
  documents: BackendDocument[];
  users: APIUser[];
};

type DocStatus = 'PROCESSED' | 'PROCESSING' | 'FAILED' | 'ARCHIVED';

type AdminDocument = {
  source: BackendDocument;
  owner: string;
  ownerEmail: string;
  status: DocStatus;
};

function mapBackendStatus(status: string): DocStatus {
  switch (status?.toLowerCase()) {
    case 'processed':
      return 'PROCESSED';
    case 'processing':
      return 'PROCESSING';
    case 'pending':
      return 'PROCESSING';
    case 'failed':
      return 'FAILED';
    case 'archived':
      return 'ARCHIVED';
    default:
      return 'PROCESSING';
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch {
    return dateString;
  }
}

function getLatestReport(doc: BackendDocument): AuditReport | null {
  if (!doc.audit_reports || doc.audit_reports.length === 0) return null;
  return doc.audit_reports.reduce((latest, report) =>
    report.round_number > latest.round_number ? report : latest,
  doc.audit_reports[0]);
}

function parseVulnerabilityCount(report: AuditReport | null): number {
  if (!report?.vulnerabilities) return 0;
  if (Array.isArray(report.vulnerabilities)) return report.vulnerabilities.length;
  return 0;
}

type SortKey = 'name' | 'owner' | 'resilienceScore' | 'uploadDate' | 'rounds';

export function AdminDocuments() {
  const { showToast } = useToast();
  const cachedDocuments = dataCache.get<DocumentsCachePayload>(DOCUMENTS_CACHE_KEY);

  const [documents, setDocuments] = useState<AdminDocument[]>(() => {
    if (!cachedDocuments) return [];

    return cachedDocuments.documents.map((doc) => {
      const user = cachedDocuments.users.find((u) => u.id === doc.user_id);
      return {
        source: doc,
        owner: user?.operator_name || 'Unknown User',
        ownerEmail: user?.email || 'unknown@example.com',
        status: mapBackendStatus(doc.status),
      };
    });
  });

  const [users, setUsers] = useState<APIUser[]>(cachedDocuments?.users ?? []);
  const [loading, setLoading] = useState(!cachedDocuments);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('uploadDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewDoc, setViewDoc] = useState<AdminDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDocument | null>(null);
  const [resilienceHistoryDoc, setResilienceHistoryDoc] = useState<BackendDocument | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const persistCache = (docs: BackendDocument[], allUsers: APIUser[]) => {
    dataCache.set<DocumentsCachePayload>(DOCUMENTS_CACHE_KEY, {
      documents: docs,
      users: allUsers,
    });
  };

  const mapToAdminDocuments = (backendDocs: BackendDocument[], allUsers: APIUser[]): AdminDocument[] => {
    return backendDocs.map((doc) => {
      const user = allUsers.find((u) => u.id === doc.user_id);
      return {
        source: doc,
        owner: user?.operator_name || 'Unknown User',
        ownerEmail: user?.email || 'unknown@example.com',
        status: mapBackendStatus(doc.status),
      };
    });
  };

  const fetchDocuments = async (
    options: { forceRefresh?: boolean; isReload?: boolean } = {}
  ) => {
    const { forceRefresh = false, isReload = false } = options;

    if (!forceRefresh) {
      const cached = dataCache.get<DocumentsCachePayload>(DOCUMENTS_CACHE_KEY);
      if (cached) {
        setUsers(cached.users);
        setDocuments(mapToAdminDocuments(cached.documents, cached.users));
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

      setError(null);

      const [backendDocs, fetchedUsers] = await Promise.all([
        authService.getAllDocuments(),
        authService.getAllUsers(),
      ]);

      setUsers(fetchedUsers);
      setDocuments(mapToAdminDocuments(backendDocs, fetchedUsers));
      persistCache(backendDocs, fetchedUsers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setError(message);
      showToast(message, 'error');
      setDocuments([]);
    } finally {
      if (isReload) {
        setReloading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleReload = async () => {
    dataCache.invalidate(DOCUMENTS_CACHE_KEY);
    await fetchDocuments({ forceRefresh: true, isReload: true });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await authService.deleteDocument(id);

      setDocuments((prev) => {
        const next = prev.filter((d) => d.source.id !== id);
        persistCache(next.map((d) => d.source), users);
        return next;
      });

      setDeleteTarget(null);
      showToast('DOCUMENT DELETED', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: 'GLOBAL DOCUMENT REGISTRY',
      subtitle: `${documents.length} documents - exported ${new Date().toISOString()}`,
      columns: ['ID', 'DOCUMENT', 'OWNER', 'RESILIENCE', 'STATUS', 'UPLOADED', 'ROUNDS'],
      rows: documents.map((d) => {
        const latest = getLatestReport(d.source);
        const score = latest?.resilience_score;
        return [
          d.source.id,
          d.source.file_name,
          d.owner,
          score != null ? `${score}%` : '-',
          d.status,
          formatDate(d.source.created_at),
          d.source.rounds_used || 1,
        ];
      }),
      filename: `ares-documents-${Date.now()}`,
    });
  };

  const filtered = useMemo(() => {
    return documents
      .filter((d) => {
        const latestReport = getLatestReport(d.source);
        const score = latestReport?.resilience_score ?? -1;

        return (
          d.source.file_name.toLowerCase().includes(search.toLowerCase()) ||
          d.owner.toLowerCase().includes(search.toLowerCase()) ||
          d.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
          d.status.toLowerCase().includes(search.toLowerCase()) ||
          String(score).includes(search.toLowerCase()) ||
          String(d.source.rounds_used || 1).includes(search.toLowerCase())
        );
      })
      .sort((a, b) => {
        const getSortValue = (doc: AdminDocument): string | number => {
          const latestReport = getLatestReport(doc.source);

          if (sortKey === 'name') return doc.source.file_name.toLowerCase();
          if (sortKey === 'owner') return doc.owner.toLowerCase();
          if (sortKey === 'resilienceScore') return latestReport?.resilience_score ?? -1;
          if (sortKey === 'rounds') return doc.source.rounds_used || 1;
          return doc.source.created_at;
        };

        const aVal = getSortValue(a);
        const bVal = getSortValue(b);

        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [documents, search, sortKey, sortDir]);

  const processedDocs = documents.filter((d) => d.status === 'PROCESSED');
  const avgScore = processedDocs.length
    ? Math.round(
        processedDocs.reduce((acc, d) => acc + (getLatestReport(d.source)?.resilience_score ?? 0), 0) /
          processedDocs.length
      )
    : 0;

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-[#262626] ml-1">↕</span>;
    return <span className="text-[#EF4444] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="p-6 min-h-full">
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="font-mono text-sm text-[#666]">LOADING DOCUMENTS...</div>
        </div>
      )}

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 px-4 py-3 mb-4 rounded">
          <p className="font-mono text-xs text-[#EF4444]">ERROR: {error}</p>
          <button
            onClick={() => fetchDocuments({ forceRefresh: true })}
            className="font-mono text-xs text-[#EF4444] hover:text-white mt-2 underline"
          >
            RETRY
          </button>
        </div>
      )}

      {!loading && (
        <>
          <div className="mb-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileTextIcon className="w-4 h-4 text-[#EF4444]" />
                  <h1 className="font-sans text-xl font-bold text-white tracking-wide">DOCUMENT REGISTRY</h1>
                </div>
                <p className="font-mono text-[10px] text-[#404040] tracking-widest">
                  {documents.length} DOCUMENTS — AVG RESILIENCE: {avgScore}%
                </p>
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

          <div className="grid grid-cols-2 gap-px bg-[#262626] mb-5">
            <div className="bg-[#0a0a0a] px-4 py-3">
              <div className="font-mono text-lg font-bold text-white">
                {documents.filter((d) => d.status === 'PROCESSED').length}
              </div>
              <div className="font-mono text-[9px] text-[#404040] tracking-widest">PROCESSED</div>
            </div>
            <div className="bg-[#0a0a0a] px-4 py-3">
              <div className="font-mono text-lg font-bold text-yellow-400">
                {documents.filter((d) => d.status === 'PROCESSING').length}
              </div>
              <div className="font-mono text-[9px] text-[#404040] tracking-widest">PROCESSING</div>
            </div>
            <div className="bg-[#0a0a0a] px-4 py-3">
              <div className="font-mono text-lg font-bold text-[#EF4444]">
                {documents.filter((d) => d.status === 'FAILED').length}
              </div>
              <div className="font-mono text-[9px] text-[#404040] tracking-widest">FAILED</div>
            </div>
            <div className="bg-[#0a0a0a] px-4 py-3">
              <div className="font-mono text-lg font-bold text-[#22C55E]">{avgScore}%</div>
              <div className="font-mono text-[9px] text-[#404040] tracking-widest">AVG RESILIENCE</div>
            </div>
          </div>

          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#404040]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH DOCUMENTS OR OWNERS..."
              className="w-full bg-[#0a0a0a] border border-[#262626] pl-9 pr-4 py-2.5 font-mono text-xs text-white placeholder-[#333] focus:border-[#3B82F6] focus:outline-none transition-colors"
            />
          </div>

          <div className="border border-[#262626] overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                      <tr className="border-b border-[#262626] bg-[#0a0a0a]">
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="font-mono text-[9px] text-[#404040] tracking-widest hover:text-white transition-colors"
                    >
                      DOCUMENT <SortIndicator col="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('owner')}
                      className="font-mono text-[9px] text-[#404040] tracking-widest hover:text-white transition-colors"
                    >
                      OWNER <SortIndicator col="owner" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('resilienceScore')}
                      className="font-mono text-[9px] text-[#404040] tracking-widest hover:text-white transition-colors"
                    >
                      RESILIENCE <SortIndicator col="resilienceScore" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">STATUS</th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('uploadDate')}
                      className="font-mono text-[9px] text-[#404040] tracking-widest hover:text-white transition-colors"
                    >
                      UPLOADED <SortIndicator col="uploadDate" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('rounds')}
                      className="font-mono text-[9px] text-[#404040] tracking-widest hover:text-white transition-colors"
                    >
                      ROUNDS <SortIndicator col="rounds" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center font-mono text-[10px] text-[#333]">
                      NO DOCUMENTS FOUND
                    </td>
                  </tr>
                )}

                {filtered.map((doc) => {
                  const latest = getLatestReport(doc.source);
                  const score = latest?.resilience_score;
                  const hasMultiple = (doc.source.audit_reports?.length || 0) > 1;
                  const scoreColor =
                    score == null ? '#404040' : score < 40 ? '#EF4444' : score < 70 ? '#EAB308' : '#22C55E';

                  return (
                    <tr key={doc.source.id} className="hover:bg-[#0a0a0a] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileTextIcon className="w-3 h-3 text-[#333] flex-shrink-0" />
                          <span className="font-mono text-[10px] text-[#888] max-w-[180px] truncate">{doc.source.file_name}</span>
                        </div>
                        <div className="font-mono text-[9px] text-[#333] ml-5">{doc.source.id}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-sans text-xs text-white">{doc.owner}</div>
                        <div className="font-mono text-[9px] text-[#333]">{doc.ownerEmail}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`flex items-center gap-2 ${hasMultiple ? 'cursor-pointer hover:opacity-80' : ''}`}
                          onClick={() => hasMultiple && setResilienceHistoryDoc(doc.source)}
                        >
                          <div className="w-16 h-1 bg-[#1a1a1a]">
                            {score != null && (
                              <div
                                className="h-full"
                                style={{
                                  width: `${score}%`,
                                  backgroundColor: scoreColor,
                                }}
                              />
                            )}
                          </div>
                          <span className="font-mono text-[10px]" style={{ color: scoreColor }}>
                            {score != null ? `${score}%` : '—'}
                          </span>
                          {hasMultiple && (
                            <span className="font-mono text-[9px] text-[#404040]">
                              ({doc.source.audit_reports!.length} rounds)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-mono text-[9px] font-bold px-1.5 py-0.5 tracking-widest ${
                            doc.status === 'PROCESSED'
                              ? 'text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20'
                              : doc.status === 'PROCESSING'
                              ? 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20'
                              : doc.status === 'ARCHIVED'
                              ? 'text-[#666] bg-[#1a1a1a] border border-[#262626]'
                              : 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-[10px] text-[#666] whitespace-nowrap">{formatDate(doc.source.created_at)}</td>

                      <td className="px-4 py-3 font-mono text-[10px] text-white whitespace-nowrap">{doc.source.rounds_used || 1}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setViewDoc(doc)}
                            className="flex items-center gap-1 px-2 py-1 border border-[#262626] text-[#666] font-mono text-[9px] tracking-widest hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                          >
                            <EyeIcon className="w-3 h-3" />
                            VIEW
                          </button>
                          <button
                            onClick={() => setDeleteTarget(doc)}
                            className="flex items-center gap-1 px-2 py-1 border border-[#EF4444]/30 text-[#EF4444] font-mono text-[9px] tracking-widest hover:border-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                          >
                            <TrashIcon className="w-3 h-3" />
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[9px] text-[#333]">SHOWING {filtered.length} OF {documents.length} DOCUMENTS</span>
            <span className="font-mono text-[9px] text-[#333]">SORTED BY: {sortKey.toUpperCase()} {sortDir.toUpperCase()}</span>
          </div>
        </>
      )}

      {viewDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#050505] border border-[#262626] w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <FileTextIcon className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-white tracking-widest">DOCUMENT RECORD</span>
              </div>
              <button onClick={() => setViewDoc(null)} className="text-[#404040] hover:text-white transition-colors">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-2 divide-y divide-[#1a1a1a]">
              {(
                [
                  ['DOCUMENT ID', String(viewDoc.source.id)],
                  ['FILE NAME', viewDoc.source.file_name],
                  ['OWNER', viewDoc.owner],
                  ['OWNER EMAIL', viewDoc.ownerEmail],
                  ['STATUS', viewDoc.status],
                  ['RESILIENCE SCORE', getLatestReport(viewDoc.source)?.resilience_score != null ? `${getLatestReport(viewDoc.source)?.resilience_score}%` : 'PENDING'],
                  ['BATTLE ROUNDS', String(viewDoc.source.rounds_used || 1)],
                  ['UPLOADED', formatDate(viewDoc.source.created_at)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-[9px] text-[#404040] tracking-widest">{label}</span>
                  <span
                    className={`font-mono text-[10px] font-medium ${
                      label === 'STATUS'
                        ? viewDoc.status === 'PROCESSED'
                          ? 'text-[#22C55E]'
                          : viewDoc.status === 'PROCESSING'
                          ? 'text-[#EAB308]'
                          : 'text-[#EF4444]'
                        : 'text-white'
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-[#262626] flex gap-2">
              <button
                onClick={() => {
                  setDeleteTarget(viewDoc);
                  setViewDoc(null);
                }}
                className="flex-1 py-2.5 border border-[#EF4444]/30 text-[#EF4444] font-mono text-xs font-bold tracking-widest hover:bg-[#EF4444]/10 transition-colors"
              >
                DELETE
              </button>
              <button
                onClick={() => setViewDoc(null)}
                className="flex-1 py-2.5 border border-[#262626] text-[#666] font-mono text-xs font-bold tracking-widest hover:border-[#404040] hover:text-white transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {resilienceHistoryDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#050505] border border-[#262626] w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <ActivityIcon className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-white tracking-widest">RESILIENCE HISTORY</span>
              </div>
              <button
                onClick={() => setResilienceHistoryDoc(null)}
                className="text-[#404040] hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[#1a1a1a]">
              <span className="font-mono text-[10px] text-white font-bold">{resilienceHistoryDoc.file_name}</span>
              <span className="font-mono text-[9px] text-[#404040] ml-2">{resilienceHistoryDoc.audit_reports?.length || 0} ROUNDS</span>
            </div>

            <div className="divide-y divide-[#1a1a1a] max-h-80 overflow-y-auto">
              {resilienceHistoryDoc.audit_reports
                ?.slice()
                .sort((a, b) => b.round_number - a.round_number)
                .map((report) => {
                  const score = report.resilience_score;
                  const color = score == null ? '#404040' : score < 40 ? '#EF4444' : score < 70 ? '#EAB308' : '#22C55E';
                  const label = score == null ? 'N/A' : score < 40 ? 'CRITICAL' : score < 70 ? 'MODERATE' : 'RESILIENT';
                  const vulnCount = parseVulnerabilityCount(report);

                  return (
                    <div key={report.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] text-white font-bold">ROUND {report.round_number}</span>
                        <span className="font-mono text-[9px] text-[#404040] ml-3">{new Date(report.created_at).toLocaleDateString()}</span>
                        <span className="font-mono text-[9px] text-[#404040] ml-3">{vulnCount} threats</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-[#1a1a1a]">
                          {score != null && (
                            <div
                              className="h-full"
                              style={{
                                width: `${score}%`,
                                backgroundColor: color,
                              }}
                            />
                          )}
                        </div>
                        <span className="font-mono text-[10px] font-bold" style={{ color }}>
                          {score != null ? `${score}%` : '—'}
                        </span>
                        <span className="font-mono text-[9px]" style={{ color }}>
                          {label}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="px-5 py-3 border-t border-[#262626]">
              <button
                onClick={() => setResilienceHistoryDoc(null)}
                className="w-full py-2 border border-[#262626] text-[#666] font-mono text-xs font-bold tracking-widest hover:border-[#404040] hover:text-white transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#050505] border border-[#EF4444]/30 w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-[#EF4444] tracking-widest">CONFIRM DELETION</span>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="text-[#404040] hover:text-white transition-colors">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="font-mono text-[10px] text-[#888] leading-relaxed mb-4">
                YOU ARE ABOUT TO PERMANENTLY DELETE THIS DOCUMENT AND ALL ASSOCIATED AUDIT DATA. THIS ACTION CANNOT BE UNDONE.
              </p>
              <div className="bg-[#0a0a0a] border border-[#262626] px-4 py-3">
                <div className="font-mono text-xs text-white font-bold truncate">{deleteTarget.source.file_name}</div>
                <div className="font-mono text-[9px] text-[#404040] mt-0.5">{deleteTarget.source.id} · {deleteTarget.owner}</div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => handleDelete(deleteTarget.source.id)}
                className="flex-1 py-2.5 bg-[#EF4444] text-white font-mono text-xs font-bold tracking-widest hover:bg-[#dc2626] transition-colors"
              >
                DELETE
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-[#262626] text-[#666] font-mono text-xs font-bold tracking-widest hover:border-[#404040] hover:text-white transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
