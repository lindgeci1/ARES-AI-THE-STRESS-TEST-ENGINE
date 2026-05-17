import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  FileTextIcon,
  ClockIcon,
  ActivityIcon,
  UploadIcon,
  RefreshCwIcon,
  ArchiveIcon,
  TrashIcon,
  AlertTriangleIcon,
  XIcon } from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService, type Document } from '../services/authService';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PROCESSING' | 'ARCHIVED'>('ALL');
  const [reloading, setReloading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshDocuments = () => {
    if (!user) return;
    setLoading(true);
    authService.getUserDocuments(user.id)
      .then(setDocuments)
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setReloading(false);
      });
  };

  const handleReload = () => {
    setReloading(true);
    setCurrentTime(new Date());
    refreshDocuments();
  };

  const handleArchive = async (doc: Document) => {
    try {
      const updated = await authService.archiveDocument(doc.id);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err: any) {
      console.error('Archive failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authService.deleteDocument(deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshDocuments();
  }, [user]);

  const filtered = documents.filter((doc) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return doc.status === 'processed';
    if (filter === 'PROCESSING') return doc.status === 'pending';
    if (filter === 'ARCHIVED') return doc.status === 'archived';
    return true;
  });

  const activeCount = documents.filter((d) => d.status === 'processed').length;
  const processingCount = documents.filter((d) => d.status === 'pending').length;
  const archivedCount = documents.filter((d) => d.status === 'archived').length;
  const maxRounds = user?.user_usage?.rounds_per_audit || 3;

  return (
    <div className="p-6 min-h-full">
      <div className="mb-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ActivityIcon className="w-4 h-4 text-[#EF4444]" />
              <h1 className="font-sans text-xl font-bold text-white tracking-wide">
                COMMAND CENTER
              </h1>
            </div>
            <p className="font-mono text-[10px] text-[#404040] tracking-widest">
              {currentTime.toISOString().replace('T', ' ').slice(0, 19)} UTC
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleReload}
              disabled={reloading}
              className="flex h-9 items-center justify-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
            >
              <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
            <Link
              to="/audit/new"
              className="flex h-9 items-center justify-center gap-2 px-3 bg-[#EF4444] text-white font-mono text-[9px] font-bold tracking-widest hover:bg-[#dc2626] transition-colors">

              <UploadIcon className="w-3.5 h-3.5" />
              NEW AUDIT
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:hidden w-full">
          <button
            onClick={handleReload}
            disabled={reloading}
            className="flex h-9 w-full items-center justify-center gap-2 font-mono text-[9px] text-[#666] tracking-widest border border-[#262626] px-3 hover:border-[#404040] hover:text-[#999] transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
          <Link
            to="/audit/new"
            className="flex h-9 w-full items-center justify-center gap-2 px-3 bg-[#EF4444] text-white font-mono text-[9px] font-bold tracking-widest hover:bg-[#dc2626] transition-colors">

            <UploadIcon className="w-3.5 h-3.5" />
            NEW AUDIT
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#262626] mb-6">
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="font-mono text-lg font-bold text-[#3B82F6]">
            {activeCount}
          </div>
          <div className="font-mono text-[9px] text-[#404040] tracking-widest">
            ACTIVE AUDITS
          </div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="font-mono text-lg font-bold text-yellow-400">
            {processingCount}
          </div>
          <div className="font-mono text-[9px] text-[#404040] tracking-widest">
            PROCESSING
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 bg-[#0a0a0a] px-4 py-3">
          <div className="font-mono text-lg font-bold text-[#666]">
            {archivedCount}
          </div>
          <div className="font-mono text-[9px] text-[#404040] tracking-widest">
            ARCHIVED
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:flex md:items-center md:gap-0 mb-6 border-b border-[#262626]">
        {(['ALL', 'ACTIVE', 'PROCESSING', 'ARCHIVED'] as const).map((f) =>
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`w-full md:w-auto px-2 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] tracking-widest transition-colors relative ${filter === f ? 'text-white' : 'text-[#404040] hover:text-[#666]'}`}>

            {f}
            {filter === f &&
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EF4444]" />
          }
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ?
        <div className="col-span-3 flex items-center justify-center py-12">
            <div className="w-6 h-6 border border-[#EF4444] border-t-transparent animate-spin" />
          </div> :
        filtered.length === 0 ?
        <div className="col-span-3 text-center py-12">
            <span className="font-mono text-[10px] text-[#404040]">NO DOCUMENTS FOUND</span>
          </div> :
        filtered.map((doc) =>
        <div
          key={doc.id}
          className={`bg-[#050505] border border-[#262626] p-4 transition-colors ${
          doc.status === 'archived' ?
          'opacity-40 cursor-default' :
          'hover:border-[#404040] cursor-pointer'
          }`}
          onClick={() => {
            if (doc.status !== 'archived') {
              navigate(`/audit/${doc.id}`);
            }
          }}>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileTextIcon className="w-3.5 h-3.5 text-[#404040]" />
                <span className="font-mono text-[10px] text-white font-bold tracking-wider truncate max-w-[200px]">
                  {doc.file_name}
                </span>
              </div>
              {doc.status === 'archived' ?
              <span className="font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 text-[#404040] bg-[#1a1a1a] border border-[#262626]">
                  ARCHIVED
                </span> :
              <span className={`font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 ${
                doc.status === 'processed' ?
                'text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/20' :
                doc.status === 'pending' ?
                'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20' :
                'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20'
                }`}>
                  {doc.status === 'processed' ? 'ACTIVE' : doc.status === 'pending' ? 'PROCESSING' : 'FAILED'}
                </span>
              }
            </div>

            <div className="mb-3">
              {(() => {
              const latestReport =
                doc.audit_reports && doc.audit_reports.length > 0
                  ? [...doc.audit_reports].sort((a, b) => b.round_number - a.round_number)[0]
                  : null;
              const score = latestReport?.resilience_score;
              const scoreColor =
                score == null ? '#404040' : score < 40 ? '#EF4444' : score < 70 ? '#EAB308' : '#22C55E';
              const scoreLabel =
                score == null ? 'N/A' : score < 40 ? 'CRITICAL' : score < 70 ? 'MODERATE' : 'RESILIENT';

              return (
                <>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] text-[#404040] tracking-widest">SURVIVAL SCORE</span>
                <span className="font-mono text-[9px]" style={{ color: scoreColor }}>
                  {score != null ? `${score}% — ${scoreLabel}` : 'N/A'}
                </span>
              </div>
              <div className="w-full h-1 bg-[#1a1a1a]">
                {score != null && (
                  <div className="h-full" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
                )}
              </div>
                </>
              );
            })()}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1a1a1a]">
              <div>
                <div className="font-mono text-[9px] text-[#404040] tracking-widest">ROUNDS</div>
                <div className="font-mono text-xs text-white font-bold">
                  {doc.rounds_used || 1}/{maxRounds}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-[#404040] tracking-widest">THREATS</div>
                <div className="font-mono text-xs text-[#EF4444] font-bold">
                  {(() => {
                  const latestReport =
                    doc.audit_reports && doc.audit_reports.length > 0
                      ? [...doc.audit_reports].sort((a, b) => b.round_number - a.round_number)[0]
                      : null;
                  const threats = Array.isArray(latestReport?.vulnerabilities)
                    ? latestReport.vulnerabilities.length
                    : 0;
                  return threats > 0 ? threats : 'N/A';
                })()}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-[#404040] tracking-widest">AUDIO</div>
                <div className="font-mono text-xs font-bold">
                  {doc.audio_debates && doc.audio_debates.length > 0 ?
                  <span className="text-[#22C55E]">READY</span> :
                  <span className="text-[#404040]">PENDING</span>
                  }
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 mt-2">
              <ClockIcon className="w-2.5 h-2.5 text-[#262626]" />
              <span className="font-mono text-[9px] text-[#262626]">
                {new Date(doc.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-[#1a1a1a]">
              {doc.status === 'archived' ?
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive(doc);
                }}
                className="flex items-center gap-1 px-2 py-1 text-[#EAB308] hover:text-white font-mono text-[9px] tracking-widest transition-colors"
              >
                  <ArchiveIcon className="w-3 h-3" />
                  UNARCHIVE
                </button> :
              <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchive(doc);
                    }}
                    className="p-1 text-[#333] hover:text-[#EAB308] transition-colors"
                    title={doc.status === 'archived' ? 'Unarchive document' : 'Archive document'}
                  >
                    <ArchiveIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(doc);
                    }}
                    className="p-1 text-[#333] hover:text-[#EF4444] transition-colors"
                    title="Delete document"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </>
              }
            </div>
          </div>
        )}

        <Link
          to="/audit/new"
          className="bg-[#050505] border border-dashed border-[#262626] p-4 flex flex-col items-center justify-center gap-3 hover:border-[#404040] transition-colors min-h-[160px]">

          <PlusIcon className="w-6 h-6 text-[#262626]" />
          <span className="font-mono text-[10px] text-[#404040] tracking-widest">
            UPLOAD DOCUMENT
          </span>
        </Link>
      </div>

      {deleteTarget && (
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
                className="text-[#404040] hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="font-mono text-[10px] text-[#888] leading-relaxed mb-2">
                YOU ARE ABOUT TO PERMANENTLY DELETE:
              </p>
              <p className="font-mono text-[10px] text-white font-bold mb-4">
                {deleteTarget.file_name}
              </p>
              <p className="font-mono text-[9px] text-[#404040] leading-relaxed">
                THIS WILL REMOVE THE DOCUMENT AND ALL ASSOCIATED AUDIO DATA. THIS ACTION CANNOT BE UNDONE.
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex-1 py-2.5 font-mono text-xs font-bold tracking-widest transition-colors ${
                deleting ?
                'bg-[#333] text-[#666] cursor-not-allowed' :
                'bg-[#EF4444] text-white hover:bg-[#dc2626]'
                }`}
              >
                {deleting ? 'DELETING...' : 'DELETE'}
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
    </div>);

}