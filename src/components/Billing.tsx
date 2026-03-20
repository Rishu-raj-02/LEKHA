import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, MessageCircle, X, CheckCircle2, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";
import { cn, formatPhone } from "../utils/helpers";
import { HighlightedText } from "./ui/HighlightedText";
import { translations } from "../translations";
import { useDebounce } from '../hooks/useDebounce';

interface BillingProps {
  setShowAddCustomer: (v: boolean) => void;
  setShowAddProduct: (v: boolean) => void;
  handleCreateBill: (
    customerId: string, 
    items: { name: string; price: number; quantity: number }[],
    billStatus: "paid" | "pending",
    billLang: "en" | "hi"
  ) => Promise<void>;
  isSavingBill: boolean;
}

export const Billing = React.memo(({ setShowAddCustomer, setShowAddProduct, handleCreateBill, isSavingBill }: BillingProps) => {
  const { customers, products, shop, lang } = useApp();
  const t = translations[lang];

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [billItems, setBillItems] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", price: "", quantity: "1" });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  const [billLang, setBillLang] = useState<"en" | "hi">("hi");
  const [billStatus, setBillStatus] = useState<"paid" | "pending">("pending");

  const total = useMemo(() => billItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [billItems]);
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => 
      (c.name?.toLowerCase() || "").includes(debouncedCustomerSearch.toLowerCase()) || 
      (c.phone || "").includes(debouncedCustomerSearch)
    );
  }, [customers, debouncedCustomerSearch]);

  const handleSaveBill = async () => {
    await handleCreateBill(selectedCustomer, billItems, billStatus, billLang);
    setShowBillPreview(false);
    setBillItems([]);
    setSelectedCustomer("");
    setManualItem({ name: "", price: "", quantity: "1" });
  };

  if (!shop) return null;

  return (
    <div className="space-y-6 pb-32">
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t.selectCustomer}</h3>
          <button 
            onClick={() => setShowAddCustomer(true)}
            className="text-xs font-bold text-green-600 flex items-center gap-1"
          >
            <Plus size={14} /> {t.addNewCustomer}
          </button>
        </div>

        <div className="flex items-center justify-between p-2 bg-gray-50 rounded-2xl">
          <span className="text-xs font-bold text-gray-500 px-2">{t.sendBillIn}</span>
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
            <button 
              onClick={() => setBillLang("hi")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billLang === "hi" ? "bg-green-600 text-white" : "text-gray-400"
              )}
            >
              हिंदी
            </button>
            <button 
              onClick={() => setBillLang("en")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billLang === "en" ? "bg-green-600 text-white" : "text-gray-400"
              )}
            >
              English
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 bg-gray-50 rounded-2xl">
          <span className="text-xs font-bold text-gray-500 px-2">{t.paymentStatus}</span>
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
            <button 
              onClick={() => setBillStatus("pending")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billStatus === "pending" ? "bg-red-600 text-white" : "text-gray-400"
              )}
            >
              {t.pending}
            </button>
            <button 
              onClick={() => setBillStatus("paid")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billStatus === "paid" ? "bg-green-600 text-white" : "text-gray-400"
              )}
            >
              {t.paid}
            </button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 border-none outline-none text-sm" 
            placeholder={t.search} 
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {filteredCustomers.slice(0, 10).map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCustomer(c.id);
                setCustomerSearch("");
              }}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border",
                selectedCustomer === c.id 
                  ? "bg-green-600 text-white border-green-600" 
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-600"
              )}
            >
              <HighlightedText text={c.name} highlight={debouncedCustomerSearch} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t.addItem}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {products.slice(0, 4).map(p => (
            <button
              key={p.id}
              onClick={() => {
                const existing = billItems.find(i => i.id === p.id);
                if (existing) {
                  setBillItems(billItems.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
                } else {
                  setBillItems([...billItems, { id: p.id, name: p.name, price: p.price, quantity: 1 }]);
                }
              }}
              className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left hover:bg-green-50 transition-all flex flex-col justify-between"
            >
              <p className="font-bold text-gray-800 text-xs truncate">{p.name}</p>
              <p className="text-green-600 font-black text-sm">₹{p.price}</p>
            </button>
          ))}
          <button 
            onClick={() => setShowAddProduct(true)}
            className="bg-gray-50 p-3 rounded-2xl border border-dashed border-gray-300 text-gray-400 flex flex-col items-center justify-center gap-1 hover:bg-green-50 hover:text-green-600 hover:border-green-300 transition-all"
          >
            <Plus size={20} />
            <span className="text-[10px] font-bold">{t.addItem}</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase">{t.manualEntry}</p>
          <div className="grid grid-cols-3 gap-2">
            <input 
              placeholder={t.name}
              value={manualItem.name}
              onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
              className="col-span-2 p-2 bg-gray-50 rounded-xl text-xs outline-none"
            />
            <input 
              placeholder={t.price}
              type="number"
              value={manualItem.price}
              onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
              className="p-2 bg-gray-50 rounded-xl text-xs outline-none"
            />
          </div>
          <button 
            onClick={() => {
              if (manualItem.name && manualItem.price) {
                setBillItems([...billItems, { 
                  id: `manual-${Date.now()}`, 
                  name: manualItem.name, 
                  price: Number(manualItem.price), 
                  quantity: Number(manualItem.quantity) || 1 
                }]);
                setManualItem({ name: "", price: "", quantity: "1" });
              }
            }}
            className="w-full py-2 bg-gray-800 text-white rounded-xl text-xs font-bold"
          >
            {t.addItem}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t.itemDetails}</h3>
        {billItems.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
            <Receipt size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs">{t.noItems}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {billItems.map((item) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={item.id} 
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setBillItems(billItems.map(i => i.id === item.id ? { ...i, quantity: val } : i));
                      }}
                      className="w-12 p-1 bg-gray-50 rounded-lg text-xs font-bold text-center outline-none"
                    />
                    <span className="text-xs text-gray-400">x ₹{item.price}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-black text-gray-800">₹{item.price * item.quantity}</p>
                  <button 
                    onClick={() => setBillItems(billItems.filter(i => i.id !== item.id))}
                    className="text-red-400 p-1 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4 py-4 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t.total}</p>
            <p className="text-2xl font-black text-green-600">₹{total}</p>
          </div>
          <button
            disabled={!selectedCustomer || billItems.length === 0 || isSavingBill}
            onClick={() => setShowBillPreview(true)}
            className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSavingBill ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <MessageCircle size={20} />
                {t.sendOnWhatsApp}
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showBillPreview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-6 shadow-2xl overflow-y-auto max-h-[90vh] pb-32"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{t.billPreview}</h3>
                <button onClick={() => setShowBillPreview(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 space-y-4 mb-6">
                <div className="text-center border-b border-gray-200 pb-4">
                  <h4 className="font-black text-xl text-gray-800 uppercase">{shop.shop_name}</h4>
                  <p className="text-xs text-gray-500">{formatPhone(shop.phone)}</p>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{t.customers}:</span>
                  <span className="font-bold text-gray-800">{selectedCustomerData?.name}</span>
                </div>

                <div className="space-y-2 py-4 border-y border-dashed border-gray-200">
                  {billItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.name} x{item.quantity}</span>
                      <span className="font-bold text-gray-800">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{t.paymentStatus}</p>
                    <span className={cn(
                      "inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase",
                      billStatus === "paid" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {billStatus === "paid" ? t.paid : t.pending}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{t.total}</p>
                    <p className="text-2xl font-black text-green-600">₹{total}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveBill}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                disabled={isSavingBill}
              >
                {isSavingBill ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    {t.saveBill} & {t.sendOnWhatsApp}
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
