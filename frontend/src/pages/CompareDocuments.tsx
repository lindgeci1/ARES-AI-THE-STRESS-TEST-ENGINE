import React, { useEffect, useState } from 'react';
import { authService, type Document } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer,
} from 'recharts';
import { GitCompareArrowsIcon, LoaderIcon } from 'lucide-react';

const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308'];

export function CompareDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    authService.getUserDocuments(user.id)
      .then((docs) => setDocuments(docs.filter((d) => d.status === 'processed')))
      .catch(() => setError('Failed to load documents'))
      .finally(() => setLoading(false));
  }, [user]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const compare = async () => {
    if (selected.length < 2) return;
    setComparing(true);
    setError(null);
    setResult(null);
    try {
      const data = await authService.compareDocuments(selected);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setComparing(false);
    }
  };

  const radarData = result?.comparison?.dimension_scores?.map((d: any) => {
    const row: any = { dimension: d.dimension };
    Object.entries(d.scores).forEach(([title, score]) => { row[title] = score; });
    return row;
  }) ?? [];

  const docTitles: string[] = result?.documents?.map((d: any) => d.title) ?? [];

  return (
    <div className="min-h-screen bg-[#050505] p-6 font-mono">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 border-b border-[#262626] pb-4">
          <GitCompareArrowsIcon className="w-5 h-5 text-[#EF4444]" />
          <div>
            <h1 className="text-white text-sm font-bold tracking-widest">COMPARE DOCUMENTS</h1>
            <p className="text-[#404040] text-[10px] tracking-widest mt-0.5">SELECT 2–4 PROCESSED DOCUMENTS</p>
          </div>
        </div>

        {/* Document selector */}
        {loading ? (
          <div className="text-[#404040] text-[11px] tracking-widest">LOADING DOCUMENTS...</div>
        ) : documents.length === 0 ? (
          <div className="text-[#404040] text-[11px] tracking-widest">NO PROCESSED DOCUMENTS FOUND</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
            {documents.map((doc) => {
              const isSelected = selected.includes(doc.id);
              const latest = doc.audit_reports?.[doc.audit_reports.length - 1];
              const score = latest?.resilience_score ?? null;
              const scoreColor = score === null ? '#404040' : score < 40 ? '#EF4444' : score < 70 ? '#EAB308' : '#22C55E';
              return (
                <button
                  key={doc.id}
                  onClick={() => toggle(doc.id)}
                  className={`text-left p-3 border transition-colors ${
                    isSelected
                      ? 'border-[#EF4444] bg-[#0f0f0f]'
                      : 'border-[#262626] bg-[#080808] hover:border-[#404040]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white text-[11px] tracking-wider truncate max-w-[70%]">{doc.file_name}</span>
                    {score !== null && (
                      <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{score}%</span>
                    )}
                  </div>
                  <div className="text-[#404040] text-[9px] tracking-widest mt-1">
                    {isSelected ? '✓ SELECTED' : 'CLICK TO SELECT'}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Compare button */}
        <button
          onClick={compare}
          disabled={selected.length < 2 || comparing}
          className="w-full py-3 bg-[#EF4444] text-white text-[11px] font-bold tracking-widest hover:bg-[#dc2626] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-8"
        >
          {comparing ? (
            <><LoaderIcon className="w-3.5 h-3.5 animate-spin" /> RUNNING COMPARISON...</>
          ) : (
            `COMPARE ${selected.length >= 2 ? `(${selected.length} DOCS)` : '— SELECT AT LEAST 2'}`
          )}
        </button>

        {error && (
          <div className="border border-[#EF4444] bg-[#EF4444]/10 p-3 text-[#EF4444] text-[11px] tracking-widest mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Winner + Summary */}
            <div className="border border-[#262626] p-5">
              <div className="text-[#404040] text-[9px] tracking-widest mb-1">WINNER</div>
              <div className="text-[#EF4444] text-sm font-bold tracking-widest mb-3">
                {result.comparison.winner}
              </div>
              <div className="text-[#666] text-[11px] leading-relaxed">
                {result.comparison.comparison_summary}
              </div>
            </div>

            {/* Side-by-side score cards */}
            <div className={`grid gap-3 grid-cols-${Math.min(docTitles.length, 2)} sm:grid-cols-${docTitles.length}`} style={{ gridTemplateColumns: `repeat(${docTitles.length}, 1fr)` }}>
              {result.documents.map((doc: any, i: number) => (
                <div key={doc.title} className="border border-[#262626] p-4">
                  <div className="text-[9px] text-[#404040] tracking-widest mb-1" style={{ color: COLORS[i] }}>
                    DOC {i + 1}
                  </div>
                  <div className="text-white text-[11px] font-bold tracking-wider truncate mb-2">{doc.title}</div>
                  <div className="text-2xl font-bold" style={{ color: doc.resilience_score < 40 ? '#EF4444' : doc.resilience_score < 70 ? '#EAB308' : '#22C55E' }}>
                    {doc.resilience_score}%
                  </div>
                  <div className="text-[#404040] text-[9px] mt-1">{doc.vulnerability_count} VULNERABILITIES · {doc.fallacy_count} FALLACIES</div>
                </div>
              ))}
            </div>

            {/* Radar chart */}
            {radarData.length > 0 && (
              <div className="border border-[#262626] p-5">
                <div className="text-[#404040] text-[9px] tracking-widest mb-4">DIMENSION ANALYSIS</div>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#262626" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#404040', fontSize: 9 }} />
                    {docTitles.map((title, i) => (
                      <Radar key={title} name={title} dataKey={title} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#666' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Strengths & Weaknesses table */}
            <div className="border border-[#262626]">
              <div className="grid border-b border-[#262626]" style={{ gridTemplateColumns: `1fr repeat(${docTitles.length}, 1fr)` }}>
                <div className="p-3 text-[9px] text-[#404040] tracking-widest border-r border-[#262626]">CATEGORY</div>
                {docTitles.map((title, i) => (
                  <div key={title} className="p-3 text-[9px] font-bold tracking-widest truncate border-r border-[#262626] last:border-r-0" style={{ color: COLORS[i] }}>
                    {title}
                  </div>
                ))}
              </div>
              <div className="grid border-b border-[#262626]" style={{ gridTemplateColumns: `1fr repeat(${docTitles.length}, 1fr)` }}>
                <div className="p-3 text-[9px] text-[#22C55E] tracking-widest border-r border-[#262626]">STRENGTH</div>
                {docTitles.map((title) => (
                  <div key={title} className="p-3 text-[10px] text-[#666] leading-relaxed border-r border-[#262626] last:border-r-0">
                    {result.comparison.unique_strengths?.[title] ?? '—'}
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `1fr repeat(${docTitles.length}, 1fr)` }}>
                <div className="p-3 text-[9px] text-[#EF4444] tracking-widest border-r border-[#262626]">WEAKNESS</div>
                {docTitles.map((title) => (
                  <div key={title} className="p-3 text-[10px] text-[#666] leading-relaxed border-r border-[#262626] last:border-r-0">
                    {result.comparison.unique_weaknesses?.[title] ?? '—'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
