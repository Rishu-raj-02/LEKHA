import React, { useMemo, useState } from 'react';
import {
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  ShoppingBag,
  Users,
  Crown,
  Lock,
  BarChart3,
  CalendarDays,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";
import { translations } from "../translations";
import { ensureDate } from "../utils/helpers";
import { Timestamp, updateDoc, doc, db } from "../firebase";
import { Modal } from "./ui/Modal";

// ─── Helpers ───
const getAmount = (b: any): number => b.totalAmount || b.total_amount || 0;
const getProfit = (b: any): number => {
  if (b.total_profit != null) return b.total_profit;
  return (b.items || []).reduce((acc: number, item: any) => {
    return acc + ((item.price - (item.cost_price || 0)) * (item.quantity || 1));
  }, 0);
};
const getCost = (b: any): number => {
  if (b.total_cost != null) return b.total_cost;
  return (b.items || []).reduce((acc: number, item: any) => {
    return acc + ((item.cost_price || 0) * (item.quantity || 1));
  }, 0);
};

const fmt = (n: number): string => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};
const fmtFull = (n: number | undefined | null): string => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const Insights = React.memo(() => {
  const { bills, udharList, customers, products, lang, isProUser, user, shop, setShop, updateMonthlyExpenses } = useApp();
  const t = translations[lang];

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // ─── Time References ───
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

  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }, []);

  // ─── Expenses Logic ───
  const currentExpenses = useMemo(() => {
    return shop?.monthlyExpenses?.[currentMonthKey] || { electricity: 0, rent: 0, staff: 0, other: 0 };
  }, [shop, currentMonthKey]);

  const totalMonthlyExpenses = useMemo(() => {
    return (currentExpenses.electricity || 0) + (currentExpenses.rent || 0) + (currentExpenses.staff || 0) + (currentExpenses.other || 0);
  }, [currentExpenses]);

  // ─── CORE METRICS ───
  const todaysSales = useMemo(() => {
    return bills
      .filter(b => ensureDate(b.created_at) >= today)
      .reduce((acc, b) => acc + getAmount(b), 0);
  }, [bills, today]);

  const yesterdaysSales = useMemo(() => {
    return bills
      .filter(b => {
        const d = ensureDate(b.created_at);
        return d >= yesterday && d < today;
      })
      .reduce((acc, b) => acc + getAmount(b), 0);
  }, [bills, yesterday, today]);

  const todaysGrossProfit = useMemo(() => {
    return bills
      .filter(b => ensureDate(b.created_at) >= today)
      .reduce((acc, b) => acc + getProfit(b), 0);
  }, [bills, today]);

  const totalSales = useMemo(() => {
    return bills.reduce((acc, b) => acc + getAmount(b), 0);
  }, [bills]);

  const totalGrossProfit = useMemo(() => {
    return bills.reduce((acc, b) => acc + getProfit(b), 0);
  }, [bills]);

  const pendingUdhar = useMemo(() => {
    return udharList
      .filter(u => u.status === 'pending')
      .reduce((acc, u) => acc + u.amount, 0);
  }, [udharList]);

  // ─── SMART INSIGHTS ───
  const avgBillValue = useMemo(() => {
    return bills.length > 0 ? totalSales / bills.length : 0;
  }, [totalSales, bills]);

  const growthRate = useMemo(() => {
    if (yesterdaysSales === 0) return todaysSales > 0 ? 100 : 0;
    return ((todaysSales - yesterdaysSales) / yesterdaysSales) * 100;
  }, [todaysSales, yesterdaysSales]);

  const udharRatio = useMemo(() => {
    return totalSales > 0 ? (pendingUdhar / totalSales) * 100 : 0;
  }, [pendingUdhar, totalSales]);

  const itemInsights = useMemo(() => {
    const stats: Record<string, { name: string; qty: number; revenue: number; profit: number; cost: number }> = {};
    bills.forEach(b => {
      (b.items || []).forEach((item: any) => {
        const name = item.product_name || item.name || 'Unknown';
        if (!stats[name]) stats[name] = { name, qty: 0, revenue: 0, profit: 0, cost: 0 };
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const cost = item.cost_price || 0;
        stats[name].qty += qty;
        stats[name].revenue += price * qty;
        stats[name].profit += (price - cost) * qty;
        stats[name].cost += cost * qty;
      });
    });

    const itemsArray = Object.values(stats);
    if (itemsArray.length === 0) return null;

    const mostProfitable = [...itemsArray].sort((a, b) => b.profit - a.profit)[0];
    const highestMargin = [...itemsArray].sort((a, b) => {
      const marginA = a.qty > 0 ? (a.profit / a.qty) : 0;
      const marginB = b.qty > 0 ? (b.profit / b.qty) : 0;
      return marginB - marginA;
    })[0];
    const mostSold = [...itemsArray].sort((a, b) => b.qty - a.qty)[0];
    const lossMaking = itemsArray.filter(i => (i.profit / (i.qty || 1)) < 0);

    return { mostProfitable, highestMargin, mostSold, lossMaking };
  }, [bills]);

  // ─── Graphs Data ───
  const dailySalesData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    return days.map(date => {
      const dayTotal = bills.filter(b => {
        const bd = ensureDate(b.created_at);
        return bd.getFullYear() === date.getFullYear() &&
               bd.getMonth() === date.getMonth() &&
               bd.getDate() === date.getDate();
      }).reduce((acc, b) => acc + getAmount(b), 0);

      const dayName = date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' });
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();
      return { day: dayName, total: dayTotal, isToday };
    });
  }, [bills, today, lang]);

  const maxDaily = Math.max(...dailySalesData.map(d => d.total), 1);

  // ─── Handlers ───
  const handleSaveExpenses = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isProUser) return;
    setIsSavingExpense(true);
    const formData = new FormData(e.currentTarget);
    const expenses = {
      electricity: Number(formData.get('electricity') || 0),
      rent: Number(formData.get('rent') || 0),
      staff: Number(formData.get('staff') || 0),
      other: Number(formData.get('other') || 0),
    };

    try {
      await updateMonthlyExpenses(currentMonthKey, expenses);
      setShowExpenseModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingExpense(false);
    }
  };

  // ─── PRO GATE ───
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
          <p className="text-gray-500 mb-8 font-medium text-sm leading-relaxed">Unlock advanced analytics, expenses tracking, and smart insights by upgrading to Pro.</p>
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
    <div className="space-y-4 pb-24">
      {/* ═══════ HERO CARD: TODAY'S SALES ═══════ */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-green-600 to-green-700 p-6 rounded-[2rem] text-white shadow-xl shadow-green-200/50 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <IndianRupee size={16} />
            </div>
            <p className="text-xs font-bold uppercase opacity-80 tracking-wider">{t.todaySalesTitle}</p>
          </div>
          <h2 className="text-4xl font-black mt-2 tracking-tight">{fmtFull(todaysSales)}</h2>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/20">
            <div>
              <p className="text-[10px] uppercase opacity-70 font-bold">{t.grossProfit}</p>
              <p className="text-lg font-black">{fmtFull(todaysGrossProfit)}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-[10px] uppercase opacity-70 font-bold">{t.todayLabel} Bills</p>
              <p className="text-lg font-black">{bills.filter(b => ensureDate(b.created_at) >= today).length}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══════ PROFIT BREAKDOWN CARD (GROSS vs NET) ═══════ */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={14} className="text-green-500" />
            </div>
            <h3 className="text-xs font-bold text-gray-700">{t.totalProfitAllTime}</h3>
          </div>
          <button 
            onClick={() => setShowExpenseModal(true)}
            className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 shadow-sm active:scale-95 transition-all"
          >
            <Plus size={12} /> {t.addExpenses}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{t.grossProfit}</p>
            <p className="text-xl font-black text-gray-800">{fmtFull(totalGrossProfit)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{t.netProfit}</p>
            <p className="text-xl font-black text-green-600">{fmtFull(totalGrossProfit - totalMonthlyExpenses)}</p>
          </div>
        </div>

        {totalMonthlyExpenses > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Expenses this month</p>
            <p className="text-[10px] font-black text-red-500">-{fmtFull(totalMonthlyExpenses)}</p>
          </div>
        )}
      </motion.section>

      {/* ═══════ QUICK INSIGHTS GRID (SMART FIELDS) ═══════ */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${growthRate >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {growthRate >= 0 ? <ArrowUpRight size={12} className="text-green-500" /> : <ArrowDownRight size={12} className="text-red-500" />}
            </div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase">{t.growthToday}</h3>
          </div>
          <p className={`text-lg font-black ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
          </p>
          <p className="text-[8px] text-gray-300 font-bold uppercase">{growthRate >= 0 ? t.growthUp : t.growthDown}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingBag size={12} className="text-blue-500" />
            </div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase">{t.avgBillValue}</h3>
          </div>
          <p className="text-lg font-black text-gray-800">{fmtFull(avgBillValue)}</p>
          <p className="text-[8px] text-gray-300 font-bold uppercase">{bills.length} bills total</p>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.25 }}
           className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-6 h-6 bg-purple-50 rounded-lg flex items-center justify-center">
              <Percent size={12} className="text-purple-500" />
            </div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase">{t.udharRatio}</h3>
          </div>
          <p className="text-lg font-black text-gray-800">{udharRatio.toFixed(1)}%</p>
          <p className="text-[8px] text-gray-300 font-bold uppercase">{fmt(pendingUdhar)} {t.pendingLabel}</p>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-6 h-6 bg-orange-50 rounded-lg flex items-center justify-center">
              <Wallet size={12} className="text-orange-500" />
            </div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase">{t.pendingUdharTitle}</h3>
          </div>
          <p className="text-lg font-black text-red-600">{fmt(pendingUdhar)}</p>
          <p className="text-[8px] text-gray-300 font-bold uppercase">{udharList.filter(u => u.status === 'pending').length} entries</p>
        </motion.div>
      </div>

      {/* ═══════ SMART PRODUCT INSIGHTS ═══════ */}
      {itemInsights && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <ShoppingBag size={14} className="text-orange-500" />
            </div>
            <h3 className="text-xs font-bold text-gray-700">Business Highlights</h3>
          </div>

          <div className="space-y-4">
            {itemInsights.mostProfitable && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{t.mostProfitableItem}</p>
                  <p className="text-xs font-black text-gray-800">{itemInsights.mostProfitable.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-green-600">+{fmtFull(itemInsights.mostProfitable.profit)}</p>
                </div>
              </div>
            )}

            {itemInsights.highestMargin && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{t.highestMarginItem}</p>
                  <p className="text-xs font-black text-gray-800">{itemInsights.highestMargin.name}</p>
                </div>
                <div className="text-right text-[10px] font-bold text-gray-500">
                  {t.profitMargin}: {fmtFull(itemInsights.highestMargin.profit / itemInsights.highestMargin.qty)}
                </div>
              </div>
            )}

            {itemInsights.mostSold && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{t.mostSoldItem}</p>
                  <p className="text-xs font-black text-gray-800">{itemInsights.mostSold.name}</p>
                </div>
                <div className="text-right text-[10px] font-bold text-gray-500">
                  {itemInsights.mostSold.qty} {t.soldCount}
                </div>
              </div>
            )}

            {itemInsights.lossMaking.length > 0 && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-red-700">{t.lossMakingItem}</p>
                  <p className="text-[9px] font-bold text-red-500">{itemInsights.lossMaking.map(i => i.name).join(', ')}</p>
                </div>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* ═══════ GRAPH 1: DAILY SALES (LAST 7 DAYS) ═══════ */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <BarChart3 size={14} className="text-blue-500" />
            </div>
            <h3 className="text-xs font-bold text-gray-700">{t.dailySalesGraph}</h3>
          </div>
          <p className="text-[10px] font-black text-green-600">{fmtFull(dailySalesData.reduce((a, d) => a + d.total, 0))}</p>
        </div>
        <div className="flex items-end justify-between gap-1 h-28">
          {dailySalesData.map((d, i) => (
            <div key={i} className="flex flex-col items-center flex-1 gap-1.5 h-full justify-end">
              {d.total > 0 && (
                <span className="text-[7px] font-black text-green-600">{fmt(d.total)}</span>
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (d.total / maxDaily) * 85)}%` }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className={`w-full rounded-lg min-h-[4px] ${
                  d.isToday
                    ? 'bg-gradient-to-t from-green-600 to-green-400 shadow-sm shadow-green-200'
                    : 'bg-gray-200'
                }`}
              />
              <span className={`text-[8px] font-bold uppercase ${d.isToday ? 'text-green-600' : 'text-gray-400'}`}>
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ═══════ EXPENSE MODAL ═══════ */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title={t.addExpenses}>
        <form onSubmit={handleSaveExpenses} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.electricity}</label>
              <input 
                name="electricity" 
                type="number" 
                defaultValue={currentExpenses.electricity || ''} 
                placeholder="₹0" 
                className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.rent}</label>
              <input 
                name="rent" 
                type="number" 
                defaultValue={currentExpenses.rent || ''} 
                placeholder="₹0" 
                className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.staff}</label>
              <input 
                name="staff" 
                type="number" 
                defaultValue={currentExpenses.staff || ''} 
                placeholder="₹0" 
                className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.other}</label>
              <input 
                name="other" 
                type="number" 
                defaultValue={currentExpenses.other || ''} 
                placeholder="₹0" 
                className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" 
              />
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-2xl flex justify-between items-center border border-green-100">
             <span className="text-xs font-black text-green-700">Total Monthly Expenses</span>
             <span className="text-lg font-black text-green-700">{fmtFull(totalMonthlyExpenses)}</span>
          </div>

          <button 
            disabled={isSavingExpense} 
            type="submit" 
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
          >
            {isSavingExpense ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : t.save}
          </button>
        </form>
      </Modal>
    </div>
  );
});
