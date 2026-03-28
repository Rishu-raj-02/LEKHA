import React, { useState } from 'react';
import { Crown, CheckCircle2, Languages } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db, doc, updateDoc, Timestamp } from '../../firebase';
import { translations } from '../../translations';

interface PricingModalProps {
  onPlanSelected: () => void;
}

export const PricingModal = ({ onPlanSelected }: PricingModalProps) => {
  const { user, shop, setShop, lang, setLang } = useApp();
  const t = translations[lang];
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFreePlan = async () => {
    if (!user || !shop) return;
    setIsProcessing(true);
    try {
      // Optimistic instant update for UI speed
      setShop({ ...shop, planType: "free" });
      onPlanSelected();
      // Background sync
      updateDoc(doc(db, "shops", user.uid), {
        planType: "free"
      }).catch(console.error);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
    }
  };

  const handleProPlan = async () => {
    if (!user || !shop) return;
    setIsProcessing(true);

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: 4900, // Amount is in currency subunits (paise)
      currency: "INR",
      name: t.appName || "Lekha",
      description: "Pro Subscription (1 Month)",
      handler: async function (response: any) {
        try {
          const planStart = Timestamp.now();
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          const planExpiry = Timestamp.fromDate(expiryDate);

          await updateDoc(doc(db, "shops", user.uid), {
            isPro: true,
            planType: "pro",
            planStart,
            planExpiry
          });

          setShop({ ...shop, isPro: true, planType: "pro", planStart, planExpiry });
          onPlanSelected();
        } catch (error) {
          console.error("Error updating plan:", error);
          alert("Payment successful but failed to update status. Please contact support.");
        }
      },
      prefill: {
        name: shop.owner_name,
        email: user.email,
        contact: shop.phone
      },
      theme: {
        color: "#16a34a" // green-600
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', function (response: any){
        alert("Payment Failed: " + response.error.description);
        setIsProcessing(false);
    });
    rzp.open();
  };

  return (
    <div className="fixed inset-0 bg-white z-[200] overflow-y-auto font-sans">
      <button 
        onClick={() => setLang(lang === "en" ? "hi" : "en")} 
        className="absolute top-6 right-6 p-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-xl text-green-600 flex items-center gap-2 font-bold transition-all text-sm z-[210]"
      >
        <Languages size={18} />
        {lang === "en" ? "हिंदी" : "English"}
      </button>

      <div className="min-h-screen flex flex-col p-4 sm:p-6 max-w-4xl mx-auto relative pt-16 pb-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">
            {t.chooseYourPlan || "Upgrade Your Business"}
          </h1>
          <p className="text-gray-500 font-medium text-lg max-w-lg mx-auto">
            {t.pickRightPlan || "Pick the right plan to manage your shop smarter and grow faster."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* PRO PLAN - RENDER FIRST ON MOBILE IF NEEDED, BUT HERE SECOND IN GRID FOR DESKTOP COMPARISON */}
          {/* ACTUALLY USER SAID "Two cards: 1. Free 2. Pro" but "Highlight Pro" */}
          
          {/* Free Plan */}
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm flex flex-col h-full hover:border-gray-200 transition-all">
            <div className="mb-6">
              <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">For basic usage</span>
              <h3 className="text-2xl font-black text-gray-800 mt-1">Free Plan</h3>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-5xl font-black text-gray-900">₹0</span>
              </div>
              <p className="text-gray-500 text-sm font-medium mt-4">Start managing your shop digitally</p>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <FeatureItem icon="✅" label="Billing System" available />
              <FeatureItem icon="✅" label="Customer Management" available />
              <FeatureItem icon="✅" label="WhatsApp Bill Sending" available />
              <FeatureItem icon="✅" label="15 Bills per Day Limit" available />
              <FeatureItem icon="❌" label="Inventory Management" />
              <FeatureItem icon="❌" label="Insights Dashboard" />
              <FeatureItem icon="❌" label="Sales Analytics" />
              <FeatureItem icon="❌" label="Top Customers & Items" />
              <FeatureItem icon="❌" label="Payment Reminders" />
              <FeatureItem icon="❌" label="Monthly Reports" />
            </div>

            <button 
              onClick={handleFreePlan}
              disabled={isProcessing}
              className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-black text-lg hover:bg-gray-200 active:scale-[0.98] transition-all"
            >
              Continue with Free
            </button>
          </div>

          {/* Pro Plan */}
          <div className="bg-green-50 p-8 rounded-[2.5rem] border-2 border-green-500 relative flex flex-col h-full shadow-[0_20px_40px_rgba(22,163,74,0.15)] ring-4 ring-green-500/10 overflow-hidden">
            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] sm:text-xs font-black px-5 py-2 rounded-bl-[2rem] flex items-center gap-1.5 shadow-sm uppercase tracking-wider">
               <Crown size={14} fill="white" /> Most Popular
            </div>
            
            <div className="mb-6">
              <span className="text-green-600 font-bold uppercase tracking-widest text-[10px]">🚀 Best for growing दुकानदार</span>
              <h3 className="text-2xl font-black text-green-900 mt-1">Pro Plan</h3>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-5xl font-black text-green-700">₹49</span>
                <span className="text-sm text-green-600 font-bold pb-1">/month</span>
              </div>
              <p className="text-green-700/80 text-sm font-bold mt-4 italic">Save hours daily & grow your business faster</p>
            </div>
            
            <div className="space-y-4 mb-2 flex-1">
              <FeatureItem icon="✅" label="Billing System" available isPro />
              <FeatureItem icon="✅" label="Customer Management" available isPro />
              <FeatureItem icon="✅" label="Unlimited WhatsApp Messaging" available isPro />
              <FeatureItem icon="✅" label="Unlimited Billing (No Limit)" available isPro />
              <FeatureItem icon="✅" label="Inventory Management" available isPro />
              <FeatureItem icon="✅" label="Insights Dashboard" available isPro />
              <FeatureItem icon="✅" label="Sales Analytics" available isPro />
              <FeatureItem icon="✅" label="Top Customers & Items" available isPro />
              <FeatureItem icon="✅" label="Payment Reminders" available isPro />
              <FeatureItem icon="✅" label="Monthly Reports" available isPro />
            </div>

            <p className="text-[10px] text-green-600 font-black mb-6 text-center italic">
              Used by smart shop owners to grow faster 📈
            </p>

            <button 
              onClick={handleProPlan}
              disabled={isProcessing}
              className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-[0_10px_20px_rgba(22,163,74,0.3)] hover:bg-green-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-auto"
            >
              {isProcessing ? "..." : "Upgrade to Pro"}
            </button>
          </div>

        </div>

        <p className="text-center text-gray-400 text-[10px] font-bold mt-12 uppercase tracking-tighter">
          Secure Payment via Razorpay  
        </p>
      </div>
    </div>
  );
};

const FeatureItem = ({ icon, label, available = false, isPro = false }: { icon: string, label: string, available?: boolean, isPro?: boolean }) => (
  <div className={`flex items-center gap-3 ${!available ? 'opacity-40 grayscale' : ''}`}>
    <div className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full ${available ? (isPro ? 'bg-green-100' : 'bg-green-50') : 'bg-gray-100'}`}>
       <span className="text-sm">{icon}</span>
    </div>
    <span className={`text-sm font-bold ${isPro ? 'text-green-900' : (available ? 'text-gray-700' : 'text-gray-400')}`}>
      {label}
    </span>
  </div>
);
