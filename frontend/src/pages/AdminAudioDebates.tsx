import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AudioLinesIcon,
  RefreshCwIcon,
  SearchIcon,
  ExternalLinkIcon,
  DownloadIcon,
} from 'lucide-react';
import {
  authService,
  type AudioDebate,
  type Document,
  type User,
} from '../services/authService';
import { dataCache } from '../utils/dataCache';
import { useToast } from '../context/useToast';
import { exportToPdf } from '../utils/exportPdf';

const AUDIO_DEBATES_CACHE_KEY = 'admin:audio-debates';

type AudioDebateRow = {
  id: number;
  documentId: number;
  roundNumber: number;
  cloudinaryAudioURL: string;
  createdAt: string;
  documentName: string;
  ownerName: string;
  ownerEmail: string;
};

type AudioDebatesCachePayload = {
  rows: AudioDebateRow[];
};

function toDateLabel(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function mapDebateRows(debates: AudioDebate[], documents: Document[], users: User[]): AudioDebateRow[] {
  return debates
    .map((debate) => {
      const document = documents.find((doc) => doc.id === debate.document_id);
      const owner = users.find((u) => u.id === document?.user_id);

      return {
        id: debate.id,
        documentId: debate.document_id,
        roundNumber: debate.round_number,
        cloudinaryAudioURL: debate.cloudinary_audio_url,
        createdAt: debate.created_at,
        documentName: document?.file_name || 'Unknown Document',
        ownerName: owner?.operator_name || 'Unknown User',
        ownerEmail: owner?.email || 'unknown@example.com',
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function AdminAudioDebates() {
  const { showToast } = useToast();
  const cachedPayload = dataCache.get<AudioDebatesCachePayload>(AUDIO_DEBATES_CACHE_KEY);

  const [rows, setRows] = useState<AudioDebateRow[]>(cachedPayload?.rows ?? []);
  const [loading, setLoading] = useState(!cachedPayload);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (options: { forceRefresh?: boolean; isReload?: boolean } = {}) => {
      const { forceRefresh = false, isReload = false } = options;

      if (!forceRefresh) {
        const cached = dataCache.get<AudioDebatesCachePayload>(AUDIO_DEBATES_CACHE_KEY);
        if (cached) {
          setRows(cached.rows);
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
        const [debates, documents, users] = await Promise.all([
          authService.getAllAudioDebatesAdmin(),
          authService.getAllDocuments(),
          authService.getAllUsers(),
        ]);

        const mappedRows = mapDebateRows(debates, documents, users);
        setRows(mappedRows);
        dataCache.set<AudioDebatesCachePayload>(AUDIO_DEBATES_CACHE_KEY, { rows: mappedRows });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load audio debates';
        setError(message);
        showToast(message, 'error');
      } finally {
        if (isReload) {
          setReloading(false);
        } else {
          setLoading(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleReload = async () => {
    dataCache.invalidate(AUDIO_DEBATES_CACHE_KEY);
    await load({ forceRefresh: true, isReload: true });
  };

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase();

    return rows.filter((row) => {
      return (
        String(row.id).includes(query) ||
        String(row.documentId).includes(query) ||
        String(row.roundNumber).includes(query) ||
        row.documentName.toLowerCase().includes(query) ||
        row.ownerName.toLowerCase().includes(query) ||
        row.ownerEmail.toLowerCase().includes(query) ||
        row.cloudinaryAudioURL.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  const handleExportPdf = () => {
    exportToPdf({
      title: 'AUDIO REGISTRY',
      subtitle: `${rows.length} audio records - exported ${new Date().toISOString()}`,
      columns: ['ID', 'DOCUMENT ID', 'ROUND', 'AUDIO URL', 'CREATED'],
      rows: rows.map((d) => [
        d.id,
        d.documentId,
        d.roundNumber,
        d.cloudinaryAudioURL ? 'Available' : '-',
        new Date(d.createdAt).toLocaleDateString(),
      ]),
      filename: `ares-audio-debates-${Date.now()}`,
    });
  };

  return (
    <div className="p-6 min-h-full">
      <div className="mb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AudioLinesIcon className="w-4 h-4 text-[#EF4444]" />
              <h1 className="font-sans text-xl font-bold text-white tracking-wide">AUDIO REGISTRY</h1>
            </div>
            <p className="font-mono text-[10px] text-[#404040] tracking-widest">
              {rows.length} AUDIO RECORDS
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

      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#404040]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH BY DEBATE ID, DOCUMENT ID, ROUND, DOCUMENT, OWNER, OR URL..."
          className="w-full bg-[#0a0a0a] border border-[#262626] pl-9 pr-4 py-2.5 font-mono text-xs text-white placeholder-[#333] focus:border-[#3B82F6] focus:outline-none transition-colors"
        />
      </div>

      <div className="border border-[#262626] overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border border-[#EF4444] border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#EF4444]">{error}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-mono text-[10px] text-[#333]">NO AUDIO DEBATES FOUND</p>
          </div>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-[#262626] bg-[#0a0a0a]">
                <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">ID</th>
                <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">DOCUMENT</th>
                <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">ROUND</th>
                <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">OWNER</th>
                <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">CREATED</th>
                <th className="px-4 py-3 text-left font-mono text-[9px] text-[#404040] tracking-widest">AUDIO URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-[#0f0f0f] transition-colors">
                  <td className="px-4 py-3 font-mono text-[10px] text-[#999] whitespace-nowrap">#{row.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-[10px] text-white">{row.documentName}</div>
                    <div className="font-mono text-[9px] text-[#404040]">DOC #{row.documentId}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-white whitespace-nowrap">{row.roundNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-[10px] text-white">{row.ownerName}</div>
                    <div className="font-mono text-[9px] text-[#404040]">{row.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-[#666] whitespace-nowrap">{toDateLabel(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    {row.cloudinaryAudioURL ? (
                      <button
                        onClick={() => window.open(row.cloudinaryAudioURL, '_blank')}
                        className="flex items-center gap-1 px-2 py-1 border border-[#262626] text-[#666] font-mono text-[9px] tracking-widest hover:border-[#22C55E] hover:text-[#22C55E] transition-colors"
                      >
                        <ExternalLinkIcon className="w-3 h-3" />
                        OPEN
                      </button>
                    ) : (
                      <span className="font-mono text-[9px] text-[#333]">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
