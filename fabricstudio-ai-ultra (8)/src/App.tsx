/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, Settings, HelpCircle, Image as ImageIcon, Zap, ChevronRight, Key, 
  Coins, LogOut, Plus, Loader2, Layers, History, User, CreditCard
} from 'lucide-react';
import { CatalogStudio } from './components/CatalogStudio';
import { HistoryGallery } from './components/HistoryGallery';
import { AdminDashboard } from './components/AdminDashboard';
import { AccountDetails } from './components/AccountDetails';
import { Button } from './components/UI';
import { cn } from './lib/utils';
import { useAuth } from './contexts/AuthContext';
import { LoginGate } from './components/LoginGate';
import { PaymentModal } from './components/PaymentModal';

// Declare aistudio types globally for TS
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    }
  }
}

export default function App() {
  const { user, userProfile, loading, logout } = useAuth();
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'history' | 'admin' | 'account'>('studio');

  useEffect(() => {
    const handleOpenPayment = () => setIsPaymentOpen(true);
    window.addEventListener('openPaymentModal', handleOpenPayment);
    return () => window.removeEventListener('openPaymentModal', handleOpenPayment);
  }, []);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-4 text-gray-900 font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-4">Initializing Workshop...</span>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-[100dvh] bg-yellow-50 flex items-center justify-center p-4 font-sans text-gray-900">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Key className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">API Key Required</h1>
            <p className="mt-2 text-sm text-blue-600 leading-relaxed">
              This application utilizes high-fidelity Gemini models for rendering. 
              Please provide your API key to access the rendering engine.
            </p>
          </div>
          <button 
            onClick={handleSelectKey}
            className="w-full py-3.5 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-md cursor-pointer"
          >
            Configure API Key
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginGate />;
  }

  const userAvatarChar = (userProfile?.displayName || userProfile?.companyName || user?.email || 'U')[0].toUpperCase();

  return (
    <div className="flex flex-col h-[100dvh] bg-white font-sans overflow-hidden text-gray-900 select-none">
      
      {/* Modern Top Navigation Bar */}
      <header className="h-[72px] bg-white border-b border-gray-200 px-4 sm:px-8 flex items-center justify-between shrink-0 z-40 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-amber-400 font-black text-xl shadow-inner border border-amber-400/20">
              N
            </div>
            <span className="font-extrabold text-xl tracking-tight text-gray-900 hidden sm:block">
              NanoBee
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 ml-4 bg-gray-50/80 p-1 rounded-xl border border-gray-100">
            <button 
               onClick={() => setActiveTab('studio')}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                 activeTab === 'studio' ? "bg-white text-blue-700 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
               )}
             >
               <Layers className="w-4 h-4" /> Studio
             </button>
             <button 
               onClick={() => setActiveTab('history')}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                 activeTab === 'history' ? "bg-white text-blue-700 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
               )}
             >
               <History className="w-4 h-4" /> Archive
             </button>
             {userProfile?.role === 'admin' && (
               <button 
                 onClick={() => setActiveTab('admin')}
                 className={cn(
                   "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                   activeTab === 'admin' ? "bg-white text-amber-600 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                 )}
               >
                 <Settings className="w-4 h-4" /> Admin
               </button>
             )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4">
           {/* Dynamic Credit balance pill */}
           <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-xl pl-3 pr-1.5 py-1.5 shadow-sm">
             <Coins className="w-4 h-4 text-amber-500" />
             <span className="text-xs font-bold text-gray-800">
               {userProfile?.credits ?? 0} <span className="hidden lg:inline">Credit{userProfile?.credits !== 1 && 's'}</span>
             </span>
             <button 
               onClick={() => setIsPaymentOpen(true)}
               title="Top-up credits"
               className="ml-1.5 h-7 w-7 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center cursor-pointer transition-all shadow-sm"
             >
               <Plus className="w-3.5 h-3.5" />
             </button>
           </div>

           {/* Account navigation button */}
           <button
             onClick={() => setActiveTab('account')}
             className={cn(
               "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all select-none cursor-pointer hidden sm:flex",
               activeTab === 'account' 
                 ? "bg-white text-gray-800 border-gray-200 shadow-sm" 
                 : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
             )}
           >
             <div className="w-6 h-6 bg-gradient-to-tr from-blue-700 to-blue-500 text-white rounded-md text-[10px] font-extrabold flex items-center justify-center uppercase shadow-inner shrink-0">
               {userAvatarChar}
             </div>
             <span className="text-xs font-bold truncate max-w-[120px]">
               {userProfile?.companyName || userProfile?.displayName || 'My Profile'}
             </span>
           </button>

           <div className="w-px h-6 bg-gray-200 hidden md:block mx-1"></div>

           <button 
             onClick={logout}
             className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors text-sm font-semibold cursor-pointer"
           >
             <LogOut className="w-4 h-4" /> <span className="hidden lg:inline">Log Out</span>
           </button>
        </div>
      </header>

      {/* MOBILE Frosted Bottom Navigation Bar */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 px-6 items-center justify-between shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab('studio')}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-bold uppercase tracking-wider",
            activeTab === 'studio' ? "text-blue-600" : "text-gray-400"
          )}
        >
          <Layers className="w-5 h-5" />
          <span>Studio</span>
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-bold uppercase tracking-wider",
            activeTab === 'history' ? "text-blue-600" : "text-gray-400"
          )}
        >
          <History className="w-5 h-5" />
          <span>Archive</span>
        </button>

        <button 
          onClick={() => setActiveTab('account')}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-bold uppercase tracking-wider",
            activeTab === 'account' ? "text-blue-600" : "text-gray-400"
          )}
        >
          <User className="w-5 h-5" />
          <span>Profile</span>
        </button>

        {userProfile?.role === 'admin' && (
          <button 
            onClick={() => setActiveTab('admin')}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-bold uppercase tracking-wider",
              activeTab === 'admin' ? "text-amber-500" : "text-gray-400"
            )}
          >
            <Settings className="w-5 h-5" />
            <span>Admin</span>
          </button>
        )}

        <button 
          onClick={logout}
          className="flex flex-col items-center justify-center gap-1.5 text-gray-400 text-[10px] font-bold uppercase tracking-wider hover:text-red-500"
        >
          <LogOut className="w-5 h-5" />
          <span>Exit</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 pb-[100px] md:pb-8 bg-gray-50/50 selection:bg-blue-200 selection:text-gray-900">
        <div className="max-w-[1400px] mx-auto">
          {activeTab === 'studio' && <CatalogStudio />}
          {activeTab === 'history' && <HistoryGallery />}
          {activeTab === 'admin' && <AdminDashboard />}
          {activeTab === 'account' && <AccountDetails />}
        </div>
      </main>

      <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} />
    </div>
  );
}

