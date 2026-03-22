import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  History, 
  CheckCircle2, 
  Users, 
  Package, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Crown
} from "lucide-react";
import { db, doc, updateDoc, Timestamp } from "../firebase";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { translations } from "../translations";
import { cn } from "../utils/helpers";

export const Insights = React.memo(() => {
  const { bills, udharList, customers, products, lang, isProUser, user, shop, setShop } = useApp();
  const t = translations[lang];

  // --- Helper: Get Start of Today ---
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const yesterday = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }, [today]);

  // --- 1. Today's Summary ---
  const stats = useMemo(() => {
    const todayBills = bills.filter(b => {
      const date = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
      return date >= today;
    });

    const todayUdhar = udharList.filter(u => {
      const date = u.created_at?.toDate ? u.created_at.toDate() : new Date(u.created_at);
      return date >= today && u.status === 'pending';
    });

    const todayPayments = udharList.filter(u => {
      // Note: We don't have a specific 'paid_at' field in the current schema shown, 
      // but we can assume for this insight that we're looking at records 
      // created or updated today that are now paid. 
      // For a more accurate 'yesterday vs today' we'd need timestamps for status changes.
      // But let's use created_at for this daily flow example.
      const date = u.created_at?.toDate ? u.created_at.toDate() : new Date(u.created_at);
      return date >= today && u.status === 'paid';
    });

    return {
      earnings: todayBills.reduce((acc, b) => acc + b.total_amount, 0),
      udharGiven: todayUdhar.reduce((acc, u) => acc + u.amount, 0),
      paymentsReceived: todayPayments.reduce((acc, u) => acc + u.amount, 0),
    };
  }, [bills, udharList, today]);

  // --- 2. Last 7 Days Trend ---
  const weeklyTrend = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    return last7Days.map(date => {
      const dayTotal = bills.filter(b => {
        const bDate = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
        return bDate.toDateString() === date.toDateString();
      }).reduce((acc, b) => acc + b.total_amount, 0);

      const dayName = date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' });
      return { day: dayName, total: dayTotal };
    });
  }, [bills, today, lang]);

  // --- 3. Udhar Analysis ---
  const udharAnalysis = useMemo(() => {
    const pending = udharList.filter(u => u.status === 'pending');
    const paid = udharList.filter(u => u.status === 'paid');
    const pendingAmount = pending.reduce((acc, u) => acc + u.amount, 0);
    const paidAmount = paid.reduce((acc, u) => acc + u.amount, 0);
    
    // Unique customers with pending udhar
    const uniquePendingCustomers = new Set(pending.map(u => u.customer_id)).size;

    return {
      pendingAmount,
      paidAmount,
      pendingCount: uniquePendingCustomers,
      totalCount: customers.length
    };
  }, [udharList, customers]);

  // --- 4. Top Performers (Customers & Items) ---
  const topPerformers = useMemo(() => {
    // Top 3 Customers by Total Bill Amount
    const customerTotals: Record<string, number> = {};
    bills.forEach(b => {
      customerTotals[b.customer_id] = (customerTotals[b.customer_id] || 0) + b.total_amount;
    });
    const sortedCustomers = Object.entries(customerTotals)
      .map(([id, total]) => ({
        name: customers.find(c => c.id === id)?.name || "Unknown",
        total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    // Top 3 Items by Quantity
    const itemTotals: Record<string, number> = {};
    bills.forEach(b => {
      b.items?.forEach((item: any) => {
        itemTotals[item.product_name] = (itemTotals[item.product_name] || 0) + (item.quantity || 1);
      });
    });
    const sortedItems = Object.entries(itemTotals)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    return { customers: sortedCustomers, items: sortedItems };
  }, [bills, customers]);

  // --- 5. Smart Insights Text ---
  const smartInsightsText = useMemo(() => {
    const yesterdaySales = bills.filter(b => {
      const date = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
      return date >= yesterday && date < today;
    }).reduce((acc, b) => acc + b.total_amount, 0);

    const insights = [];
    
    if (stats.earnings > yesterdaySales && yesterdaySales > 0) {
      insights.push({ text: t.salesIncreased, type: 'success', icon: TrendingUp });
    } else if (stats.earnings < yesterdaySales && yesterdaySales > 0) {
      insights.push({ text: t.salesDecreased, type: 'warning', icon: TrendingDown });
    }

    if (udharAnalysis.pendingAmount > udharAnalysis.paidAmount) {
      insights.push({ text: t.highPendingUdhar, type: 'danger', icon: AlertCircle });
    }

    if (topPerformers.items.length > 0) {
      insights.push({ text: `${t.topItemInsight} ${topPerformers.items[0].name}`, type: 'info', icon: Package });
    }

    return insights;
  }, [stats.earnings, yesterday, bills, today, t, udharAnalysis, topPerformers.items]);

  const maxWeekly = Math.max(...weeklyTrend.map(t => t.total), 1);

  if (!isProUser) {
    const openRazorpayCheckout = () => {
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: 4900,
        currency: "INR",
        name: t.appName || "Lekha",
        description: "Pro Subscription (1 Month)",
        handler: async function (response: any) {
          try {
            const planStart = Timestamp.now();
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            const planExpiry = Timestamp.fromDate(expiryDate);
            await updateDoc(doc(db, "shops", user!.uid), { isPro: true, planType: "pro", planStart, planExpiry });
            setShop({ ...shop!, isPro: true, planType: "pro", planStart, planExpiry });
          } catch (error) {
            console.error(error);
          }
        },
        prefill: { name: shop?.owner_name, email: user?.email, contact: shop?.phone },
        theme: { color: "#16a34a" }
      };
      new (window as any).Razorpay(options).open();
    };

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 blur-md bg-gray-50 flex flex-col gap-4 p-4">
           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm h-64 w-full"></div>
           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm h-48 w-full"></div>
        </div>
        <div className="relative z-10 bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-xl border border-gray-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-[1.5rem] mx-auto flex items-center justify-center mb-6 shadow-sm border-2 border-green-100">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Premium Feature</h2>
          <p className="text-gray-500 mb-8 font-medium text-sm leading-relaxed">Unlock advanced analytics, unlimited WhatsApp messages, and smart insights by upgrading to Pro.</p>
          <button 
            onClick={openRazorpayCheckout}
            className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Crown size={20} /> Upgrade for ₹49
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* SECTION 1: TODAY SUMMARY */}
      <section className="grid grid-cols-1 gap-3">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t.todayWork}</h3>
        <div className="grid grid-cols-1 gap-3">
          <motion.div whileHover={{ scale: 1.02 }} className="bg-green-600 p-5 rounded-[2.5rem] text-white shadow-xl shadow-green-200">
            <p className="text-xs font-bold opacity-80 uppercase mb-1">{t.todayEarnings}</p>
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black">₹{stats.earnings}</h2>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <DollarSign size={24} />
              </div>
            </div>
          </motion.div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t.todayUdharGiven}</p>
              <h4 className="text-lg font-black text-red-600">₹{stats.udharGiven}</h4>
            </div>
            <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t.todayPaymentsReceived}</p>
              <h4 className="text-lg font-black text-green-600">₹{stats.paymentsReceived}</h4>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: LAST 7 DAYS SALES */}
      <section className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-gray-800">{t.last7DaysSales}</h3>
          <ArrowUpRight size={20} className="text-green-600" />
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
          {weeklyTrend.map((record, i) => (
            <div key={i} className="flex flex-col items-center flex-1 gap-2">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(record.total / maxWeekly) * 100}%` }}
                className="w-full bg-green-500 rounded-lg min-h-[4px]"
              />
              <span className="text-[9px] font-bold text-gray-400 uppercase">{record.day}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 & 6: UDHAR ANALYSIS & PAYMENT STATUS */}
      <section className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">{t.udharAnalysis}</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500">{t.totalPaidAmount}</span>
              <span className="text-xs font-black text-green-600">₹{udharAnalysis.paidAmount}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(udharAnalysis.paidAmount / (udharAnalysis.paidAmount + udharAnalysis.pendingAmount || 1)) * 100}%` }}
                className="bg-green-500 h-full"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500">{t.totalPendingAmount}</span>
              <span className="text-xs font-black text-red-600">₹{udharAnalysis.pendingAmount}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(udharAnalysis.pendingAmount / (udharAnalysis.paidAmount + udharAnalysis.pendingAmount || 1)) * 100}%` }}
                className="bg-red-500 h-full"
              />
            </div>
          </div>
          <div className="pt-4 flex items-center gap-2 border-t border-dashed border-gray-100">
            <Users size={16} className="text-blue-500" />
            <p className="text-[10px] font-bold text-gray-400">
              {udharAnalysis.pendingCount} {t.udharCustomers}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4 & 5: TOP PERFORMERS */}
      <div className="grid grid-cols-2 gap-3">
        <section className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-3">{t.topCustomers}</h3>
          <div className="space-y-3">
            {topPerformers.customers.map((c, i) => (
              <div key={i}>
                <p className="text-[11px] font-black text-gray-800 truncate">{c.name}</p>
                <p className="text-[10px] text-green-600 font-bold">₹{c.total}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-3">{t.topSoldItems}</h3>
          <div className="space-y-3">
            {topPerformers.items.map((item, i) => (
              <div key={i}>
                <p className="text-[11px] font-black text-gray-800 truncate">{item.name}</p>
                <p className="text-[10px] text-blue-600 font-bold">{item.qty} {t.quantity}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* SECTION 7: QUICK INSIGHTS */}
      {smartInsightsText.length > 0 && (
        <section className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} />
            <h3 className="text-sm font-bold uppercase tracking-tight">{t.smartInsights}</h3>
          </div>
          <div className="space-y-3">
            {smartInsightsText.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="flex items-start gap-3 bg-white/10 p-3 rounded-2xl"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <p className="text-xs font-bold leading-relaxed">{insight.text}</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
});
