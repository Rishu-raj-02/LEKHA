import React from 'react';
import {
  TrendingUp,
  AlertCircle,
  Users,
  IndianRupee,
  History,
  MessageCircle,
  CheckCircle2
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn, openWhatsApp, ensureDate } from "../utils/helpers";
import { Udhar } from "../types";
import { translations } from "../translations";
import { motion } from "motion/react";

interface HomeProps {
  setActiveTab: (tab: string) => void;
  setShowAddCustomer: (v: boolean) => void;
  setShowAddUdhar: (v: boolean) => void;
  handleMarkPaid: (udhar: Udhar) => Promise<void>;
  isMarkingPaidId: string | null;
  setShowPricing: (v: boolean) => void;
}

export const Home = React.memo(({ setActiveTab, setShowAddCustomer, setShowAddUdhar, handleMarkPaid, isMarkingPaidId, setShowPricing }: HomeProps) => {
  const { shop, lang, bills, customers, udharList, checkWhatsAppLimit, isProUser } = useApp();
  const t = translations[lang];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayBills = bills.filter(b => ensureDate(b.created_at) >= today);
  const todaySales = todayBills.reduce((acc, b) => acc + (b.totalAmount || (b as any).total_amount || 0), 0);
  const totalUdhar = udharList.filter(u => u.status === "pending").reduce((acc, u) => acc + u.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-600 p-4 rounded-3xl text-white shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <TrendingUp size={20} className="opacity-80" />
          </div>
          <p className="text-xs opacity-80 font-medium">{t.todaySales}</p>
          <h3 className="text-2xl font-bold">₹{todaySales}</h3>
        </div>
        <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <AlertCircle size={20} className="opacity-80" />
          </div>
          <p className="text-xs opacity-80 font-medium">{t.pendingUdhar}</p>
          <h3 className="text-2xl font-bold">₹{totalUdhar}</h3>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm col-span-2 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">{t.totalCustomers}</p>
            <h3 className="text-2xl font-bold text-gray-800">{customers.length}</h3>
          </div>
          <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
            <Users size={24} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{t.quickActions}</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "customer", icon: Users, label: t.addCustomer, color: "bg-green-50 text-green-600", action: () => setShowAddCustomer(true) },
            { id: "bill", icon: IndianRupee, label: t.createBill, color: "bg-blue-50 text-blue-600", action: () => setActiveTab("billing") },
            { id: "udhar", icon: History, label: t.addUdhar, color: "bg-orange-50 text-orange-600", action: () => setShowAddUdhar(true) },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={btn.action}
              className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-all"
            >
              <div className={cn("p-3 rounded-2xl", btn.color)}>
                <btn.icon size={24} />
              </div>
              <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t.todayWork}</h3>
        </div>
        <div className="space-y-3">
          {udharList.slice(0, 5).map((udhar) => {
            const customer = customers.find(c => c.id === udhar.customer_id);
            return (
              <div key={udhar.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 font-bold">
                    {customer?.name?.[0] || "C"}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{customer?.name || "Customer"}</p>
                    <p className="text-xs text-orange-600 font-bold">₹{udhar.amount} Pending</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(!isProUser && (shop?.whatsappCount || 0) >= 10 && (shop?.lastWhatsappDate === new Date().toDateString())) ? (
                    <button
                      onClick={() => setShowPricing(true)}
                      className="px-3 py-1.5 bg-white text-orange-600 border border-orange-200 rounded-full text-[9px] font-black uppercase whitespace-nowrap shadow-sm"
                    >
                      👑 Upgrade to unlock more messages
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const canSend = await checkWhatsAppLimit();
                        if (!canSend) {
                          setShowPricing(true);
                          return;
                        }
                        const message = `Hello ${customer?.name},\nYour ₹${udhar.amount} is pending. Please complete your payment.\n\n* ${shop?.shop_name}`;
                        openWhatsApp(customer?.phone || "", message);
                      }}
                      className="p-2 bg-green-50 text-green-600 rounded-full"
                    >
                      <MessageCircle size={20} />
                    </button>
                  )}
                  <button 
                    disabled={isMarkingPaidId === udhar.id}
                    onClick={() => handleMarkPaid(udhar)} 
                    className="p-2 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center min-w-[36px]"
                  >
                    {isMarkingPaidId === udhar.id ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" /> : <CheckCircle2 size={20} />}
                  </button>
                </div>
              </div>
            );
          })}
          {udharList.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <CheckCircle2 size={48} className="mx-auto mb-2 opacity-20" />
              {t.noData}
            </div>
          )}
        </div>
      </div>

    </div>
  );
});
