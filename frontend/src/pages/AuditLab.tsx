import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  authService,
  type Document,
  type HeatmapSegment,
  type Vulnerability,
  type LogicalFallacy,
  type FortificationStep,
} from '../services/authService';
import {
  PlayIcon,
  PauseIcon,
  SwordIcon,
  ShieldIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  FileTextIcon,
  XIcon,
  TerminalIcon,
  ZapIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileWarningIcon,
  BrainIcon,
  WrenchIcon } from
'lucide-react';
type BattleEntry = {
  role: 'AUDITOR' | 'OPTIMIST' | 'SYSTEM' | 'USER';
  text: string;
  time: string;
};

type DiagnosticTab = 'vulnerabilities' | 'fallacies' | 'fortification';

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

function WaveformBar({ color, delay, isActive }: {color: string;delay: number;isActive: boolean;}) {
  return (
    <div
      className="w-1 flex-shrink-0"
      style={{
        backgroundColor: color,
        height: `${8 + Math.random() * 32}px`,
        animation:
        isActive ?
        `${color === '#EF4444' ? 'wave-red' : color === '#3B82F6' ? 'wave-blue' : 'wave-gray'} ${0.5 + Math.random() * 0.8}s ease-in-out infinite` :
        'none',
        animationDelay: `${delay}ms`,
        opacity: isActive ? 0.7 + Math.random() * 0.3 : 0.15
      }} />);


}

function parseTranscript(transcript: unknown): BattleEntry[] {
  if (!transcript) {
    return [];
  }

  if (Array.isArray(transcript)) {
    return transcript as BattleEntry[];
  }

  if (typeof transcript === 'string') {
    try {
      const parsed = JSON.parse(transcript);
      return Array.isArray(parsed) ? (parsed as BattleEntry[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function timeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function AuditLab() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();

  const location = useLocation();
  const isNewAudit = Boolean(location.state?.isNewAudit);

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const quotaRefreshDoneRef = useRef(false);

  // ── SCANNING STATE ──
  const [isScanning, setIsScanning] = useState(isNewAudit);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('INITIALIZING ARES PROTOCOL...');

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let finalizeTimer: ReturnType<typeof setTimeout> | null = null;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchDocument = async () => {
      try {
        const doc = await authService.getDocumentById(Number(id));
        if (cancelled) return;

        setDocument(doc);
        setError(null);

        if (doc.status === 'failed') {
          setScanProgress(100);
          setScanMessage('AUDIT FAILED — CHECK SYSTEM LOGS');
          setIsScanning(false);
          setLoading(false);
          setError('Document processing failed. Please retry this audit.');
          return;
        }

        if (doc.status === 'processed') {
          if (!quotaRefreshDoneRef.current) {
            quotaRefreshDoneRef.current = true;
            refreshUser().catch((refreshErr) => {
              console.error('Failed to refresh quota after processing:', refreshErr);
            });
          }

          setScanProgress(90);
          setScanMessage('FINALIZING AUDIO SYNTHESIS...');

          finalizeTimer = setTimeout(() => {
            if (cancelled) return;
            setScanProgress(100);
            setScanMessage('AUDIT COMPLETE');

            revealTimer = setTimeout(() => {
              if (cancelled) return;
              setIsScanning(false);
              setLoading(false);
            }, 800);
          }, 600);

          return;
        }

        if (doc.raw_text && doc.raw_text.length > 0) {
          setScanProgress(60);
          setScanMessage('GENERATING RED/BLUE TEAM AUDIO DEBATE...');
        } else {
          setScanProgress((prev) => Math.min(prev + 2, 30));
          setScanMessage('EXTRACTING DOCUMENT RAW TEXT...');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to fetch audit document';
        setError(message);
        setLoading(false);
        setIsScanning(false);
      }
    };

    if (isScanning || loading) {
      fetchDocument();
      const interval = setInterval(fetchDocument, 3000);
      return () => {
        cancelled = true;
        if (finalizeTimer) clearTimeout(finalizeTimer);
        if (revealTimer) clearTimeout(revealTimer);
        clearInterval(interval);
      };
    }

    fetchDocument();

    return () => {
      cancelled = true;
      if (finalizeTimer) clearTimeout(finalizeTimer);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [id, isScanning, loading, refreshUser]);

  // ── AUDIT LAB STATE ──
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00:00');
  const [audioDuration, setAudioDuration] = useState('00:00:00');
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [activeEntryIndex, setActiveEntryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<DiagnosticTab>('vulnerabilities');
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [showReAudit, setShowReAudit] = useState(false);
  const [reAuditFile, setReAuditFile] = useState<File | null>(null);
  const [reAuditing, setReAuditing] = useState(false);
  const reAuditFileRef = useRef<HTMLInputElement>(null);
  const [activeHeat, setActiveHeat] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(
    new Set(['VLN-001'])
  );
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const auditReports = document?.audit_reports || [];
  const audioDebates = document?.audio_debates || [];
  const totalRounds = document?.rounds_used || 1;
  const displayRound = selectedRound || totalRounds;
  const availableRounds = Array.from(
    new Set([
      ...auditReports.map((report) => report.round_number),
      ...audioDebates.map((debate) => debate.round_number),
      totalRounds,
    ])
  ).sort((a, b) => a - b);
  const currentAuditReport = auditReports.find((report) => report.round_number === displayRound) || null;
  const currentAudioDebate = audioDebates.find((debate) => debate.round_number === displayRound) || null;
  const transcript = parseTranscript(currentAudioDebate?.transcript_json);
  const maxRounds = user?.user_usage?.rounds_per_audit || 3;
  const canReAudit = totalRounds < maxRounds && document?.status === 'processed';
  const heatmapSegments: HeatmapSegment[] = (() => {
    const data = currentAuditReport?.heatmap_data;
    if (!data) return [];
    if (Array.isArray(data)) return data as HeatmapSegment[];
    if (Array.isArray((data as { segments?: unknown[] }).segments)) {
      return (data as { segments: HeatmapSegment[] }).segments;
    }
    return [];
  })();
  const vulnerabilities: Vulnerability[] = asArray<Vulnerability>(currentAuditReport?.vulnerabilities);
  const fallacies: LogicalFallacy[] = asArray<LogicalFallacy>(currentAuditReport?.logical_fallacies);
  const fortification: FortificationStep[] = (() => {
    const data = currentAuditReport?.fortification_plan;
    if (!data) return [];
    if (Array.isArray(data)) return data as FortificationStep[];
    if (Array.isArray((data as { steps?: unknown[] }).steps)) {
      return (data as { steps: FortificationStep[] }).steps;
    }
    return [];
  })();
  const battleLogRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration || 1;
    setAudioProgress((current / total) * 100);
    setCurrentTime(formatTime(current));

    if (transcript.length > 0) {
      let currentIndex = -1;
      let currentSpeaker: string | null = null;
      for (let i = 0; i < transcript.length; i++) {
        const entrySeconds = timeToSeconds(transcript[i].time);
        if (current >= entrySeconds) {
          currentIndex = i;
          currentSpeaker = transcript[i].role;
        } else {
          break;
        }
      }

      setActiveEntryIndex(currentIndex);
      setActiveSpeaker(currentSpeaker);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(formatTime(audioRef.current.duration));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * audioRef.current.duration;
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
    setCurrentTime('00:00:00');
    setActiveSpeaker(null);
    setActiveEntryIndex(transcript.length - 1);
  };

  const handleReAudit = async () => {
    if (!reAuditFile || !document) return;

    setReAuditing(true);
    try {
      await authService.reAuditDocument(document.id, reAuditFile);
      setShowReAudit(false);
      setReAuditFile(null);
      setSelectedRound(0);
      setIsScanning(true);
      setLoading(true);
      setScanProgress(0);
      setScanMessage('INITIALIZING ARES PROTOCOL...');
    } catch (err) {
      console.error('Re-audit failed:', err);
    } finally {
      setReAuditing(false);
    }
  };

  useEffect(() => {
    if (!isPlaying || activeEntryIndex < 0 || !battleLogRef.current) return;

    const entryEl = battleLogRef.current.querySelector(`[data-entry-index="${activeEntryIndex}"]`);
    if (entryEl) {
      entryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeEntryIndex, isPlaying]);

  useEffect(() => {
    if (battleLogRef.current) {
      battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
    }
  }, [isScanning, transcript]);

  useEffect(() => {
    setIsPlaying(false);
    setAudioProgress(0);
    setCurrentTime('00:00:00');
    setActiveSpeaker(null);
    setActiveEntryIndex(-1);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [selectedRound]);
  const toggleAccordion = (accordionId: string) => {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(accordionId)) next.delete(accordionId);else
      next.add(accordionId);
      return next;
    });
  };
  const survivalScore = currentAuditReport?.resilience_score ?? null;
  const scoreColor =
    survivalScore === null ? '#404040' : survivalScore < 40 ? '#EF4444' : survivalScore < 70 ? '#EAB308' : '#22C55E';
  const scoreLabel =
    survivalScore === null ? 'N/A' : survivalScore < 40 ? 'CRITICAL' : survivalScore < 70 ? 'MODERATE' : 'RESILIENT';
  const TABS: {
    id: DiagnosticTab;
    label: string;
    icon: typeof FileWarningIcon;
    count: number;
  }[] = [
  {
    id: 'vulnerabilities',
    label: 'VULNERABILITIES',
    icon: FileWarningIcon,
    count: vulnerabilities.length
  },
  {
    id: 'fallacies',
    label: 'LOGICAL FALLACIES',
    icon: BrainIcon,
    count: fallacies.length
  },
  {
    id: 'fortification',
    label: 'FORTIFICATION PLAN',
    icon: WrenchIcon,
    count: fortification.length
  }];

  if (!id) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <span className="font-mono text-[10px] text-[#404040] tracking-widest">
            NO DOCUMENT SELECTED — GO TO DASHBOARD
          </span>
          <Link
            to="/dashboard"
            className="block mt-4 font-mono text-[10px] text-[#EF4444] hover:text-white transition-colors tracking-widest"
          >
            → OPEN DASHBOARD
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !document) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <span className="font-mono text-[10px] text-[#555] tracking-widest">LOADING AUDIT...</span>
      </div>
    );
  }

  // ── SCANNING SCREEN ──
  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#050505] px-8">
        {/* Header */}
        <div className="w-full max-w-xl mb-10">
          <div className="flex items-center gap-3 mb-1">
            <ZapIcon className="w-4 h-4 text-[#EF4444]" />
            <span className="font-mono text-xs font-bold text-white tracking-widest">
              ARES AI — AUDIT INITIALIZATION
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[#404040] tracking-widest">
              TARGET:
            </span>
            <span className="font-mono text-[9px] text-[#555]">{id}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xl mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] text-[#404040] tracking-widest">
              SCAN PROGRESS
            </span>
            <span className="font-mono text-[9px] text-[#EF4444] font-bold tabular-nums">
              {Math.round(scanProgress)}%
            </span>
          </div>
          {/* 1px sharp bar — no border radius */}
          <div
            className="w-full bg-[#1a1a1a]"
            style={{
              height: '1px'
            }}>

            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${scanProgress}%`,
                backgroundColor: scanProgress >= 100 && !scanMessage.includes('FAILED') ? '#22C55E' : '#EF4444'
              }} />

          </div>
        </div>

        {/* Terminal output */}
        <div className="w-full max-w-xl">
          <div className="border border-[#262626] bg-[#080808]">
            <div className="px-5 py-2 border-b border-[#1a1a1a]">
              <span className="font-mono text-[9px] text-[#333] tracking-widest">
                {'// SYSTEM OUTPUT'}
              </span>
            </div>
            <div className="px-5 py-4 space-y-2">
              {scanProgress > 0 &&
              <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] text-[#22C55E]">{'>'}</span>
                  <span className="font-mono text-[10px] text-[#404040]">
                    INITIALIZING ARES PROTOCOL...
                  </span>
                  <span className="font-mono text-[9px] text-[#22C55E] ml-auto">OK</span>
                </div>
              }

              {scanProgress >= 30 &&
              <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] text-[#22C55E]">{'>'}</span>
                  <span className="font-mono text-[10px] text-[#404040]">
                    EXTRACTING DOCUMENT RAW TEXT...
                  </span>
                  <span className="font-mono text-[9px] text-[#22C55E] ml-auto">OK</span>
                </div>
              }

              {scanProgress >= 60 &&
              <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] text-[#22C55E]">{'>'}</span>
                  <span className="font-mono text-[10px] text-[#404040]">
                    GENERATING RED/BLUE TEAM AUDIO DEBATE...
                  </span>
                  {scanProgress >= 90 ?
                <span className="font-mono text-[9px] text-[#22C55E] ml-auto">OK</span> :
                <span className="font-mono text-[9px] text-[#EF4444] ml-auto animate-pulse">PROCESSING</span>
                }
                </div>
              }

              {scanProgress >= 90 &&
              <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] text-[#22C55E]">{'>'}</span>
                  <span className="font-mono text-[10px] text-[#404040]">
                    FINALIZING AUDIO SYNTHESIS...
                  </span>
                  {scanProgress >= 100 ?
                <span className="font-mono text-[9px] text-[#22C55E] ml-auto">OK</span> :
                <span className="font-mono text-[9px] text-[#EF4444] ml-auto animate-pulse">PROCESSING</span>
                }
                </div>
              }

              {scanProgress >= 100 && scanMessage === 'AUDIT COMPLETE' &&
              <div className="flex items-center gap-3 mt-2">
                  <span className="font-mono text-[9px] text-[#22C55E]">{'>'}</span>
                  <span className="font-mono text-[10px] text-[#22C55E] font-bold">
                    AUDIT COMPLETE — LOADING RESULTS...
                  </span>
                </div>
              }

              {scanMessage.includes('FAILED') &&
              <div className="flex items-center gap-3 mt-2">
                  <span className="font-mono text-[9px] text-[#EF4444]">{'>'}</span>
                  <span className="font-mono text-[10px] text-[#EF4444] font-bold">
                    {scanMessage}
                  </span>
                </div>
              }
            </div>
          </div>
        </div>

        {/* Footer status */}
        <div className="w-full max-w-xl mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#EF4444] animate-pulse" />
            <span className="font-mono text-[9px] text-[#404040] tracking-widest">
              ARES PROTOCOL ACTIVE
            </span>
          </div>
          <span className="font-mono text-[10px] font-bold text-[#EF4444] tracking-widest bg-[#EF4444]/10 border border-[#EF4444]/30 px-2 py-1">
            DO NOT CLOSE THIS WINDOW
          </span>
        </div>
      </div>);

  }

  if (document?.status === 'failed') {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505] px-6">
        <div className="w-full max-w-xl border border-[#EF4444]/30 bg-[#080808] p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangleIcon className="w-4 h-4 text-[#EF4444]" />
            <span className="font-mono text-xs text-[#EF4444] tracking-widest">AUDIT PROCESSING FAILED</span>
          </div>
          <p className="font-mono text-[10px] text-[#777] leading-relaxed">
            {error || 'The document pipeline failed. Please upload the document again.'}
          </p>
        </div>
      </div>
    );
  }

  // ── MAIN AUDIT LAB UI ──
  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#262626] flex-shrink-0">
        <div className="flex items-center gap-3">
          <ZapIcon className="w-3.5 h-3.5 text-[#EF4444]" />
          <span className="font-mono text-xs text-white tracking-wider font-bold">
            AUDIT LAB
          </span>
          <span className="font-mono text-[10px] text-[#404040]">—</span>
          <span className="font-mono text-[10px] text-[#666]">{id}</span>
          <span className="font-mono text-[9px] text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/20 px-1.5 py-0.5">
            {(document?.status || 'pending').toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[#404040] tracking-widest">ROUND</span>
            <select
              value={displayRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="bg-[#0a0a0a] border border-[#262626] text-[#999] font-mono text-[10px] px-2 py-1 outline-none focus:border-[#404040]"
            >
              {availableRounds.map((round) => (
                <option key={round} value={round}>
                  {round}
                </option>
              ))}
            </select>
            <span className="font-mono text-[9px] text-[#404040]">/ {maxRounds}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[#666] tracking-widest">
              SURVIVAL
            </span>
            <span
              className="font-mono text-sm font-bold"
              style={{
                color: scoreColor
              }}>

              {survivalScore !== null ? `${survivalScore}%` : 'N/A'}
            </span>
          </div>
          <div className="w-24 h-1 bg-[#1a1a1a]">
            {survivalScore !== null && (
              <div
                className="h-full"
                style={{
                  width: `${survivalScore}%`,
                  backgroundColor: scoreColor
                }} />
            )}

          </div>
          <span className="font-mono text-[9px] text-[#404040]">ROUND {displayRound}/{maxRounds}</span>
          <button
            onClick={() => setShowReAudit(true)}
            disabled={!canReAudit}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#3B82F6] text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-colors font-mono text-[10px] font-bold tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCwIcon className="w-3 h-3" />
            RE-AUDIT
          </button>
          <button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-bold tracking-widest border transition-colors ${showDiagnostic ? 'bg-[#EF4444] border-[#EF4444] text-white' : 'border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10'}`}>

            DIAGNOSTIC REPORT
          </button>
        </div>
      </div>

      {/* Diagnostic Report Panel */}
      {showDiagnostic &&
      <div className="border-b border-[#262626] bg-[#080808] flex-shrink-0">
          <div className="px-6 py-4 border-b border-[#262626] flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-2 h-2 bg-[#EF4444]" />
                <span className="font-mono text-[9px] text-[#EF4444] tracking-widest font-bold">
                  CLASSIFICATION: RESTRICTED — OPERATOR EYES ONLY
                </span>
              </div>
              <h2 className="font-sans text-base font-bold text-white tracking-wide">
                DETAILED DIAGNOSTIC REPORT
              </h2>
              <p className="font-mono text-[9px] text-[#404040] mt-1 tracking-wider">
                DOC: {document?.file_name} · AUDIT ID: {id} · ROUND: {displayRound}/{maxRounds} · GENERATED: {currentAuditReport?.created_at ? `${new Date(currentAuditReport.created_at).toISOString().replace('T', ' ').slice(0, 19)} UTC` : 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">
                OVERALL RESILIENCE
              </div>
              <div
              className="font-mono text-3xl font-bold"
              style={{
                color: scoreColor
              }}>

                {survivalScore !== null ? `${survivalScore}%` : 'N/A'}
              </div>
              <div className="font-mono text-[9px] text-[#EAB308] tracking-widest">
                {scoreLabel === 'N/A' ? 'N/A' : `${scoreLabel} RISK`}
              </div>
            </div>
          </div>

          <div className="flex border-b border-[#262626]">
            {TABS.map(({ id: tabId, label, icon: Icon, count }) =>
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-5 py-3 font-mono text-[10px] tracking-widest transition-colors relative flex-shrink-0 ${activeTab === tabId ? 'text-white' : 'text-[#404040] hover:text-[#666]'}`}>

                <Icon className="w-3 h-3" />
                {label}
                <span
              className={`font-mono text-[9px] px-1.5 py-0.5 font-bold ${activeTab === tabId ? tabId === 'vulnerabilities' ? 'text-[#EF4444] bg-[#EF4444]/10' : tabId === 'fallacies' ? 'text-[#EAB308] bg-[#EAB308]/10' : 'text-[#22C55E] bg-[#22C55E]/10' : 'text-[#333] bg-[#1a1a1a]'}`}>

                  {count}
                </span>
                {activeTab === tabId &&
            <div
              className={`absolute bottom-0 left-0 right-0 h-0.5 ${tabId === 'vulnerabilities' ? 'bg-[#EF4444]' : tabId === 'fallacies' ? 'bg-[#EAB308]' : 'bg-[#22C55E]'}`} />

            }
              </button>
          )}
          </div>

          <div className="max-h-[420px] overflow-y-auto battle-log">
            {activeTab === 'vulnerabilities' &&
          <div className="divide-y divide-[#1a1a1a]">
                {vulnerabilities.map((v) =>
            <div key={v.id} className="bg-[#050505]">
                    <button
                onClick={() => toggleAccordion(v.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[#0a0a0a] transition-colors">

                      <span
                  className={`font-mono text-[9px] font-bold px-2 py-0.5 tracking-widest flex-shrink-0 ${v.severity === 'CRITICAL' ? 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20' : v.severity === 'HIGH' ? 'text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/20' : 'text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/20'}`}>

                        {v.severity}
                      </span>
                      <span className="font-mono text-[9px] text-[#333] flex-shrink-0">
                        {v.id}
                      </span>
                      <span className="font-mono text-[10px] text-[#666] flex-shrink-0">
                        {v.section}
                      </span>
                      <span className="font-sans text-xs text-white font-medium flex-1">
                        {v.title}
                      </span>
                      {openAccordions.has(v.id) ?
                <ChevronDownIcon className="w-3.5 h-3.5 text-[#404040] flex-shrink-0" /> :

                <ChevronRightIcon className="w-3.5 h-3.5 text-[#404040] flex-shrink-0" />
                }
                    </button>
                    {openAccordions.has(v.id) &&
              <div className="px-6 pb-5 bg-[#080808] border-t border-[#1a1a1a]">
                        <div className="pt-4 space-y-3">
                          <div>
                            <div className="font-mono text-[9px] text-[#EF4444] tracking-widest mb-2">
                              {'// ANALYSIS'}
                            </div>
                            <p className="font-mono text-[10px] text-[#888] leading-relaxed">
                              {v.detail}
                            </p>
                          </div>
                          <div className="border-l-2 border-[#262626] pl-4">
                            <div className="font-mono text-[9px] text-[#404040] tracking-widest mb-1">
                              LEGAL PRECEDENT
                            </div>
                            <p className="font-mono text-[10px] text-[#555] italic">
                              {v.precedent}
                            </p>
                          </div>
                        </div>
                      </div>
              }
                  </div>
            )}
              </div>
          }

            {activeTab === 'fallacies' &&
          <div className="divide-y divide-[#1a1a1a]">
                {fallacies.map((f) =>
            <div key={f.id} className="bg-[#050505]">
                    <button
                onClick={() => toggleAccordion(f.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[#0a0a0a] transition-colors">

                      <span className="font-mono text-[9px] font-bold px-2 py-0.5 tracking-widest flex-shrink-0 text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/20">
                        {f.type}
                      </span>
                      <span className="font-mono text-[9px] text-[#333] flex-shrink-0">
                        {f.id}
                      </span>
                      <span className="font-mono text-[10px] text-[#666] flex-shrink-0">
                        {f.sections}
                      </span>
                      <span className="font-sans text-xs text-white font-medium flex-1">
                        {f.title}
                      </span>
                      {openAccordions.has(f.id) ?
                <ChevronDownIcon className="w-3.5 h-3.5 text-[#404040] flex-shrink-0" /> :

                <ChevronRightIcon className="w-3.5 h-3.5 text-[#404040] flex-shrink-0" />
                }
                    </button>
                    {openAccordions.has(f.id) &&
              <div className="px-6 pb-5 bg-[#080808] border-t border-[#1a1a1a]">
                        <div className="pt-4">
                          <div className="font-mono text-[9px] text-[#EAB308] tracking-widest mb-2">
                            {'// CONTRADICTION ANALYSIS'}
                          </div>
                          <p className="font-mono text-[10px] text-[#888] leading-relaxed">
                            {f.detail}
                          </p>
                        </div>
                      </div>
              }
                  </div>
            )}
              </div>
          }

            {activeTab === 'fortification' &&
          <div className="divide-y divide-[#1a1a1a]">
                <div className="px-6 py-3 bg-[#080808] flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[9px] text-[#22C55E] tracking-widest">
                    {'// MASTER REMEDIATION CHECKLIST'}
                  </span>
                  <span className="font-mono text-[9px] text-[#333]">—</span>
                  <span className="font-mono text-[9px] text-[#333] tracking-wider">
                    ADDRESSES ALL {vulnerabilities.length} VULNERABILITIES + ALL{' '}
                    {fallacies.length} LOGICAL FALLACIES
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="font-mono text-[9px] text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 px-1.5 py-0.5">
                      {
                  fortification.filter((f) => f.priority === 'CRITICAL').
                  length
                  }{' '}
                      CRITICAL
                    </span>
                    <span className="font-mono text-[9px] text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/20 px-1.5 py-0.5">
                      {
                  fortification.filter((f) => f.priority === 'HIGH').
                  length
                  }{' '}
                      HIGH
                    </span>
                    <span className="font-mono text-[9px] text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/20 px-1.5 py-0.5">
                      {
                  fortification.filter((f) => f.priority === 'MEDIUM').
                  length
                  }{' '}
                      MEDIUM
                    </span>
                  </div>
                </div>
                {fortification.map((f) =>
            <div key={f.step} className="bg-[#050505]">
                    <button
                onClick={() => toggleAccordion(`fort-${f.step}`)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[#0a0a0a] transition-colors">

                      <span className="font-mono text-lg font-bold text-[#262626] flex-shrink-0 w-8">
                        {f.step}
                      </span>
                      <span
                  className={`font-mono text-[9px] font-bold px-2 py-0.5 tracking-widest flex-shrink-0 ${f.priority === 'CRITICAL' ? 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20' : f.priority === 'HIGH' ? 'text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/20' : 'text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/20'}`}>

                        {f.priority}
                      </span>
                      <span className="font-sans text-xs text-white font-medium flex-1">
                        {f.title}
                      </span>
                      <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
                        {f.fixes.map((fix) =>
                  <span
                    key={fix}
                    className={`font-mono text-[8px] font-bold px-1.5 py-0.5 tracking-widest ${fix.startsWith('VLN') ? 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20' : 'text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/20'}`}>

                            {fix}
                          </span>
                  )}
                      </div>
                      {openAccordions.has(`fort-${f.step}`) ?
                <ChevronDownIcon className="w-3.5 h-3.5 text-[#404040] flex-shrink-0" /> :

                <ChevronRightIcon className="w-3.5 h-3.5 text-[#404040] flex-shrink-0" />
                }
                    </button>
                    {openAccordions.has(`fort-${f.step}`) &&
              <div className="px-6 pb-5 bg-[#080808] border-t border-[#1a1a1a]">
                        <div className="pt-4 space-y-4">
                          <div>
                            <div className="font-mono text-[9px] text-[#404040] tracking-widest mb-2">
                              RESOLVES
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {f.fixes.map((fix) => {
                        const isVuln = fix.startsWith('VLN');
                        const label = isVuln ?
                            vulnerabilities.find((v) => v.id === fix)?.
                        title :
                            fallacies.find((fa) => fa.id === fix)?.title;
                        return (
                          <div
                            key={fix}
                            className={`flex items-center gap-2 px-3 py-1.5 border ${isVuln ? 'border-[#EF4444]/20 bg-[#EF4444]/5' : 'border-[#EAB308]/20 bg-[#EAB308]/5'}`}>

                                    <span
                              className={`font-mono text-[8px] font-bold tracking-widest ${isVuln ? 'text-[#EF4444]' : 'text-[#EAB308]'}`}>

                                      {fix}
                                    </span>
                                    <span className="font-mono text-[9px] text-[#555]">
                                      {label ?? fix}
                                    </span>
                                  </div>);

                      })}
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-[9px] text-[#22C55E] tracking-widest mb-2">
                              {'// REWRITE INSTRUCTIONS'}
                            </div>
                            <p className="font-mono text-[10px] text-[#888] leading-relaxed">
                              {f.action}
                            </p>
                          </div>
                          <div className="flex items-center gap-6 pt-2 border-t border-[#1a1a1a]">
                            <div>
                              <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                                EFFORT:{' '}
                              </span>
                              <span className="font-mono text-[9px] text-white font-bold">
                                {f.effort}
                              </span>
                            </div>
                            <div>
                              <span className="font-mono text-[9px] text-[#404040] tracking-widest">
                                IMPACT:{' '}
                              </span>
                              <span className="font-mono text-[9px] text-[#22C55E] font-bold">
                                {f.impact}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
              }
                  </div>
            )}
              </div>
          }
          </div>
        </div>
      }

      {/* Main content */}
      {error && (
        <div className="mx-4 mt-3 border border-[#EF4444]/20 bg-[#EF4444]/5 px-3 py-2">
          <span className="font-mono text-[10px] text-[#EF4444] tracking-widest">{error}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANE: Document Heatmap */}
        <div className="w-1/2 flex flex-col border-r border-[#262626]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#262626] flex-shrink-0">
            <span className="font-mono text-[10px] text-[#666] tracking-widest">
              DOCUMENT HEATMAP
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 battle-log">
            <div className="font-mono text-xs leading-relaxed text-[#888]">
              {heatmapSegments.length > 0 ?
              heatmapSegments.map((seg, i) => {
                if (seg.heat === 'neutral') {
                  return (
                    <span key={i} className="text-[#555] font-bold">
                      {seg.text}
                    </span>
                  );
                }

                return (
                  <span
                    key={i}
                    className={`cursor-pointer transition-all ${
                      seg.heat === 'red'
                        ? 'heatmap-red text-red-200'
                        : seg.heat === 'yellow'
                        ? 'heatmap-yellow text-yellow-200'
                        : 'heatmap-green text-green-200'
                    }`}
                    onClick={() => setActiveHeat(activeHeat === String(i) ? null : String(i))}
                  >
                    {seg.text}
                    {activeHeat === String(i) && seg.note && (
                      <span className="block mt-1 mb-1 px-2 py-1 bg-[#0f0f0f] border border-[#262626] text-[9px] font-mono text-[#888]">
                        ⚑ {seg.note}
                      </span>
                    )}
                  </span>
                );
              }) :
              document?.raw_text || 'Extracting document text...'
              }
            </div>
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="w-1/2 flex flex-col">
          {/* Hidden real audio element */}
          {currentAudioDebate?.cloudinary_audio_url &&
          <audio
            ref={audioRef}
            src={currentAudioDebate.cloudinary_audio_url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleAudioEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              setIsPlaying(false);
              setActiveSpeaker(null);
            }} />
          }

          {/* Audio Analysis */}
          <div className="border-b border-[#262626] p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] text-[#666] tracking-widest">
                AUDIO ANALYSIS
              </span>
              <button
                onClick={togglePlay}
                disabled={!currentAudioDebate?.cloudinary_audio_url}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#262626] text-[#666] hover:text-white hover:border-[#404040] transition-colors font-mono text-[10px] disabled:opacity-30 disabled:cursor-not-allowed">

                {isPlaying ? <PauseIcon className="w-3 h-3" /> : <PlayIcon className="w-3 h-3" />}
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
            </div>

            {currentAudioDebate?.cloudinary_audio_url ?
            <>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`transition-opacity duration-300 ${isPlaying && activeSpeaker !== 'SYSTEM' ? 'opacity-20' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TerminalIcon className="w-3 h-3 text-[#666]" />
                      <span className={`font-mono text-[9px] tracking-widest transition-colors ${activeSpeaker === 'SYSTEM' ? 'text-white' : 'text-[#333]'}`}>
                        SYSTEM
                      </span>
                    </div>
                    <div className="flex items-end gap-0.5 h-12 bg-[#0a0a0a] border border-[#262626] px-2 py-1">
                      {Array.from({ length: 25 }).map((_, i) =>
                    <WaveformBar key={i} color="#666" delay={i * 35} isActive={isPlaying && activeSpeaker === 'SYSTEM'} />
                    )}
                    </div>
                  </div>

                  <div className={`transition-opacity duration-300 ${isPlaying && activeSpeaker !== 'AUDITOR' ? 'opacity-20' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <SwordIcon className="w-3 h-3 text-[#EF4444]" />
                      <span className={`font-mono text-[9px] tracking-widest transition-colors ${activeSpeaker === 'AUDITOR' ? 'text-[#EF4444]' : 'text-[#333]'}`}>
                        AUDITOR
                      </span>
                    </div>
                    <div className="flex items-end gap-0.5 h-12 bg-[#0a0a0a] border border-[#262626] px-2 py-1">
                      {Array.from({ length: 25 }).map((_, i) =>
                    <WaveformBar key={i} color="#EF4444" delay={i * 30} isActive={isPlaying && activeSpeaker === 'AUDITOR'} />
                    )}
                    </div>
                  </div>

                  <div className={`transition-opacity duration-300 ${isPlaying && activeSpeaker !== 'OPTIMIST' ? 'opacity-20' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldIcon className="w-3 h-3 text-[#3B82F6]" />
                      <span className={`font-mono text-[9px] tracking-widest transition-colors ${activeSpeaker === 'OPTIMIST' ? 'text-[#3B82F6]' : 'text-[#333]'}`}>
                        OPTIMIST
                      </span>
                    </div>
                    <div className="flex items-end gap-0.5 h-12 bg-[#0a0a0a] border border-[#262626] px-2 py-1">
                      {Array.from({ length: 25 }).map((_, i) =>
                    <WaveformBar key={i} color="#3B82F6" delay={i * 25} isActive={isPlaying && activeSpeaker === 'OPTIMIST'} />
                    )}
                    </div>
                  </div>
                </div>

                <div
                className="mt-3 w-full h-1 bg-[#1a1a1a] relative cursor-pointer"
                onClick={handleSeek}>

                  <div className="h-full bg-[#404040]" style={{ width: `${audioProgress}%` }} />
                  <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white border border-[#262626]"
                  style={{ left: `${audioProgress}%` }} />

                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-mono text-[9px] text-[#404040]">{currentTime}</span>
                  <span className="font-mono text-[9px] text-[#404040]">{audioDuration}</span>
                </div>
              </>
            :
            <div className="text-center py-4">
                <span className="font-mono text-[10px] text-[#404040]">
                  GENERATING AUDIO DEBATE...
                </span>
                <div className="scanning-bar mt-2" />
              </div>
            }
          </div>

          {/* Battle Log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#262626] flex-shrink-0">
              <TerminalIcon className="w-3 h-3 text-[#404040]" />
              <span className="font-mono text-[10px] text-[#666] tracking-widest">
                BATTLE LOG — LIVE TRANSCRIPT
              </span>
              <div className="ml-auto w-1.5 h-1.5 bg-[#EF4444] animate-pulse" />
            </div>
            <div
              ref={battleLogRef}
              className="flex-1 overflow-y-auto p-4 space-y-1 battle-log"
              style={{ overflowY: isPlaying ? 'hidden' : 'auto' }}>

              {activeEntryIndex < 0 && !isPlaying &&
              <div className="flex items-center justify-center h-full">
                  <span className="font-mono text-[10px] text-[#333] tracking-widest animate-pulse">
                    PRESS PLAY TO BEGIN LIVE TRANSCRIPT
                  </span>
                </div>
              }

              {transcript.map((entry, i) => {
                if (i > activeEntryIndex) return null;
                const isCurrent = i === activeEntryIndex && isPlaying;
                const isPast = i < activeEntryIndex;

                return (
              <div
                key={i}
                data-entry-index={i}
                className={`flex gap-3 px-2 py-2 transition-all duration-500 ${
                isCurrent ?
                'bg-[#111] border-l-2 border-l-current' :
                isPast && isPlaying ?
                'opacity-40' :
                ''
                }`}
                style={{
                  borderLeftColor: isCurrent ?
                  entry.role === 'AUDITOR' ? '#EF4444' :
                  entry.role === 'OPTIMIST' ? '#3B82F6' :
                  '#666' :
                  'transparent'
                }}>
                  <span className="font-mono text-[9px] text-[#333] mt-0.5 flex-shrink-0 w-14">
                    {entry.time}
                  </span>
                  <div className="flex-1">
                    <span
                    className={`font-mono text-[9px] font-bold tracking-widest ${entry.role === 'AUDITOR' ? 'text-[#EF4444]' : entry.role === 'OPTIMIST' ? 'text-[#3B82F6]' : 'text-[#555]'}`}>

                      [{entry.role}]
                    </span>
                    <p className={`font-mono text-[10px] mt-0.5 leading-relaxed transition-colors duration-500 ${isCurrent ? 'text-[#e5e5e5]' : 'text-[#555]'}`}>
                      {entry.text}
                    </p>
                  </div>
                </div>
              );
              })}

              {transcript.length === 0 &&
              <span className="font-mono text-[10px] text-[#555] tracking-widest">
                  WAITING FOR DEBATE TRANSCRIPT...
                </span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* REBUTTAL CONSOLE — DISABLED FOR NOW */}
      {showReAudit && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-[#050505] border border-[#3B82F6]/30 w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <RefreshCwIcon className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="font-mono text-xs font-bold text-[#3B82F6] tracking-widest">
                  RE-AUDIT ROUND {totalRounds + 1}/{maxRounds}
                </span>
              </div>
              <button
                onClick={() => {
                  if (reAuditing) return;
                  setShowReAudit(false);
                  setReAuditFile(null);
                }}
                className="text-[#404040] hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="font-mono text-[10px] text-[#777] leading-relaxed">
                Upload a revised document for the next round. Previous rounds remain preserved and selectable.
              </p>

              <input
                ref={reAuditFileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => setReAuditFile(e.target.files?.[0] || null)}
              />

              <button
                onClick={() => reAuditFileRef.current?.click()}
                className="w-full border border-[#262626] px-3 py-2.5 text-left hover:border-[#404040] transition-colors"
              >
                <span className="block font-mono text-[9px] text-[#404040] tracking-widest mb-1">REPLACEMENT FILE</span>
                <span className="block font-mono text-[10px] text-white truncate">
                  {reAuditFile?.name || 'SELECT FILE (.PDF, .DOC, .DOCX, .TXT)'}
                </span>
              </button>

              <div className="font-mono text-[9px] text-[#404040] tracking-widest">
                CURRENT USAGE: {totalRounds}/{maxRounds}
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleReAudit}
                disabled={!reAuditFile || reAuditing}
                className={`flex-1 py-2.5 font-mono text-xs font-bold tracking-widest transition-colors ${
                  !reAuditFile || reAuditing
                    ? 'bg-[#333] text-[#666] cursor-not-allowed'
                    : 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                }`}
              >
                {reAuditing ? 'RE-AUDITING...' : 'START RE-AUDIT'}
              </button>
              <button
                onClick={() => {
                  if (reAuditing) return;
                  setShowReAudit(false);
                  setReAuditFile(null);
                }}
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