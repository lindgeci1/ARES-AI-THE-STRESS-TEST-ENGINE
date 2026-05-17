import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ZapIcon,
  ShieldIcon,
  SwordIcon,
  LockIcon
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import { authService, type PublicStats } from '../services/authService';
const DEMO_HEATMAP_PARAGRAPHS = [
{
  text: 'The company maintains a strict policy of data confidentiality and all user information is encrypted at rest using AES-256 encryption standards.',
  heat: 'green'
},
{
  text: 'However, third-party vendors may have access to certain anonymized datasets for analytical purposes without explicit user consent being obtained.',
  heat: 'red'
},
{
  text: 'Our infrastructure is hosted on major cloud providers with 99.9% uptime SLA guarantees and automatic failover mechanisms in place.',
  heat: 'green'
},
{
  text: 'Retention periods for user data are not clearly defined and may vary depending on the service tier and regional compliance requirements.',
  heat: 'yellow'
},
{
  text: 'All financial transactions are processed through PCI-DSS compliant payment processors with end-to-end encryption.',
  heat: 'green'
},
{
  text: "The arbitration clause in Section 14.3 waives the user's right to class action lawsuits and mandates individual arbitration proceedings.",
  heat: 'red'
}];

const DEMO_BATTLE_LOG = [
{
  role: 'AUDITOR',
  text: 'THREAT IDENTIFIED: Clause 7.2 permits data sharing with "affiliated entities" — undefined scope.',
  time: '00:01:23'
},
{
  role: 'OPTIMIST',
  text: 'DEFENSE: Affiliated entities are defined in Exhibit A, Appendix 3. Scope is contractually bounded.',
  time: '00:01:45'
},
{
  role: 'AUDITOR',
  text: 'ESCALATION: Exhibit A contains no binding definitions. Language is aspirational, not enforceable.',
  time: '00:02:10'
},
{
  role: 'OPTIMIST',
  text: 'COUNTER: Industry standard interpretation applies. Legal precedent in Smith v. DataCorp (2021) supports this reading.',
  time: '00:02:34'
},
{
  role: 'AUDITOR',
  text: 'CRITICAL: Arbitration clause eliminates class action rights — high user impact vulnerability.',
  time: '00:03:01'
},
{
  role: 'SYSTEM',
  text: 'ROUND 1 COMPLETE — SURVIVAL SCORE: 58% — PROCEEDING TO ROUND 2',
  time: '00:03:15'
}];

export function Landing() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    authService.getPublicStats().then(setStats);
  }, []);

  const tickerText = stats
    ? `ACTIVE AUDITS: ${stats.total_audits.toLocaleString()}  •  THREATS DETECTED: ${stats.total_threats.toLocaleString()}  •  DOCUMENTS PROCESSED: ${stats.total_documents.toLocaleString()}  •  AVG SURVIVAL SCORE: ${stats.avg_resilience}%  •  AUDIO DEBATES: ${stats.total_audio_debates.toLocaleString()}  •  `
    : 'LOADING SYSTEM METRICS...  •  ';
  return (
    <div className="min-h-screen w-full bg-[#050505] text-white">
      {/* Ticker Bar */}
      <div className="w-full bg-[#0a0a0a] border-b border-[#262626] overflow-hidden py-2">
        <div className="ticker-content font-mono text-[10px] text-[#EF4444] tracking-widest">
          {tickerText}
          {tickerText}
          {tickerText}
          {tickerText}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-3 md:px-8 py-3 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <ZapIcon className="w-4 h-4 text-[#EF4444]" />
          <span className="font-mono text-sm font-bold tracking-widest whitespace-nowrap">
            ARES AI
          </span>
        </div>
        <div className="flex items-center gap-4 md:gap-6 overflow-x-auto whitespace-nowrap max-w-full pr-1 ml-6 md:ml-12">
          <a
            href="#concept"
            className="font-mono text-xs text-[#666] hover:text-white tracking-wider transition-colors flex-shrink-0">

            CONCEPT
          </a>
          <a
            href="#metrics"
            className="font-mono text-xs text-[#666] hover:text-white tracking-wider transition-colors flex-shrink-0">

            METRICS
          </a>
          <Link
            to="/auth"
            className="font-mono text-xs text-[#666] hover:text-white tracking-wider transition-colors flex-shrink-0">

            LOGIN
          </Link>
          {/**
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-4 py-2 bg-[#EF4444] text-white font-mono text-xs font-bold tracking-widest hover:bg-[#dc2626] transition-colors flex-shrink-0">

            START AUDIT
          </button>
          */}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-8 py-24 grid-bg">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-[#EF4444] animate-pulse" />
            <span className="font-mono text-[10px] text-[#EF4444] tracking-widest">
              SYSTEM ONLINE — ALL NODES ACTIVE
            </span>
          </div>

          <h1 className="font-sans text-6xl md:text-8xl font-bold text-white leading-none mb-4 tracking-tight">
            ARES AI
          </h1>
          <h2 className="font-sans text-xl md:text-2xl font-semibold text-[#666] tracking-widest mb-6">
            THE STRESS-TEST ENGINE
          </h2>
          <p className="font-sans text-base text-[#888] max-w-2xl mb-10 leading-relaxed">
            Deploy adversarial AI agents against your critical documents. The
            Auditor attacks. The Optimist defends. What survives is
            battle-hardened.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="px-4 md:px-6 py-2.5 md:py-3 border border-[#3B82F6] text-[#3B82F6] font-mono text-[11px] md:text-sm font-bold tracking-wider hover:bg-[#3B82F6] hover:text-white transition-colors whitespace-nowrap">

              TRY DEMO
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 md:px-6 py-2.5 md:py-3 bg-[#EF4444] text-white font-mono text-[11px] md:text-sm font-bold tracking-wider hover:bg-[#dc2626] transition-colors whitespace-nowrap">

              START AUDIT
            </button>
          </div>
        </div>
      </section>

      {/* Demo Preview */}
      {showDemo &&
      <section className="px-8 py-8 border-t border-[#262626] bg-[#080808]">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#3B82F6]" />
                <span className="font-mono text-xs text-[#3B82F6] tracking-widest">
                  DEMO — READ-ONLY PREVIEW
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#404040]">
                SURVIVAL SCORE: <span className="text-yellow-400">58%</span>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Heatmap */}
              <div className="border border-[#262626] bg-[#050505]">
                <div className="px-4 py-2 border-b border-[#262626] flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#666] tracking-widest">
                    DOCUMENT HEATMAP
                  </span>
                  <span className="font-mono text-[9px] text-[#404040]">
                    STRESS ANALYSIS ACTIVE
                  </span>
                </div>
                <div className="p-4 space-y-3 text-sm leading-relaxed">
                  {DEMO_HEATMAP_PARAGRAPHS.map((p, i) =>
                <p
                  key={i}
                  className={`px-2 py-1 font-sans text-xs leading-relaxed ${p.heat === 'red' ? 'heatmap-red text-red-200' : p.heat === 'yellow' ? 'heatmap-yellow text-yellow-200' : 'heatmap-green text-green-200'}`}>

                      {p.text}
                    </p>
                )}
                </div>
              </div>

              {/* Battle Log */}
              <div className="border border-[#262626] bg-[#050505]">
                <div className="px-4 py-2 border-b border-[#262626]">
                  <span className="font-mono text-[10px] text-[#666] tracking-widest">
                    BATTLE LOG — ROUND 1
                  </span>
                </div>
                <div className="p-4 space-y-3 battle-log overflow-y-auto max-h-72">
                  {DEMO_BATTLE_LOG.map((entry, i) =>
                <div key={i} className="flex gap-3">
                      <span className="font-mono text-[9px] text-[#404040] mt-0.5 flex-shrink-0">
                        {entry.time}
                      </span>
                      <div>
                        <span
                      className={`font-mono text-[9px] font-bold tracking-widest ${entry.role === 'AUDITOR' ? 'text-[#EF4444]' : entry.role === 'OPTIMIST' ? 'text-[#3B82F6]' : 'text-[#666]'}`}>

                          [{entry.role}]
                        </span>
                        <p className="font-mono text-[10px] text-[#888] mt-0.5 leading-relaxed">
                          {entry.text}
                        </p>
                      </div>
                    </div>
                )}
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 md:px-8 py-2.5 md:py-3 bg-[#EF4444] text-white font-mono text-[11px] md:text-sm font-bold tracking-wider hover:bg-[#dc2626] transition-colors whitespace-nowrap">

                RUN FULL AUDIT — SIGN IN REQUIRED
              </button>
            </div>
          </div>
        </section>
      }

      {/* Concept Section */}
      <section id="concept" className="px-8 py-20 border-t border-[#262626]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <span className="font-mono text-[10px] text-[#404040] tracking-widest">
              {' '}
              // SYSTEM ARCHITECTURE
            </span>
            <h3 className="font-sans text-3xl font-bold text-white mt-2">
              RED TEAM VS. BLUE TEAM
            </h3>
            <p className="font-sans text-sm text-[#666] mt-2">
              Two adversarial AI agents. One objective: find the truth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Auditor */}
            <div className="border border-[#262626] bg-[#080808] p-6 border-l-2 border-l-[#EF4444]">
              <div className="flex items-center gap-3 mb-4">
                <SwordIcon className="w-5 h-5 text-[#EF4444]" />
                <span className="font-mono text-sm font-bold text-[#EF4444] tracking-widest">
                  THE AUDITOR
                </span>
                <span className="font-mono text-[9px] text-[#404040] ml-auto">
                  RED TEAM
                </span>
              </div>
              <p className="font-sans text-sm text-[#888] leading-relaxed mb-4">
                An adversarial AI agent trained to identify vulnerabilities,
                ambiguities, and exploitable clauses in your documents. It
                attacks relentlessly.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#EF4444] flex-shrink-0" />
                  Identifies legal loopholes and ambiguous language
                </li>
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#EF4444] flex-shrink-0" />
                  Flags compliance violations and risk vectors
                </li>
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#EF4444] flex-shrink-0" />
                  Generates adversarial rebuttals in real-time
                </li>
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#EF4444] flex-shrink-0" />
                  Scores document resilience under pressure
                </li>
              </ul>
            </div>

            {/* Optimist */}
            <div className="border border-[#262626] bg-[#080808] p-6 border-l-2 border-l-[#3B82F6]">
              <div className="flex items-center gap-3 mb-4">
                <ShieldIcon className="w-5 h-5 text-[#3B82F6]" />
                <span className="font-mono text-sm font-bold text-[#3B82F6] tracking-widest">
                  THE OPTIMIST
                </span>
                <span className="font-mono text-[9px] text-[#404040] ml-auto">
                  BLUE TEAM
                </span>
              </div>
              <p className="font-sans text-sm text-[#888] leading-relaxed mb-4">
                A defensive AI agent that constructs the strongest possible
                arguments in favor of your document, surfacing hidden strengths
                and valid interpretations.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#3B82F6] flex-shrink-0" />
                  Constructs best-faith legal interpretations
                </li>
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#3B82F6] flex-shrink-0" />
                  Cites supporting precedents and standards
                </li>
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#3B82F6] flex-shrink-0" />
                  Proposes strengthening amendments
                </li>
                <li className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <span className="w-1 h-1 bg-[#3B82F6] flex-shrink-0" />
                  Generates defensive counter-arguments
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section
        id="metrics"
        className="px-8 py-16 border-t border-[#262626]">

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="font-mono text-3xl md:text-4xl font-bold text-white mb-1">
                {stats?.total_documents.toLocaleString() || '—'}
              </div>
              <div className="font-mono text-[10px] text-[#404040] tracking-widest">
                DOCS PROCESSED
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl md:text-4xl font-bold text-[#EF4444] mb-1">
                {stats?.total_threats.toLocaleString() || '—'}
              </div>
              <div className="font-mono text-[10px] text-[#404040] tracking-widest">
                THREATS FOUND
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl md:text-4xl font-bold text-[#3B82F6] mb-1">
                {stats ? `${stats.avg_resilience}%` : '—'}
              </div>
              <div className="font-mono text-[10px] text-[#404040] tracking-widest">
                AVG SURVIVAL
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl md:text-4xl font-bold text-white mb-1">
                {stats?.total_audits.toLocaleString() || '—'}
              </div>
              <div className="font-mono text-[10px] text-[#404040] tracking-widest">
                TOTAL AUDITS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-20 border-t border-[#262626]">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <LockIcon className="w-4 h-4 text-[#EF4444]" />
            <span className="font-mono text-[10px] text-[#EF4444] tracking-widest">
              ENTERPRISE-GRADE SECURITY
            </span>
          </div>
          <h3 className="font-sans text-4xl font-bold text-white mb-4">
            READY TO STRESS-TEST?
          </h3>
          <p className="font-sans text-sm text-[#666] mb-8 max-w-xl mx-auto">
            Upload your documents and watch two AI agents tear them apart —
            then rebuild them stronger.
          </p>
          <Link
            to="/auth"
            className="inline-block px-6 md:px-10 py-3 bg-[#EF4444] text-white font-mono text-[11px] md:text-sm font-bold tracking-wider hover:bg-[#dc2626] transition-colors whitespace-nowrap">
            GET STARTED
          </Link>
        </div>
      </section>

      {/* Footer (match header spacing, font, no scroll) */}
      <footer className="border-t border-[#262626]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-3 md:px-8 py-3">
          <div className="flex items-center gap-2">
            <ZapIcon className="w-3 h-3 text-[#EF4444]" />
            <span className="font-mono text-xs text-[#404040] tracking-widest">
              ARES AI © 2026
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/terms" className="font-mono text-xs text-[#666] hover:text-white tracking-wider transition-colors">TERMS</a>
            <a href="/privacy" className="font-mono text-xs text-[#666] hover:text-white tracking-wider transition-colors">PRIVACY</a>
            <a href="/docs" className="font-mono text-xs text-[#666] hover:text-white tracking-wider transition-colors">DOCS</a>
          </div>
        </div>
      </footer>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>);

}