import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ZapIcon,
  LockIcon,
  CheckIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { authService, Offer, PaymentIntentResult } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { dataCache } from "../utils/dataCache";
import { useToast } from "../context/useToast";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

const SLUG_TO_OFFER_ID: Record<string, number> = {
  pro: 2,
  strategist: 2,
  titan: 3,
};

const USER_OFFERS_CACHE_KEY = "user:offers";
const USER_PAYMENTS_CACHE_KEY = "user:payments";

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#ffffff",
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      fontSize: "14px",
      letterSpacing: "0.05em",
      "::placeholder": { color: "#2a2a2a" },
      iconColor: "#404040",
    },
    invalid: { color: "#EF4444", iconColor: "#EF4444" },
  },
};

interface CheckoutFormProps {
  offer: Offer;
  intentData: PaymentIntentResult;
  onSuccess: () => void;
}

function CheckoutForm({ offer, intentData, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSuccess = async (paymentIntentId: string) => {
    await authService.confirmPayment(paymentIntentId, offer.id);
    const freshUser = await authService.getCurrentUser();
    login(freshUser);
    dataCache.invalidate(USER_OFFERS_CACHE_KEY);
    dataCache.invalidate(USER_PAYMENTS_CACHE_KEY);
    showToast('PAYMENT CONFIRMED — PLAN UPGRADED', 'success');
    onSuccess();
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setErrorMsg("");
    const card = elements.getElement(CardElement);
    if (!card) {
      setErrorMsg("Card element not found.");
      setProcessing(false);
      return;
    }
    const { error, paymentIntent } = await stripe.confirmCardPayment(
      intentData.client_secret,
      { payment_method: { card, billing_details: { name } } }
    );
    if (error) {
      const message = error.message || "Payment failed. Please try again.";
      setErrorMsg(message);
      showToast(message, 'error');
      setProcessing(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      try {
        await handleSuccess(paymentIntent.id);
      } catch (err: any) {
        const message = err.message || "Payment confirmed but profile update failed.";
        setErrorMsg(message);
        showToast(message, 'error');
        setProcessing(false);
      }
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <div>
        <label className="block font-mono text-[9px] text-[#666] tracking-widest mb-2">
          CARDHOLDER NAME
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="JOHN DOE"
          required
          className="w-full bg-[#020202] border border-[#262626] px-4 py-3 font-mono text-sm text-white placeholder-[#2a2a2a] focus:border-[#3B82F6] focus:outline-none transition-colors tracking-wider"
        />
      </div>
      <div>
        <label className="block font-mono text-[9px] text-[#666] tracking-widest mb-2">
          CARD DETAILS
        </label>
        <div className="bg-[#020202] border border-[#262626] px-4 py-3.5 focus-within:border-[#3B82F6] transition-colors">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>
      {errorMsg && (
        <div className="flex items-start gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 px-3 py-2">
          <AlertCircleIcon className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <p className="font-mono text-[10px] text-[#EF4444] leading-relaxed">{errorMsg}</p>
        </div>
      )}
      <div className="h-px bg-[#262626]" />
      <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#262626] px-4 py-3">
        <span className="font-mono text-[10px] text-[#666] tracking-widest">{offer.name}</span>
        <span className="font-mono text-sm font-bold text-white">
          {offer.price_label}{offer.price_suffix}
        </span>
      </div>
      <button
        type="submit"
        disabled={processing || !stripe}
        className="w-full py-3.5 bg-[#3B82F6] text-white font-mono text-[11px] sm:text-sm font-bold tracking-widest hover:bg-[#2563eb] transition-colors disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-3">
            <span className="font-mono text-[10px] sm:text-xs tracking-widest">PROCESSING PAYMENT</span>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <LockIcon className="w-3.5 h-3.5" />
            PAY {offer.price_label} &amp; UNLOCK QUOTA
          </span>
        )}
        {processing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1d4ed8] overflow-hidden">
            <div className="h-full bg-white/40" style={{ animation: "scan-pulse 1.2s linear infinite" }} />
          </div>
        )}
      </button>
      <p className="font-mono text-[9px] text-[#262626] text-center tracking-wider">
        BY COMPLETING THIS PURCHASE YOU AGREE TO OUR TERMS OF SERVICE
      </p>
    </form>
  );
}

export function Checkout() {
  const { plan } = useParams<{ plan: string }>();
  const navigate = useNavigate();
  const offerId = parseInt(plan ?? "") || SLUG_TO_OFFER_ID[plan ?? ""] || 2;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [intentData, setIntentData] = useState<PaymentIntentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const offers = await authService.getActiveOffers();
        const found = offers.find((o) => o.id === offerId);
        if (!found) throw new Error("Plan not found.");
        if (found.price <= 0) throw new Error("This plan is free — no payment required.");
        setOffer(found);
        const intent = await authService.createPaymentIntent(offerId);
        setIntentData(intent);
      } catch (err: any) {
        setLoadError(err.message || "Failed to initialize checkout.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [offerId]);

  const handleSuccess = () => {
    setDone(true);
    setTimeout(() => navigate("/billing"), 2200);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <h2 className="font-sans text-xl font-bold text-white mb-2">PAYMENT CONFIRMED</h2>
          <p className="font-mono text-[10px] text-[#404040] tracking-widest">
            REDIRECTING TO BILLING...
          </p>
          <div className="scanning-bar scanning-bar-blue mt-6 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  const topBar = (
    <div className="border-b border-[#262626] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ZapIcon className="w-4 h-4 text-[#EF4444]" />
        <span className="font-mono text-xs font-bold tracking-widest whitespace-nowrap">ARES AI</span>
        <span className="font-mono text-[9px] text-[#404040] tracking-widest ml-2 whitespace-nowrap">
          — SECURE CHECKOUT
        </span>
      </div>
      <div className="flex items-center gap-2">
        <LockIcon className="w-3 h-3 text-[#404040]" />
        <span className="font-mono text-[9px] text-[#404040] tracking-widest">256-BIT ENCRYPTED</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        {topBar}
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-8 h-8 border border-[#3B82F6] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="font-mono text-[9px] text-[#404040] tracking-widest">
              INITIALIZING SECURE CHECKOUT...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !offer || !intentData) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        {topBar}
        <div className="flex items-center justify-center py-32">
          <div className="text-center max-w-sm">
            <AlertCircleIcon className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
            <p className="font-mono text-sm text-white mb-2">CHECKOUT UNAVAILABLE</p>
            <p className="font-mono text-[10px] text-[#404040] tracking-wider mb-6">
              {loadError || "An unexpected error occurred."}
            </p>
            <Link to="/billing" className="font-mono text-[10px] text-[#3B82F6] tracking-widest hover:text-white transition-colors">
              LEFT ARROW BACK TO PLANS
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {topBar}
      <div className="max-w-3xl md:max-w-4xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-0 border border-[#262626] mt-8">
        <div className="bg-[#080808] border-r border-[#262626] p-6 sm:p-8 flex flex-col">
          <Link
            to="/billing"
            className="flex items-center gap-2 font-mono text-[10px] text-[#404040] hover:text-[#666] tracking-widest mb-8 transition-colors w-fit"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            BACK TO PLANS
          </Link>
          <div className="mb-2">
            <span className="font-mono text-[9px] text-[#404040] tracking-widest">ORDER SUMMARY</span>
          </div>
          <div className="border border-[#262626] bg-[#050505] p-5 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-[9px] tracking-widest mb-1" style={{ color: offer.color }}>
                  {offer.tier_label}
                </div>
                <div className="font-sans text-base font-bold text-white">{offer.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-bold" style={{ color: offer.color }}>
                  {offer.price_label}
                </div>
                {offer.price_suffix && (
                  <div className="font-mono text-[10px] text-[#404040]">{offer.price_suffix}</div>
                )}
              </div>
            </div>
            <div className="h-px bg-[#262626] mb-4" />
            <ul className="space-y-2">
              {offer.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckIcon className="w-3 h-3 flex-shrink-0" style={{ color: offer.color }} />
                  <span className="font-mono text-[10px] text-[#666]">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-[#404040] tracking-widest">SUBTOTAL</span>
              <span className="font-mono text-[10px] text-[#666]">${offer.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-[#404040] tracking-widest">TAX</span>
              <span className="font-mono text-[10px] text-[#666]">$0.00</span>
            </div>
            <div className="h-px bg-[#262626]" />
            <div className="flex justify-between">
              <span className="font-mono text-xs font-bold text-white tracking-widest">TOTAL DUE TODAY</span>
              <span className="font-mono text-xs font-bold" style={{ color: offer.color }}>
                ${offer.price.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-auto pt-6 border-t border-[#262626]">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-[#404040]" />
              <span className="font-mono text-[9px] text-[#333] tracking-widest">POWERED BY STRIPE</span>
            </div>
            <p className="font-mono text-[9px] text-[#262626] leading-relaxed">
              YOUR PAYMENT IS SECURED WITH INDUSTRY-STANDARD TLS ENCRYPTION. ARES AI NEVER STORES YOUR CARD DETAILS.
            </p>
          </div>
        </div>
        <div className="bg-[#050505] p-6 sm:p-8">
          <div className="mb-6">
            <span className="font-mono text-[9px] text-[#404040] tracking-widest">PAYMENT DETAILS</span>
          </div>
          <div className="w-full max-w-md mx-auto md:max-w-none">
            <Elements stripe={stripePromise}>
              <CheckoutForm offer={offer} intentData={intentData} onSuccess={handleSuccess} />
            </Elements>
          </div>
        </div>
      </div>
      <div className="max-w-3xl md:max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-6">
        <span className="font-mono text-[9px] text-[#1a1a1a]">VISA</span>
        <span className="font-mono text-[9px] text-[#1a1a1a]">MASTERCARD</span>
        <span className="font-mono text-[9px] text-[#1a1a1a]">AMEX</span>
        <span className="font-mono text-[9px] text-[#1a1a1a]">STRIPE SECURED</span>
      </div>
    </div>
  );
}
