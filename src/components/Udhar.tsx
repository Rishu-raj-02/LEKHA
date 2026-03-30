import React, { useState, useMemo } from 'react';
import { AlertCircle, ChevronUp, ChevronDown, CheckCircle2, Phone, MessageCircle, Plus, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, collection, addDoc, doc, updateDoc, Timestamp, getDoc } from "../firebase";
import { useApp } from "../context/AppContext";
import { cn, openWhatsApp, ensureDate } from "../utils/helpers";
import { Modal } from "./ui/Modal";
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
  const { shop, lang, bills, customers, udharList, isProUser } = useApp();
  const t = translations[lang];

  const [expandedUdharCustomer, setExpandedUdharCustomer] = useState<string | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedWalkinGroup, setSelectedWalkinGroup] = useState<any | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [selectedExistingCustomerId, setSelectedExistingCustomerId] = useState<string>("");
  const [isSavingConverting, setIsSavingConverting] = useState(false);

  const { savedGroups, walkinGroups } = useMemo(() => {
    const groups: Record<string, { id: string; customerName: string; phone: string; totalAmount: number; entries: Udhar[]; isSaved: boolean }> = {};

    udharList.forEach(u => {
      if (u.status !== "pending") return;

      const phone = u.customer_phone?.replace(/\D/g, "") || "unknown";
      // Normalize to a 10-digit or 12-digit key for consistency
      const phoneKey = phone.length >= 10 ? phone.slice(-10) : phone;
      
      if (!groups[phoneKey]) {
        // Resolve initial name and check if saved
        const sanitizedPhone = phone.length === 10 ? "+91" + phone : (phone.length === 12 ? "+" + phone : phone);
        const existingC = customers.find(c => c.phone.replace(/\D/g, "").slice(-10) === phoneKey);
        
        groups[phoneKey] = {
          id: phoneKey,
          customerName: existingC ? existingC.name : (u.customer_name || "Unknown Customer"),
          phone: existingC ? existingC.phone : (u.customer_phone || "No Phone"),
          totalAmount: 0,
          entries: [],
          isSaved: !!existingC
        };
      }
      
      groups[phoneKey].totalAmount += u.amount;
      groups[phoneKey].entries.push(u);
    });

    const allGroups = Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      savedGroups: allGroups.filter(g => g.isSaved),
      walkinGroups: allGroups.filter(g => !g.isSaved)
    };
  }, [udharList, customers]);

  const handleConvertWalkin = (group: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWalkinGroup(group);
    setSelectedExistingCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone(group.phone === "No Phone" || group.phone === "unknown" ? "" : group.phone);
    setShowAddCustomerModal(true);
  };

  const handleConfirmAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalkinGroup) return;

    const { totalAmount, entries } = selectedWalkinGroup;
    let targetCustomerId = "";
    let finalPhone = "";
    let finalName = "";

    setIsSavingConverting(true);
    try {
      if (selectedExistingCustomerId) {
        // Link to existing customer selected from dropdown
        targetCustomerId = selectedExistingCustomerId;
        const existingC = customers.find(c => c.id === targetCustomerId);
        if (existingC) {
          finalPhone = existingC.phone;
          finalName = existingC.name;
        }
      } else {
        // Handle as manual entry (Existing Logic)
        const phone = newCustomerPhone.replace(/\D/g, "");
        if (!newCustomerName.trim() || phone.length < 10) {
          setToast({ message: "Valid Name and Phone required", type: "error" });
          setIsSavingConverting(false);
          return;
        }

        finalPhone = "+91" + (phone.length === 12 ? phone.slice(2) : phone);
        finalName = newCustomerName;
        
        // Re-check if phone already exists before creating new
        const existing = customers.find(c => c.phone === finalPhone);
        if (existing) {
          targetCustomerId = existing.id;
          finalName = existing.name;
        } else {
          // Add doc
          const res = await addDoc(collection(db, "shops", shop!.id, "customers"), {
            name: finalName,
            phone: finalPhone,
            total_udhar: totalAmount,
            created_at: Timestamp.now()
          });
          targetCustomerId = res.id;
        }
      }

      // Update customer's total_udhar if common linking logic or existing
      const cRef = doc(db, "shops", shop!.id, "customers", targetCustomerId);
      const cSnap = await getDoc(cRef);
      if (cSnap.exists()) {
        const currentUdhar = cSnap.data().total_udhar || 0;
        await updateDoc(cRef, { total_udhar: currentUdhar + totalAmount });
      }

      // Re-map udhar entries
      for (const entry of entries) {
        await updateDoc(doc(db, "shops", shop!.id, "udhar", entry.id), {
          customer_id: targetCustomerId,
          customer_name: finalName,
          customer_phone: finalPhone
        });
      }

      setToast({ message: "Customer added & linked successfully!", type: "success" });
      setShowAddCustomerModal(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setSelectedExistingCustomerId("");
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to link customer", type: "error" });
    } finally {
      setIsSavingConverting(false);
    }
  };

  const renderGroup = (group: any, isWalkin = false) => {
    const isExpanded = expandedUdharCustomer === group.id;
    const isHighAmount = group.totalAmount > 1000;
          
    return (
      <div key={group.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4 transition-all hover:shadow-md">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpandedUdharCustomer(isExpanded ? null : group.id)}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 font-bold text-lg">
              {isWalkin ? <Phone size={20} /> : (group.customerName?.[0] || "C")}
            </div>
            <div>
              <p className="font-bold text-gray-800">{isWalkin ? group.customerName : (group.customerName || "Customer")}</p>
              <p className="text-xs text-gray-400">{group.phone}</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{t.pending}</p>
                <p className={cn("text-xl font-black", isHighAmount ? "text-red-600" : "text-orange-500")}>
                  ₹{group.totalAmount}
                </p>
              </div>
              {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </div>
            {isWalkin && (
              <button 
                onClick={(e) => handleConvertWalkin(group, e)}
                className="flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors mt-2 shadow-sm border border-blue-100"
              >
                <UserPlus size={12} /> Add to Customer
              </button>
            )}
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
                {group.entries.map((entry: Udhar) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                    <div>
                      <div className="flex items-center gap-2">
                         <p className="font-bold text-gray-800">₹{entry.amount}</p>
                         {entry.type === "bill" && <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-black tracking-wider uppercase">Bill</span>}
                         {entry.type === "manual" && <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-black tracking-wider uppercase">Manual</span>}
                      </div>
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
              onClick={(e) => {
                e.stopPropagation();
                if (!group.phone || group.phone === "No Phone" || group.phone === "unknown") {
                  setToast({ message: "Phone number required", type: "error" });
                  return;
                }
                const message = encodeURIComponent(`Namaste 🙏\n\nAapka ₹${group.totalAmount} udhar pending hai.\n\nKripya jaldi payment kar dein.\n\n- ${shop?.shop_name}`);
                const phoneSanitized = group.phone.replace(/\D/g, '');
                window.open(`https://wa.me/${phoneSanitized}?text=${message}`, "_blank");
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
  };

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
      <div className="space-y-6">
        {savedGroups.length > 0 && (
          <div className="space-y-3 relative z-10">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Saved Customers</h3>
            {savedGroups.map(g => renderGroup(g, false))}
          </div>
        )}

        {walkinGroups.length > 0 && (
          <div className="space-y-3 relative z-10">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Walk-in Customers</h3>
            {walkinGroups.map(g => renderGroup(g, true))}
          </div>
        )}

        {(savedGroups.length === 0 && walkinGroups.length === 0) && (
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

      {/* Add to Customer Modal */}
      <Modal 
        isOpen={showAddCustomerModal} 
        onClose={() => setShowAddCustomerModal(false)} 
        title={t.addCustomer}
      >
        <form onSubmit={handleConfirmAddCustomer} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">Select Existing Customer</label>
            <select
              value={selectedExistingCustomerId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedExistingCustomerId(id);
                if (id) {
                  const c = customers.find(cust => cust.id === id);
                  if (c) {
                    setNewCustomerName(c.name);
                    setNewCustomerPhone(c.phone.replace(/\D/g, "").slice(-10));
                  }
                } else {
                  setNewCustomerName("");
                  setNewCustomerPhone(selectedWalkinGroup?.phone === "No Phone" || selectedWalkinGroup?.phone === "unknown" ? "" : selectedWalkinGroup?.phone);
                }
              }}
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold"
            >
              <option value="">-- Choose Customer (Optional) --</option>
              {customers.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 my-2 px-4 text-gray-300">
            <div className="h-[1px] flex-1 bg-gray-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">OR</span>
            <div className="h-[1px] flex-1 bg-gray-100" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">
              {t.name} {selectedExistingCustomerId && "(Autofilled)"}
            </label>
            <input 
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              disabled={!!selectedExistingCustomerId}
              required 
              placeholder="e.g. Rahul Kumar" 
              className={cn(
                "w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold transition-all",
                selectedExistingCustomerId && "opacity-50 grayscale cursor-not-allowed"
              )} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">
              {t.phone} {selectedExistingCustomerId && "(Autofilled)"}
            </label>
            <input 
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              disabled={!!selectedExistingCustomerId}
              name="phone" 
              type="tel" 
              required 
              placeholder="e.g. 9876543210" 
              className={cn(
                "w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold transition-all",
                selectedExistingCustomerId && "opacity-50 grayscale cursor-not-allowed"
              )} 
            />
          </div>
          <button 
            disabled={isSavingConverting} 
            type="submit" 
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 active:scale-95 transition-all mt-4"
          >
            {isSavingConverting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <UserPlus size={20} />
                <span>{selectedExistingCustomerId ? "Link to Customer" : t.save}</span>
              </>
            )}
          </button>
          <button 
            type="button" 
            onClick={() => setShowAddCustomerModal(false)}
            className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl active:scale-95 transition-all"
          >
            {t.cancel}
          </button>
        </form>
      </Modal>
    </div>
  );
});
