import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XIcon, ZapIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/useToast';
import { authService } from '../services/authService';
type AuthModalProps = {
  onClose: () => void;
};
export function AuthModal({ onClose }: AuthModalProps) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [email, setEmail] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTempLogin = async () => {
    try {
      setLoading(true);
      setError('');

      await authService.login({
        email,
        access_key: accessKey,
      });

      const fullUser = await authService.getCurrentUser();
      login(fullUser);
      showToast('SESSION INITIATED', 'success');
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      const message = err.message || 'Login failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-md bg-[#0a0a0a] border border-[#262626] p-6 sm:p-8 relative mx-4 sm:mx-0">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#404040] hover:text-white transition-colors"
          aria-label="Close modal">

          <XIcon className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <ZapIcon className="w-4 h-4 text-[#EF4444]" />
          <span className="font-mono text-xs text-[#EF4444] tracking-widest font-bold">
            ARES AI
          </span>
        </div>

        <h2 className="font-sans text-lg font-bold text-white mb-1">
          AUTHENTICATION REQUIRED
        </h2>
        <p className="font-mono text-xs text-[#404040] mb-6 tracking-wider">
          INITIATE SECURE SESSION TO CONTINUE
        </p>

        <div className="scanning-bar mb-6" />

        {error && (
          <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444] text-[#EF4444] font-mono text-xs rounded-none">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-[#666] tracking-widest mb-1.5">
              OPERATOR EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@domain.com"
              className="w-full bg-[#050505] border border-[#262626] px-3 py-2.5 text-sm font-mono text-white placeholder-[#333] focus:border-[#3B82F6] transition-colors rounded-none" />

          </div>

          <div>
            <label className="block font-mono text-[10px] text-[#666] tracking-widest mb-1.5">
              ACCESS KEY
            </label>
            <div className="relative">
              <input
                type={showAccessKey ? 'text' : 'password'}
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value.toUpperCase())}
                placeholder="ARES-XXXXXX-XXXXXX-ENT"
                className="w-full bg-[#050505] border border-[#262626] px-3 py-2.5 text-sm font-mono text-white placeholder-[#333] focus:border-[#3B82F6] transition-colors pr-10 rounded-none" />

              <button
                type="button"
                onClick={() => setShowAccessKey(!showAccessKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#404040] hover:text-[#666]">

                {showAccessKey ?
                <EyeOffIcon className="w-4 h-4" /> :

                <EyeIcon className="w-4 h-4" />
                }
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTempLogin}
            disabled={loading}
            className="w-full py-3 bg-[#EF4444] text-white font-mono text-sm font-bold tracking-widest hover:bg-[#dc2626] transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
          >
            {loading ? 'PROCESSING...' : 'INITIATE SESSION'}
          </button>
        </div>

        <div className="flex items-center gap-3 py-4">
          <div className="flex-1 h-px bg-[#262626]" />
          <span className="font-mono text-[10px] text-[#404040]">—</span>
          <div className="flex-1 h-px bg-[#262626]" />
        </div>

        <p className="font-mono text-[10px] text-[#404040] text-center tracking-widest">
          ARES AI — ENTERPRISE STRESS-TEST ENGINE
        </p>
      </div>
    </div>);

}