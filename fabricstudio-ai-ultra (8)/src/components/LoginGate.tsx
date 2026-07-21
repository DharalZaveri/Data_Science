import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Sparkles, ShieldCheck, Mail, ArrowRight, Layers, LogIn, ChevronRight, Check, Landmark, Key
} from 'lucide-react';
import { motion } from 'motion/react';

export function LoginGate() {
  const { loginWithGoogle, loginWithApple } = useAuth();
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);
  const [isSubmittingApple, setIsSubmittingApple] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsSubmittingGoogle(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/internal-error') {
        setErrorMessage('Google Sign-In requires manual enablement in your Firebase Console.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMessage('Popups are blocked in this embedded preview. Please click the "New Tab" icon (↗) in the top-right corner to open this app directly and sign in.');
      } else {
        setErrorMessage(err.message || 'Third-party sign-in popup was blocked or failed. Please try again.');
      }
    } finally {
      setIsSubmittingGoogle(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsSubmittingApple(true);
    setErrorMessage(null);
    try {
      await loginWithApple();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/internal-error') {
        setErrorMessage('Apple Sign-In requires manual enablement in your Firebase Console.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMessage('Popups are blocked in this embedded preview. Please click the "New Tab" icon (↗) in the top-right corner to open this app directly and sign in.');
      } else {
        setErrorMessage(err.message || 'Apple authentication was blocked or failed. Please try again.');
      }
    } finally {
      setIsSubmittingApple(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans overflow-y-auto selection:bg-amber-100 selection:text-slate-900">
      
      {/* Background radial effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,0,0,0.02),transparent_70%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-200/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-200/40 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* Left Side: Editorial Banner */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Version 2.4 - Live Renders</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.08] font-sans text-slate-900">
            NanoBee
          </h1>

          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-xl">
            Welcome to your creative studio. Effortlessly bring your fashion visions to life with our AI-powered catalog generator.
          </p>
        </div>

        {/* Right Side: Sign-In Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col relative overflow-hidden text-center">
          
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-amber-500 font-black text-2xl mx-auto shadow-inner border border-amber-500/20">
            N
          </div>

          <div className="mt-6 space-y-2">
             <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Access Your Workshop</h2>
             <p className="text-xs text-slate-500 font-medium px-2">Sign in to save assets, track credit balances, and generate custom catalogs.</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed mt-5 text-left">
              {errorMessage}
            </div>
          )}

          <div className="space-y-3 mt-6">
            <button
              onClick={handleGoogleLogin}
              disabled={isSubmittingGoogle || isSubmittingApple}
              className="w-full h-12 bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-300 disabled:text-white rounded-2xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              {isSubmittingGoogle ? 'Requesting...' : 'Sign In with Google Account'}
            </button>

            <button
              onClick={handleAppleLogin}
              disabled={isSubmittingGoogle || isSubmittingApple}
              className="w-full h-12 bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 rounded-2xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 fill-current text-slate-900" viewBox="0 0 170 170">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.37.13-9.13-1.92-14.3-6.15-3.41-2.68-7.31-7.39-11.72-14.14-5.33-8.14-9.61-17.65-12.83-28.53-3.22-10.88-4.83-21.36-4.83-31.42 0-14.7 3.69-26.79 11.07-36.26 7.38-9.47 16.7-14.28 27.96-14.41 4.7 0 9.87 1.41 15.5 4.24 5.63 2.82 9.4 4.24 11.31 4.24 1.56 0 5.11-1.35 10.63-4.04 5.53-2.7 10.4-3.99 14.61-3.87 15.66.75 27.42 6.64 35.29 17.63-13.11 7.98-19.55 18.66-19.33 32.06.21 10.53 4.14 19.34 11.78 26.41 7.64 7.07 16.51 10.82 26.62 11.25-2.02 5.89-4.82 11.77-8.4 17.67zM119.22 35.61c0-7.85-2.77-15.02-8.31-21.51 5.92-.93 11.75 1.08 17.51 6.04 4.54 3.91 7.42 8.78 8.64 14.62-5.75 1.15-11.24-.76-16.48-5.75-1.12-1.01-1.36-1.57-1.36-3.4z" />
              </svg>
              {isSubmittingApple ? 'Requesting...' : 'Sign In with Apple ID'}
            </button>
          </div>

          <div className="text-[10px] text-slate-500 font-medium leading-normal mt-6 border-t border-slate-100 pt-4 flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Secure SSL Environment. Complies with industry requirements.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
