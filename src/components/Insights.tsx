import React, { useMemo, useState, useEffect } from 'react';
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
  Crown,
  BrainCircuit,
  Activity,
  Trophy
} from "lucide-react";
import { db, doc, updateDoc, Timestamp, onSnapshot, setDoc } from "../firebase";
import { Modal } from "./ui/Modal";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { translations } from "../translations";
import { cn, ensureDate } from "../utils/helpers";

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

  const [expenses, setExpenses] = useState({ electricity: 0, rent: 0, staff: 0, other: 0 });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const currentMonthId = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "shops", user.uid, "expenses", currentMonthId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setExpenses({
          electricity: data.electricity || 0,
          rent: data.rent || 0,
          staff: data.staff || 0,
          other: data.other || 0
        });
      } else {
        setExpenses({ electricity: 0, rent: 0, staff: 0, other: 0 });
      }
    });
    return () => unsub();
  }, [user, currentMonthId]);

  const profitStats = useMemo(() => {
    const todayBills = bills.filter(b => {
      const date = ensureDate(b.created_at);
      return date >= today;
    });

    const currentMonthBills = bills.filter(b => {
      const date = ensureDate(b.created_at);
      return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    });

    const todayProfit = todayBills.reduce((acc, b) => acc + (b.total_profit || 0), 0);
    const monthProfit = currentMonthBills.reduce((acc, b) => acc + (b.total_profit || 0), 0);
    const totalProfit = bills.reduce((acc, b) => acc + (b.total_profit || 0), 0);

    return { todayProfit, monthProfit, totalProfit };
  }, [bills, today]);

  const totalMonthlyExpenses = expenses.electricity + expenses.rent + expenses.staff + expenses.other;
  const netProfit = profitStats.monthProfit - totalMonthlyExpenses;

  // --- Advanced Analytics ---
  const advancedStats = useMemo(() => {
    // 1. Profit Trend (Last 7 Days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const profitTrend = last7Days.map(date => {
      const dayBills = bills.filter(b => {
        const bd = ensureDate(b.created_at);
        return bd.getDate() === date.getDate() && bd.getMonth() === date.getMonth() && bd.getFullYear() === date.getFullYear();
      });
      const profit = dayBills.reduce((acc, b) => acc + (b.total_profit || 0), 0);
      return {
        dateStr: date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' }),
        profit
      };
    });

    // 2. Product Stats
    const itemStats: Record<string, { name: string, qty: number, revenue: number, cost: number }> = {};
    bills.forEach(b => {
      b.items?.forEach((item: any) => {
        const itemName = item.name || item.product_name || 'Unknown Product';
        const itemId = item.id || item.product_id;
        
        let product = products.find(p => p.id === itemId);
        if (!product && typeof itemId === 'string' && itemId.includes('-')) {
           product = products.find(p => p.id === itemId.split('-')[0]);
        }
        if (!product) {
           product = products.find(p => p.name === itemName);
        }

        const cost = product?.costPrice || 0;
        if (!itemStats[itemName]) {
          itemStats[itemName] = { name: itemName, qty: 0, revenue: 0, cost: 0 };
        }
        
        const qty = item.quantity || 1;
        const price = item.price || 0;
        
        itemStats[itemName].qty += qty;
        itemStats[itemName].revenue += price * qty;
        itemStats[itemName].cost += cost * qty;
      });
    });

    const itemAnalytics = Object.values(itemStats).map(stat => {
      const profit = stat.revenue - stat.cost;
      const margin = stat.revenue > 0 ? (profit / stat.revenue) * 100 : 0;
      return { ...stat, profit, margin };
    });

    itemAnalytics.sort((a, b) => b.profit - a.profit);
    const mostProfitable = itemAnalytics[0] || null;
    const lowestProfit = itemAnalytics[itemAnalytics.length - 1] || null; 

    itemAnalytics.sort((a, b) => b.margin - a.margin);
    const bestMargin = itemAnalytics[0] || null;
    const worstMargin = itemAnalytics[itemAnalytics.length - 1] || null;

    // Smart Suggestions
    const suggestions = [];
    if (mostProfitable && mostProfitable.profit > 0) {
      suggestions.push(`👍 "${mostProfitable.name}" gives highest profit (₹${mostProfitable.profit.toFixed(0)}). Stock more!`);
    }
    if (lowestProfit && lowestProfit.profit <= 0) {
      suggestions.push(`⚠️ "${lowestProfit.name}" is causing a loss/0 profit. Review its selling price.`);
    } else if (worstMargin && worstMargin.margin < 10 && worstMargin.name !== mostProfitable?.name) {
      suggestions.push(`⚠️ "${worstMargin.name}" has a very low profit margin (${worstMargin.margin.toFixed(1)}%).`);
    }
    
    // Compare Sales
    const todayBills = bills.filter(b => {
      const date = ensureDate(b.created_at);
      return date >= today;
    });
    const yesterdayBills = bills.filter(b => {
      const date = ensureDate(b.created_at);
      return date >= yesterday && date < today;
    });
    
    const ts = todayBills.reduce((acc, b) => acc + b.items.reduce((s, i) => s + (i.price * i.quantity), 0), 0);
    const ys = yesterdayBills.reduce((acc, b) => acc + b.items.reduce((s, i) => s + (i.price * i.quantity), 0), 0);

    if (ts > ys && ys > 0) {
      suggestions.push(`📈 Great job! Today's sales (₹${ts}) improved compared to yesterday.`);
    }

    // Pending Udhar
    const totalPendingUdhar = customers.reduce((acc, c) => acc + (c.total_due || 0), 0);
    if (totalPendingUdhar > 0) { 
      suggestions.push(`💰 You have high pending udhar (₹${totalPendingUdhar}). Send reminders soon.`);
    }

    return { profitTrend, mostProfitable, lowestProfit, bestMargin, worstMargin, suggestions, itemAnalytics };
  }, [bills, products, today, yesterday, lang, customers]);

  // --- 1. Today's Summary ---
  const stats = useMemo(() => {
    const todayBills = bills.filter(b => {
      const date = ensureDate(b.created_at);
      return date >= today;
    });

    const todayUdhar = udharList.filter(u => {
      const date = ensureDate(u.created_at);
      return date >= today && u.status === 'pending';
    });

    const todayPayments = udharList.filter(u => {
      const date = ensureDate(u.created_at);
      return date >= today && u.status === 'paid';
    });

    return {
      earnings: todayBills.reduce((acc, b) => acc + b.total_amount, 0),
      udharGiven: todayUdhar.reduce((acc, u) => acc + u.amount, 0),
      paymentsReceived: todayPayments.reduce((acc, u) => acc + u.amount, 0),
    };
  }, [bills, udharList, today]);

  // --- 2. Last 7 Days Trend ---
  const { weeklyTrend, weeklyTotal } = useMemo(() => {
    const freshToday = new Date();
    freshToday.setHours(0, 0, 0, 0);

    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date(freshToday);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    let totalSum = 0;
    const trend = last7Days.map(date => {
      const dayTotal = bills.filter(b => {
        const bDate = ensureDate(b.created_at);
        return bDate.getFullYear() === date.getFullYear() && 
               bDate.getMonth() === date.getMonth() && 
               bDate.getDate() === date.getDate();
      }).reduce((acc, b) => acc + (b.total_amount || 0), 0);

      totalSum += dayTotal;
      const dayName = date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' });
      return { day: dayName, total: dayTotal };
    });

    return { weeklyTrend: trend, weeklyTotal: totalSum };
  }, [bills, lang]);

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
      const date = ensureDate(b.created_at);
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

      {/* SECTION: PROFIT & EXPENSES */}
      <section className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
        {!isProUser && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <span className="text-sm font-bold text-gray-800 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 flex items-center gap-2">
              <Crown size={18} className="text-yellow-500" /> Upgrade to unlock Profit Insights
            </span>
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Profit & Expenses (This Month)</h3>
          <button disabled={!isProUser} onClick={() => setShowExpenseModal(true)} className="text-xs bg-green-50 text-green-700 font-bold px-3 py-1.5 rounded-xl hover:bg-green-100">
            Edit Expenses
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-50 p-4 rounded-3xl border border-green-100">
            <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Gross Profit</p>
            <h4 className="text-xl font-black text-green-700">₹{profitStats.monthProfit}</h4>
          </div>
          <div className="bg-red-50 p-4 rounded-3xl border border-red-100">
            <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Total Expenses</p>
            <h4 className="text-xl font-black text-red-700">₹{totalMonthlyExpenses}</h4>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-3xl text-white flex justify-between items-center shadow-lg">
           <span className="font-bold text-xs uppercase text-gray-300">Net Profit</span>
           <span className="font-black text-2xl">₹{netProfit}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="text-center p-3 border border-gray-100 rounded-2xl">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Today Profit</p>
            <p className="font-black text-gray-800">₹{profitStats.todayProfit}</p>
          </div>
          <div className="text-center p-3 border border-gray-100 rounded-2xl">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Total Profit</p>
            <p className="font-black text-gray-800">₹{profitStats.totalProfit}</p>
          </div>
        </div>
      </section>

      {/* SECTION: SMART ANALYTICS & SUGGESTIONS */}
      <section className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden mt-6 mb-6">
        {!isProUser && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-sm font-bold text-gray-800 bg-white px-5 py-3 rounded-full shadow-lg border border-gray-100 flex items-center gap-2">
              <Crown size={18} className="text-yellow-500" /> Upgrade for Smart Analytics
            </span>
          </div>
        )}
        
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-4 flex items-center gap-1">
           <BrainCircuit size={14} className="text-purple-500" /> Smart Suggestions
        </h3>
        
        <div className="space-y-3 mb-8">
          {advancedStats?.suggestions.map((sug, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 p-3 rounded-2xl flex items-start gap-2 text-[13px] font-medium text-gray-700 leading-snug">
               {sug}
            </div>
          ))}
          {(!advancedStats?.suggestions || advancedStats.suggestions.length === 0) && (
            <p className="text-xs text-gray-400 px-1">Not enough data to generate suggestions yet.</p>
          )}
        </div>

        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-4 flex items-center gap-1">
           <Activity size={14} className="text-blue-500" /> Profit Trend (Last 7 Days)
        </h3>
        
        <div className="flex items-end justify-between bg-gray-50 p-4 rounded-3xl h-36 mb-8 border border-gray-100 pt-8">
           {advancedStats?.profitTrend.map((pt, i) => {
             const maxProfit = Math.max(...advancedStats.profitTrend.map(p => Math.abs(p.profit)), 1);
             const heightPos = (Math.abs(pt.profit) / maxProfit) * 75;
             return (
               <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                 {pt.profit !== 0 && (
                   <span className={cn("text-[7px] font-black mb-1", pt.profit > 0 ? "text-green-600" : "text-red-600")}>
                     ₹{pt.profit}
                   </span>
                 )}
                 <div className="w-full relative flex justify-center h-16 items-end">
                   {pt.profit > 0 && <div className="w-4/5 max-w-[12px] bg-green-400 rounded-t-md" style={{ height: `${Math.max(10, heightPos)}%` }} />}
                   {pt.profit < 0 && <div className="w-4/5 max-w-[12px] bg-red-400 rounded-b-md absolute top-full" style={{ height: `${Math.max(10, heightPos)}%` }} />}
                   {pt.profit === 0 && <div className="w-4/5 max-w-[12px] bg-gray-200 h-[2px] rounded-full" />}
                 </div>
                 <span className="text-[8px] font-bold text-gray-400 uppercase">{pt.dateStr}</span>
               </div>
             )
           })}
        </div>

        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-4 flex items-center gap-1">
           <Trophy size={14} className="text-yellow-500" /> Product Performance
        </h3>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
           <div className="border border-green-100 bg-green-50 p-3 rounded-2xl">
             <p className="text-[9px] font-bold text-green-600 uppercase mb-1">Most Profitable</p>
             <p className="font-bold text-gray-800 text-sm truncate">{advancedStats?.mostProfitable?.name || '-'}</p>
             <p className="text-xs text-green-700 font-bold">₹{advancedStats?.mostProfitable?.profit.toFixed(0) || 0}</p>
           </div>
           <div className="border border-blue-100 bg-blue-50 p-3 rounded-2xl">
             <p className="text-[9px] font-bold text-blue-600 uppercase mb-1">Best Margin</p>
             <p className="font-bold text-gray-800 text-sm truncate">{advancedStats?.bestMargin?.name || '-'}</p>
             <p className="text-xs text-blue-700 font-bold">{advancedStats?.bestMargin?.margin.toFixed(1) || 0}%</p>
           </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
           <div className="border border-red-100 bg-red-50 p-3 rounded-2xl">
             <p className="text-[9px] font-bold text-red-600 uppercase mb-1">Lowest Profit/Loss</p>
             <p className="font-bold text-gray-800 text-sm truncate">{advancedStats?.lowestProfit?.name || '-'}</p>
             <p className="text-xs text-red-700 font-bold">₹{(advancedStats?.lowestProfit?.profit || 0).toFixed(0)}</p>
           </div>
           <div className="border border-orange-100 bg-orange-50 p-3 rounded-2xl">
             <p className="text-[9px] font-bold text-orange-600 uppercase mb-1">Worst Margin</p>
             <p className="font-bold text-gray-800 text-sm truncate">{advancedStats?.worstMargin?.name || '-'}</p>
             <p className="text-xs text-orange-700 font-bold">{(advancedStats?.worstMargin?.margin || 0).toFixed(1)}%</p>
           </div>
        </div>

      </section>

      {/* SECTION 2: LAST 7 DAYS SALES */}
      <section className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-gray-800">{t.last7DaysSales}</h3>
            <p className="text-[10px] font-bold text-green-600 uppercase mt-1">Total: ₹{weeklyTotal}</p>
          </div>
          <ArrowUpRight size={20} className="text-green-600" />
        </div>
        <div className="flex items-end justify-between gap-1 h-32 pt-6">
          {weeklyTrend.map((record, i) => (
            <div key={i} className="flex flex-col items-center flex-1 gap-2 h-full justify-end">
              {record.total > 0 && (
                <span className="text-[8px] font-black text-green-600 mb-1">₹{record.total}</span>
              )}
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(record.total / maxWeekly) * 85}%` }}
                className="w-full bg-green-500 rounded-lg min-h-[4px] shadow-sm shadow-green-100"
              />
              <span className="text-[8px] font-bold text-gray-400 uppercase">{record.day}</span>
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

      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expenses">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!user) return;
          const formData = new FormData(e.currentTarget);
          const data = {
            electricity: Number(formData.get("electricity")) || 0,
            rent: Number(formData.get("rent")) || 0,
            staff: Number(formData.get("staff")) || 0,
            other: Number(formData.get("other")) || 0,
            updated_at: Timestamp.now()
          };
          try {
            await setDoc(doc(db, "shops", user.uid, "expenses", currentMonthId), data);
            setShowExpenseModal(false);
          } catch (err) {
            console.error(err);
            alert("Failed to save expenses");
          }
        }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Electricity Bill</label>
            <input name="electricity" type="number" defaultValue={expenses.electricity} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Rent</label>
            <input name="rent" type="number" defaultValue={expenses.rent} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Staff Salary</label>
            <input name="staff" type="number" defaultValue={expenses.staff} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Other Expenses</label>
            <input name="other" type="number" defaultValue={expenses.other} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>
          <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4">
            Save Expenses
          </button>
        </form>
      </Modal>
    </div>
  );
});
