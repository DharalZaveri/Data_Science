import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, Building2, Phone, MapPin, Briefcase, Copy, Check, Save, Loader2, Award, Shield, Coins, AppWindow
} from 'lucide-react';
import { motion } from 'motion/react';

export function AccountDetails() {
  const { user, userProfile, updateProfile } = useAuth();
  
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [errorInput, setErrorInput] = useState<string | null>(null);

  // Initialize fields when userProfile is loaded
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setCompanyName(userProfile.companyName || '');
      setPhoneNumber(userProfile.phoneNumber || '');
      setAddress(userProfile.address || '');
      setBusinessCategory(userProfile.businessCategory || 'boutique');
    }
  }, [userProfile]);

  const handleCopyId = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorInput(null);
    setSaveSuccess(false);

    try {
      await updateProfile({
        displayName,
        companyName,
        phoneNumber,
        address,
        businessCategory
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorInput(err?.message || "Failed to save profile. Please check database permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="p-1 sm:p-2 max-w-4xl mx-auto"
      id="account-details-page"
    >
      <div className="flex flex-col md:flex-row items-stretch gap-6">
        
        {/* Left column - Account Status Card */}
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <div className="bg-gray-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full border border-gray-700">
            {/* Ambient visual overlay */}
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_50%_0%,rgba(120,119,198,0.3),transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-yellow-500/10 text-yellow-400 rounded-full border border-yellow-500/10 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> SECURE PROFILE
                </span>
                <Award className="w-6 h-6 text-yellow-500" />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-500 font-semibold">Logged in as</p>
                <h3 className="text-base font-bold tracking-tight truncate">
                  {user?.email || 'Guest Member'}
                </h3>
              </div>

              <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5 text-gray-400">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-semibold">Available Wallet</span>
                </div>
                <div className="text-2xl font-black text-yellow-400">
                  {userProfile?.credits ?? 0} Credits
                </div>
                <p className="text-[10px] text-gray-500">
                  Top up credits anytime for pristine high-fidelity commercial drapes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Main Profile Input Details */}
        <div className="flex-1 bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Commercial Registration Details</h2>
            <p className="text-xs text-blue-500 font-semibold mt-1">
              Store your billing name, shop address, and brand category to pre-populate custom catalogs, watermark identifiers, and export metadata securely in the database.
            </p>
          </div>

          {errorInput && (
            <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-semibold">
              {errorInput}
            </div>
          )}

          {saveSuccess && (
            <div className="mb-5 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-yellow-600" /> Profile details saved successfully in database.
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Display Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-700 block">Personal Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full text-sm pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-gray-800 focus:bg-white outline-none transition"
                  />
                </div>
              </div>

              {/* Company/Shop Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-700 block">Shop / Factory Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Elegance Silk Fabrics"
                    className="w-full text-sm pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-gray-800 focus:bg-white outline-none transition"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Phone Number Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-700 block">Business Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full text-sm pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-gray-800 focus:bg-white outline-none transition"
                  />
                </div>
              </div>

              {/* Business Sector Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-700 block">Business Category</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <select
                    value={businessCategory}
                    onChange={(e) => setBusinessCategory(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-gray-800 focus:bg-white outline-none transition appearance-none"
                  >
                    <option value="boutique">Custom Design Boutique</option>
                    <option value="manufacturer">Apparel Manufacturer / Loom</option>
                    <option value="wholesaler">Ethnic Wear Wholesaler</option>
                    <option value="e-retailer">Online Retail Shop / Shopify Store</option>
                    <option value="designer">Independent Fashion Designer</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Address Area */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-700 block">Shop/Company Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 402, Ring Road Textile Market, Surat, Gujarat - 395002"
                  rows={3}
                  className="w-full text-sm pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-gray-800 focus:bg-white outline-none transition resize-none"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-blue-300 text-white font-bold text-xs px-6 py-3 rounded-xl transition cursor-pointer shadow-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Updating Database...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-gray-400" />
                    Save Registration Details
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </motion.div>
  );
}
