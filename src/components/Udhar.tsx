import React, { useState, useMemo } from 'react';
import { AlertCircle, ChevronUp, ChevronDown, CheckCircle2, Phone, MessageCircle, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";
import { cn, openWhatsApp, ensureDate } from "../utils/helpers";
import { Udhar } from "../types";
import { translations } from "../translations";

interface UdharProps {
  setShowAddUdhar: (v: boolean) => void;
  handleMarkPaid: (udhar: Udhar) => Promise<void>;
  setToast: (toast: { message: string; type: "success" | "error" }) => void;
  isMarkingPaidId: string | null;
  setShowPricing: (v: boolean) => void;
}

export const UdharTab = React.memo(({ setShowAddUdhar, handleMarkPaid, setToast, isMarkingPaidId, setShowPricing }: UdharProps) => {
  const { shop, lang, bills, customers, udharList, checkWhatsAppLimit, isProUser } = useApp();
  const t = translations[lang];

  const [expandedUdharCustomer, setExpandedUdharCustomer] = useState<string | null>(null);

  const groupedUdhar = useMemo(() => {
    const groups: Record<string, {
      customerId: string;
      customerName: string;
      phone: string;
      totalAmount: number;
      entries: Udhar[];
    }> = {};

    udharList.forEach(u => {
      const customer = customers.find(c => c.id === u.customer_id);
      if (!customer) return;

      if (!groups[customer.id]) {
        groups[customer.id] = {
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          totalAmount: 0,
          entries: []
        };
      }
      groups[customer.id].totalAmount += u.amount;
      groups[customer.id].entries.push(u);
    });

    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [udharList, customers]);

  if (!shop) return null;

  return (
    <div className="space-y-4 relative pb-20">
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-center gap-3 text-orange-700">
        <AlertCircle size={24} />
        <div>
          <p className="font-bold text-sm">Attention</p>
          <p className="text-xs">Follow up with customers for pending payments.</p>
        </div>
      </div>
      <div className="space-y-3">
        {groupedUdhar.map((group) => {
          const isExpanded = expandedUdharCustomer === group.customerId;
          const isHighAmount = group.totalAmount > 1000;
          
          return (
            <div key={group.customerId} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4 transition-all hover:shadow-md">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedUdharCustomer(isExpanded ? null : group.customerId)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 font-bold text-lg">
                    {group.customerName?.[0] || "C"}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{group.customerName || "Customer"}</p>
                    <p className="text-xs text-gray-400">{group.phone}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{t.pending}</p>
                    <p className={cn("text-xl font-black", isHighAmount ? "text-red-600" : "text-orange-500")}>
                      ₹{group.totalAmount}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </div>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-2 border-t border-gray-50">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">Individual Entries</p>
                      {group.entries.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                          <div>
                            <p className="font-bold text-gray-800">₹{entry.amount}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-gray-400">{ensureDate(entry.created_at).toLocaleDateString()}</p>
                              {entry.due_date && (
                                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">
                                  {t.dueDate}: {new Date(entry.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            disabled={isMarkingPaidId === entry.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkPaid(entry);
                            }}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors min-w-[70px]"
                          >
                            {isMarkingPaidId === entry.id ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full" /> : (
                              <>
                                <CheckCircle2 size={16} />
                                <span className="text-[10px] font-bold uppercase">{t.paid}</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`tel:${group.phone}`);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-2 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors"
                >
                  <Phone size={20} />
                  <span className="text-[10px] font-bold uppercase">{t.call}</span>
                </button>
                {(!isProUser && (shop?.whatsappCount || 0) >= 10 && (shop?.lastWhatsappDate === new Date().toDateString())) ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPricing(true);
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 bg-white text-orange-600 border border-orange-200 rounded-2xl shadow-sm"
                  >
                    <span className="text-[8px] font-black uppercase text-center px-1">👑 Upgrade to unlock more messages</span>
                  </button>
                ) : (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const canSend = await checkWhatsAppLimit();
                      if (!canSend) {
                        setShowPricing(true);
                        return;
                      }
                      const message = `Hello ${group.customerName},\n\nYou have a total pending payment of Rs ${group.totalAmount} at ${shop?.shop_name}.\n\nPlease complete your payment at the earliest.\n\nThank you,\n${shop?.shop_name}`;
                      openWhatsApp(group.phone || "", message);
                      setToast({ message: t.reminderSent, type: "success" });
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors"
                  >
                    <MessageCircle size={20} />
                    <span className="text-[10px] font-bold uppercase">WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {groupedUdhar.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
            <CheckCircle2 size={48} className="mx-auto mb-3 opacity-10" />
            <p className="text-gray-400 text-sm font-medium">{t.noData}</p>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowAddUdhar(true)}
        className="fixed bottom-20 right-4 bg-green-600 text-white p-4 rounded-2xl shadow-xl hover:bg-green-700 transition-colors flex items-center gap-2 z-40"
      >
        <Plus size={24} />
        <span className="font-bold">{t.addUdhar}</span>
      </button>
    </div>
  );
});
