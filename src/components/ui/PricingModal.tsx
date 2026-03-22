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
    <div className="fixed inset-0 bg-white z-[200] overflow-y-auto">
      <button 
        onClick={() => setLang(lang === "en" ? "hi" : "en")} 
        className="absolute top-6 right-6 p-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-xl text-green-600 flex items-center gap-2 font-bold transition-all text-sm z-[210]"
      >
        <Languages size={18} />
        {lang === "en" ? "हिंदी" : "English"}
      </button>

      <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pt-12 pb-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-gray-800 mb-2">{t.chooseYourPlan || "Choose Your Plan"}</h1>
          <p className="text-gray-500 font-medium">{t.pickRightPlan || "Pick the right plan to grow your business."}</p>
        </div>

        <div className="space-y-8">
          {/* Pro Plan */}
          <div className="bg-green-50 p-6 rounded-[2rem] border-2 border-green-500 relative flex flex-col shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-[2rem] flex items-center gap-1 shadow-sm">
              <Crown size={14} /> {t.recommended || "Recommended"}
            </div>
            
            <h3 className="text-xl font-bold text-green-800">{t.proPlan || "Pro Plan"}</h3>
            <div className="mt-2 mb-6 flex items-end gap-1">
              <span className="text-4xl font-black text-green-700">₹49</span>
              <span className="text-sm text-green-600 font-bold pb-1">/month</span>
            </div>
            
            <ul className="space-y-4 text-sm text-green-800 font-bold mb-8 flex-1">
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-600 shrink-0" /> {t.advancedInsights || "Insights (Analytics Dashboard)"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-600 shrink-0" /> {t.unlimitedWhatsapp || "Unlimited WhatsApp Messages"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-600 shrink-0" /> {t.paymentReminders || "Payment Reminders"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-600 shrink-0" /> {t.salesAnalytics || "Sales Analytics"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-600 shrink-0" /> {t.topCustomersItems || "Top Customers & Items"}</li>
            </ul>

            <button 
              onClick={handleProPlan}
              disabled={isProcessing}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-green-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-auto"
            >
              {isProcessing ? "..." : t.upgradeToPro || "Upgrade to Pro"}
            </button>
          </div>

          {/* Free Plan */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-xl font-bold text-gray-800">{t.freePlan || "Free Plan"}</h3>
            <div className="mt-2 mb-6 text-3xl font-black text-gray-900">₹0</div>
            
            <ul className="space-y-4 text-sm text-gray-600 mb-8 flex-1 font-medium">
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-500 shrink-0" /> {t.customerManagement || "Customer Management"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-500 shrink-0" /> {t.basicBilling || "Basic Billing"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-green-500 shrink-0" /> {t.udharTracking || "Udhar Tracking"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-gray-400 shrink-0" /> {t.limitedWhatsapp || "Limited WhatsApp (10/day)"}</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-gray-400 shrink-0" /> {t.basicDashboard || "Basic Dashboard"}</li>
            </ul>

            <button 
              onClick={handleFreePlan}
              disabled={isProcessing}
              className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold text-lg hover:bg-gray-200 active:scale-[0.98] transition-all mt-auto"
            >
              {t.continueWithFree || "Continue with Free"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
