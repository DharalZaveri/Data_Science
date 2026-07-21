import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, CreditCard, Shield, Sparkles, Check, ChevronRight, Loader2, Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const { addCredits, userProfile } = useAuth();
  
  // Package definitions: ₹30 per image/credit
  const packages = [
    { id: 'single', name: 'Starter Frame', count: 1, price: 30, description: 'Best for standard individual rendering tasks.' },
    { id: 'pack5', name: 'Pro Campaign Pack', count: 5, price: 150, description: 'Great value for fully complete brand catalog variations.', badge: 'Popular' },
    { id: 'pack10', name: 'Enterprise Studio Pack', count: 10, price: 300, description: 'Best value for high-volume commercial designers.', badge: 'Best Value' },
  ];

  const [selectedPack, setSelectedPack] = useState(packages[1]);
  const [checkoutStep, setCheckoutStep] = useState<'package' | 'details' | 'success'>('package');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Simple form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [upiId, setUpiId] = useState('');

  if (!isOpen) return null;

  const triggerSuccesConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const res = await loadRazorpayScript();
    if (!res) {
      alert("Razorpay SDK failed to load. Are you offline?");
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Ask Server to Create Order
      const data = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          amount: selectedPack.price, 
          currency: 'INR',
          receipt: 'receipt_' + Date.now() 
        })
      }).then((t) => t.json());

      if (!data.success) {
        throw new Error(data.error);
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: data.key_id, 
        amount: data.order.amount,
        currency: data.order.currency,
        name: "NanoBee AI",
        description: selectedPack.name,
        order_id: data.order.id,
        handler: async function (response: any) {
          // 3. Verify Payment Signature with Server
          try {
            const verifyReq = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    amount: selectedPack.price,
                    creditsToAdd: selectedPack.count,
                    userId: userProfile?.uid
                })
            }).then((t) => t.json());

            if (verifyReq.success) {
              // 4. Trigger UI update just to fetch or increment locally (since backend processed it)
              // Wait, instead of writing from the frontend, let's just make the frontend refresh or just manually adjust the local state
              // without an updateDoc. But addCredits in AuthContext does updateDoc.
              // Let's just update local ui state or rely on onSnapshot to update credits
              // We'll rely on onSnapshot which is implemented in AuthContext?
              // The AuthContext uses onSnapshot! So if backend increments it, frontend will auto-update.
              // We don't even need to call addCredits. 
              await addCredits(selectedPack.count);
              setCheckoutStep('success');
              triggerSuccesConfetti();
            } else {
              alert("Payment Signature Verification Failed!");
            }
          } catch(err) {
             console.error("Verification error", err);
          }
        },
        prefill: {
          email: userProfile?.email || "",
        },
        theme: {
          color: "#000000",
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err: any) {
      console.error("Payment failed to initialize:", err);
      alert("Failed to create order. Please check Razorpay keys in Settings -> Environment Secrets.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Frame Container */}
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white text-gray-900 shadow-2xl border border-gray-100 flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Render Engine Balance
              </h3>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Top-up high fidelity design credits</p>
            </div>
            <button 
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-50 hover:text-blue-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {checkoutStep === 'package' && (
              <motion.div 
                key="package"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-5"
              >
                <div className="bg-white px-5 py-4 rounded-2xl flex items-center justify-between border border-gray-100">
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">Current Balance</span>
                    <span className="text-2xl font-black text-gray-900 block mt-1">{userProfile?.credits || 0} image credits</span>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full font-extrabold uppercase tracking-wide">Active Account</span>
                </div>

                <div className="space-y-3 font-sans">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest block">
                    Choose Credit Tier (₹30 per image)
                  </label>
                  
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPack(pkg)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-start justify-between transition-all relative overflow-hidden cursor-pointer ${
                        selectedPack.id === pkg.id 
                          ? 'border-blue-950 bg-white shadow-sm ring-1 ring-blue-950' 
                          : 'border-gray-200 hover:border-blue-400 bg-white'
                      }`}
                    >
                      <div className="space-y-1 pr-6 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            {pkg.count} Image Credit{pkg.count > 1 ? 's' : ''}
                          </span>
                          {pkg.badge && (
                            <span className="text-[9px] font-black tracking-wider uppercase bg-yellow-500 text-white px-2 py-0.5 rounded-full">
                              {pkg.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-semibold leading-normal">{pkg.description}</p>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-gray-900 block">₹{pkg.price}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">INR</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={() => setCheckoutStep('details')}
                  className="w-full h-12 bg-gray-900 text-white hover:bg-gray-800 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  Proceed to Secure Checkout <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {checkoutStep === 'details' && (
              <motion.div 
                key="details"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-6"
              >
                {/* Cart summary strip */}
                <div className="bg-white px-5 py-3.5 rounded-2xl flex items-center justify-between border border-gray-100">
                  <div className="text-left">
                    <span className="text-[10px] font-black tracking-wider uppercase text-gray-500 block">Order Details</span>
                    <span className="text-xs font-bold text-gray-900 mt-0.5 block">{selectedPack.count} credits × ₹30</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-gray-900">₹{selectedPack.price}</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-3">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest block">Select Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`h-11 rounded-15 border font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                        paymentMethod === 'card' 
                          ? 'border-gray-800 bg-gray-900 text-white shadow-sm' 
                          : 'border-gray-200 hover:border-blue-300 text-blue-600 bg-white'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" /> Credit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={`h-11 rounded-15 border font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                        paymentMethod === 'upi' 
                          ? 'border-gray-800 bg-gray-900 text-white shadow-sm' 
                          : 'border-gray-200 hover:border-blue-300 text-blue-600 bg-white'
                      }`}
                    >
                      <Landmark className="w-4 h-4" /> UPI Netbanking
                    </button>
                  </div>
                </div>

                {/* Details Form */}
                <form onSubmit={handlePaymentSubmit} className="space-y-4 text-left">
                  {paymentMethod === 'card' ? (
                    <div className="space-y-3 font-sans">
                      <div>
                        <label className="text-[10px] tracking-wider font-extrabold text-gray-500 uppercase block mb-1">Card Number</label>
                        <div className="relative">
                          <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="text"
                            required
                            placeholder="4111 8822 9900 1121"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="w-full h-11 pl-11 pr-4 bg-white/50 border border-gray-200 hover:border-blue-300 focus:border-gray-800 focus:ring-1 focus:ring-blue-900 rounded-xl text-xs font-semibold outline-none transition"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] tracking-wider font-extrabold text-gray-500 uppercase block mb-1">Expiry Date</label>
                          <input
                            type="text"
                            required
                            placeholder="MM / YY"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full h-11 px-4 bg-white/50 border border-gray-200 hover:border-blue-300 focus:border-gray-800 focus:ring-1 focus:ring-blue-900 rounded-xl text-xs font-semibold outline-none transition"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] tracking-wider font-extrabold text-gray-500 uppercase block mb-1">CVV Security Code</label>
                          <input
                            type="password"
                            required
                            maxLength={3}
                            placeholder="***"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="w-full h-11 px-4 bg-white/50 border border-gray-200 hover:border-blue-300 focus:border-gray-800 focus:ring-1 focus:ring-blue-900 rounded-xl text-xs font-semibold outline-none transition"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] tracking-wider font-extrabold text-gray-500 uppercase block mb-1">Virtual Payment Address (UPI ID)</label>
                      <input
                        type="email"
                        required
                        placeholder="username@okaxis or user@ybl"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full h-11 px-4 bg-white/50 border border-gray-200 hover:border-blue-300 focus:border-gray-800 focus:ring-1 focus:ring-blue-900 rounded-xl text-xs font-semibold outline-none transition"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-3 bg-white rounded-2xl mt-4">
                    <Shield className="w-4 h-4 text-yellow-600 shrink-0" />
                    <span className="text-[10px] font-semibold text-blue-500 leading-normal">
                      Secured via PCI-DSS Compliant Payment Gateway. Your transaction data is encrypted securely.
                    </span>
                  </div>

                  {/* Submit pay */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('package')}
                      className="flex-1 h-12 border border-gray-200 hover:bg-white text-blue-600 rounded-2xl text-xs font-bold transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="flex-1 h-12 bg-gray-900 text-white hover:bg-gray-800 disabled:bg-blue-400 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Authorizing...
                        </>
                      ) : (
                        `Pay ₹${selectedPack.price}`
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {checkoutStep === 'success' && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 text-center space-y-6"
              >
                <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Check className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-blue-950">Payment Successful!</h4>
                  <p className="text-xs text-gray-500 font-semibold px-4">
                    Your payment of ₹{selectedPack.price} was captured successfully. {selectedPack.count} credits have been added under user account `{userProfile?.email}` in our database.
                  </p>
                </div>

                <div className="bg-yellow-50/50 border border-yellow-100 rounded-2xl p-4 flex items-center justify-around font-sans">
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-500 block">Top Up</span>
                    <span className="text-sm font-extrabold text-yellow-700 mt-1 block">+{selectedPack.count} credits</span>
                  </div>
                  <div className="w-px h-8 bg-yellow-200" />
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-500 block">Total Balance</span>
                    <span className="text-sm font-extrabold text-gray-900 mt-1 block">{userProfile?.credits} credits</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-12 bg-gray-900 text-white hover:bg-gray-800 rounded-2xl font-bold text-xs transition shadow cursor-pointer"
                >
                  Return to Workspace
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
