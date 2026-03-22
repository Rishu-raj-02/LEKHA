import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, MessageCircle, X, CheckCircle2, Receipt, ShoppingBag, User, CreditCard, Globe } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";
import { cn, formatPhone } from "../utils/helpers";
import { HighlightedText } from "./ui/HighlightedText";
import { translations } from "../translations";
import { useDebounce } from '../hooks/useDebounce';
import { BillTemplate } from './BillTemplate';

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
  const { customers, products, shop, lang, isProUser } = useApp();
  const t = translations[lang];

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [billItems, setBillItems] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", price: "", quantity: "1" });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  const [billLang, setBillLang] = useState<"en" | "hi">("hi");
  const [billStatus, setBillStatus] = useState<"paid" | "pending">("paid");

  const [askPriceFor, setAskPriceFor] = useState<any>(null);
  const [variablePrice, setVariablePrice] = useState("");
  const [changePriceFor, setChangePriceFor] = useState<string | null>(null);
  const [newPriceInput, setNewPriceInput] = useState("");
  
  const [showWhatsAppPhonePrompt, setShowWhatsAppPhonePrompt] = useState(false);
  const [tempWhatsAppPhone, setTempWhatsAppPhone] = useState("");

  const billTemplateRef = React.useRef<HTMLDivElement>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);

  // Track previous lengths for auto-add
  const prevProductsLen = React.useRef(products.length);
  const prevCustomersLen = React.useRef(customers.length);
  const [waitingForNewCustomer, setWaitingForNewCustomer] = useState(false);

  useEffect(() => {
    if (localToast) {
      const timer = setTimeout(() => setLocalToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [localToast]);

  // Auto-add newly created product to bill
  useEffect(() => {
    if (products.length > prevProductsLen.current) {
      const newProduct = products[products.length - 1];
      if (newProduct && !billItems.find(i => i.id === newProduct.id)) {
        setBillItems(prev => [...prev, { id: newProduct.id, name: newProduct.name, price: newProduct.price, quantity: 1 }]);
      }
    }
    prevProductsLen.current = products.length;
  }, [products]);

  // Auto-select newly created customer
  useEffect(() => {
    if (waitingForNewCustomer && customers.length > prevCustomersLen.current) {
      const newCustomer = customers[customers.length - 1];
      if (newCustomer) {
        setSelectedCustomer(newCustomer.id);
        setCustomerSearch("");
      }
      setWaitingForNewCustomer(false);
    }
    prevCustomersLen.current = customers.length;
  }, [customers, waitingForNewCustomer]);

  const total = useMemo(() => billItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [billItems]);
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => 
      (c.name?.toLowerCase() || "").includes(debouncedCustomerSearch.toLowerCase()) || 
      (c.phone || "").includes(debouncedCustomerSearch)
    );
  }, [customers, debouncedCustomerSearch]);

  // Get quantity of an item in the bill
  const getItemQty = useCallback((productId: string) => {
    const item = billItems.find(i => i.id === productId);
    return item?.quantity || 0;
  }, [billItems]);

  // Increment item
  const incrementItem = useCallback((product: any) => {
    if (isProUser && product.sellingType === "variable") {
      // Check if already in bill (price already set)
      const existing = billItems.find(i => i.id === product.id || i.id.startsWith(product.id + '-'));
      if (existing) {
        // Already has a price set, just increment
        setBillItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
      } else {
        // First time - ask for price
        setAskPriceFor(product);
        setVariablePrice(product.lastUsedPrice ? product.lastUsedPrice.toString() : product.price.toString());
      }
      return;
    }
    const existing = billItems.find(i => i.id === product.id);
    if (existing) {
      setBillItems(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setBillItems(prev => [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }]);
    }
  }, [billItems, isProUser]);

  // Decrement item (supports both exact id and variable-price id)
  const decrementItem = useCallback((itemBillId: string) => {
    const existing = billItems.find(i => i.id === itemBillId);
    if (!existing) return;
    if (existing.quantity <= 1) {
      setBillItems(prev => prev.filter(i => i.id !== itemBillId));
    } else {
      setBillItems(prev => prev.map(i => i.id === itemBillId ? { ...i, quantity: i.quantity - 1 } : i));
    }
  }, [billItems]);

  const handleSaveBill = async () => {
    await handleCreateBill(selectedCustomer, billItems, billStatus, billLang);
    setShowBillPreview(false);
    setBillItems([]);
    setSelectedCustomer("");
    setManualItem({ name: "", price: "", quantity: "1" });
  };

  if (!shop) return null;

  return (
    <div className="space-y-4 pb-52">

      {/* ═══════ SECTION 1: ITEMS (TOP PRIORITY) ═══════ */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 pb-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
            <ShoppingBag size={13} className="text-green-500" /> {t.addItem || "Select Items"}
          </h3>
          <button 
            onClick={() => setShowAddProduct(true)}
            className="text-[10px] font-bold text-green-600 flex items-center gap-0.5 bg-green-50 px-2.5 py-1 rounded-full"
          >
            <Plus size={12} /> Add New Item
          </button>
        </div>

        {/* Item Rows */}
        <div className="divide-y divide-gray-50">
          {products.map(p => {
            const isVariable = isProUser && p.sellingType === "variable";
            // For variable items, find the bill entry (may have id like "productId-price")
            const billEntry = billItems.find(i => i.id === p.id || i.id.startsWith(p.id + '-'));
            const qty = billEntry?.quantity || 0;
            const isSelected = qty > 0;
            const displayPrice = billEntry?.price || p.price;
            const billEntryId = billEntry?.id || p.id;
            return (
              <div 
                key={p.id} 
                className={cn(
                  "flex items-center justify-between px-4 py-3 transition-colors",
                  isSelected ? "bg-green-50/60" : "bg-white"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("font-bold text-sm truncate", isSelected ? "text-green-700" : "text-gray-800")}>{p.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isVariable ? (
                      <>
                        {isSelected ? (
                          <>
                            <span className="text-xs text-green-600 font-bold">₹{displayPrice}</span>
                            <button 
                              onClick={() => { setChangePriceFor(billEntryId); setNewPriceInput(displayPrice.toString()); }}
                              className="text-[8px] bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full uppercase"
                            >
                              Change Price
                            </button>
                            <span className="text-[10px] font-bold text-green-600">= ₹{displayPrice * qty}</span>
                          </>
                        ) : (
                          <span className="text-[8px] bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full uppercase">Variable Price</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400 font-medium">₹{p.price}</span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-green-600">= ₹{p.price * qty}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isSelected && (
                    <button 
                      onClick={() => decrementItem(billEntryId)} 
                      className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus size={16} strokeWidth={3} />
                    </button>
                  )}
                  {isSelected && (
                    <span className="w-8 text-center font-black text-gray-800 text-sm">{qty}</span>
                  )}
                  <button 
                    onClick={() => incrementItem(p)} 
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-transform",
                      isSelected ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500"
                    )}
                  >
                    <Plus size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="p-6 text-center text-gray-400">
              <Receipt size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">No items yet. Add products first.</p>
              <button onClick={() => setShowAddProduct(true)} className="text-xs font-bold text-green-600 mt-2">+ Add Product</button>
            </div>
          )}
        </div>
      </section>

      {/* ═══════ SECTION 2: QUICK ENTRY (one-time bill item) ═══════ */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={() => setShowQuickEntry(!showQuickEntry)}
          className="text-[10px] font-medium text-gray-400 flex items-center gap-1 hover:text-gray-600 transition-colors"
        >
          <Plus size={10} /> {showQuickEntry ? 'Hide' : 'Quick Add (one-time item)'}
        </button>
      </div>
      <AnimatePresence>
        {showQuickEntry && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 items-end">
              <input 
                placeholder="Item name"
                value={manualItem.name}
                onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                className="flex-1 p-2.5 bg-gray-50 rounded-xl text-xs outline-none font-medium border border-gray-100"
              />
              <input 
                placeholder="₹"
                type="number"
                value={manualItem.price}
                onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                className="w-20 p-2.5 bg-gray-50 rounded-xl text-xs outline-none font-medium border border-gray-100"
              />
              <button 
                onClick={() => {
                  if (manualItem.name && manualItem.price) {
                    setBillItems(prev => [...prev, { 
                      id: `manual-${Date.now()}`, 
                      name: manualItem.name, 
                      price: Number(manualItem.price), 
                      quantity: Number(manualItem.quantity) || 1 
                    }]);
                    setManualItem({ name: "", price: "", quantity: "1" });
                  }
                }}
                className="px-4 py-2.5 bg-gray-800 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual items in bill (non-inventory) */}
      {billItems.filter(i => i.id.startsWith('manual-')).length > 0 && (
        <div className="space-y-2">
          {billItems.filter(i => i.id.startsWith('manual-')).map(item => (
            <div key={item.id} className="bg-white px-4 py-3 rounded-2xl border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-gray-800">{item.name}</p>
                <span className="text-[10px] text-gray-400">{item.quantity} × ₹{item.price} = ₹{item.price * item.quantity}</span>
              </div>
              <button onClick={() => setBillItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 p-1.5 hover:bg-red-50 rounded-lg">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ SECTION 3: CUSTOMER ═══════ */}
      <section className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <User size={13} className="text-blue-500" /> Customer (Optional)
            </h3>
            <p className="text-[9px] text-gray-300 font-medium">Optional – for regular customers</p>
          </div>
          <button 
            onClick={() => { setWaitingForNewCustomer(true); setShowAddCustomer(true); }}
            className="text-[10px] font-bold text-green-600 flex items-center gap-0.5 bg-green-50 px-2.5 py-1 rounded-full"
          >
            <Plus size={12} /> New
          </button>
        </div>

        {selectedCustomerData ? (
          <div className="flex items-center justify-between bg-green-50 p-3 rounded-2xl border border-green-200">
            <div>
              <p className="font-bold text-green-700 text-sm">{selectedCustomerData.name}</p>
              <p className="text-[10px] text-green-600">{selectedCustomerData.phone}</p>
            </div>
            <button onClick={() => setSelectedCustomer("")} className="text-green-500 p-1 hover:bg-green-100 rounded-lg">
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <input 
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 border-none outline-none text-sm font-medium" 
                placeholder={t.search || "Search customer..."} 
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setSelectedCustomer("")}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                  !selectedCustomer ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-400 border-gray-200"
                )}
              >
                Skip / Walk-in
              </button>
              {filteredCustomers.slice(0, 10).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c.id); setCustomerSearch(""); }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:border-green-500 hover:text-green-600 transition-all"
                >
                  <HighlightedText text={c.name} highlight={debouncedCustomerSearch} />
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ═══════ SECTION 4 + 5: PAYMENT STATUS + LANGUAGE ═══════ */}
      <section className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
            <CreditCard size={13} className="text-purple-500" /> Payment
          </h3>
          <div className="flex bg-gray-50 rounded-xl p-0.5">
            <button 
              onClick={() => setBillStatus("paid")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billStatus === "paid" ? "bg-green-600 text-white shadow-sm" : "text-gray-400"
              )}
            >
              ✅ {t.paid || "Paid"}
            </button>
            <button 
              onClick={() => setBillStatus("pending")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billStatus === "pending" ? "bg-red-500 text-white shadow-sm" : "text-gray-400"
              )}
            >
              {t.pending || "Pending"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
            <Globe size={13} className="text-indigo-500" /> Bill Language
          </h3>
          <div className="flex bg-gray-50 rounded-xl p-0.5">
            <button 
              onClick={() => setBillLang("hi")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billLang === "hi" ? "bg-green-600 text-white shadow-sm" : "text-gray-400"
              )}
            >
              हिंदी
            </button>
            <button 
              onClick={() => setBillLang("en")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                billLang === "en" ? "bg-green-600 text-white shadow-sm" : "text-gray-400"
              )}
            >
              English
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 6: STICKY BOTTOM ACTIONS ═══════ */}
      <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-white/95 backdrop-blur-lg border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-md mx-auto space-y-2">
          <div className="flex justify-between items-center px-1">
             <p className="text-[10px] font-bold text-gray-400 uppercase">{t.total || "Total"}</p>
             <p className="text-2xl font-black text-green-600">₹{total}</p>
          </div>
          <div className="space-y-2 relative">
            {!isProUser && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-800 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 uppercase flex items-center gap-1">
                    👑 Upgrade to unlock Professional Bills
                  </span>
                </div>
            )}
            <button
              disabled={billItems.length === 0 || isSavingBill || isGeneratingBill || !isProUser}
              onClick={async () => {
                if (!billTemplateRef.current) return;

                // Check for phone number if WhatsApp is clicked
                if (!selectedCustomer) {
                  setShowWhatsAppPhonePrompt(true);
                  return;
                }

                setIsGeneratingBill(true);
                
                await handleCreateBill(selectedCustomer, billItems, billStatus, billLang);

                try {
                  const html2canvas = (await import('html2canvas')).default;
                  const canvas = await html2canvas(billTemplateRef.current, { scale: 2, backgroundColor: '#ffffff' });
                  const dataUrl = canvas.toDataURL('image/png');
                  
                  const a = document.createElement('a');
                  a.style.display = 'none';
                  a.href = dataUrl;
                  a.download = `Bill_${selectedCustomerData?.name || 'Customer'}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);

                  setLocalToast("Bill downloaded. Please attach the image in WhatsApp and send.");
                  
                  const phone = selectedCustomerData?.phone || '';
                  const cleanPhone = phone.replace(/\D/g, "");
                  if (cleanPhone) {
                    const finalPhone = cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone;
                    const msg = encodeURIComponent("Your bill is ready.");
                    setTimeout(() => {
                      window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
                    }, 500);
                  }
                } catch (err) {
                  console.error("Error generating bill: ", err);
                } finally {
                  setShowBillPreview(false);
                  setBillItems([]);
                  setSelectedCustomer("");
                  setManualItem({ name: "", price: "", quantity: "1" });
                  setIsGeneratingBill(false);
                }
              }}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGeneratingBill || isSavingBill ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                "📲 Send on WhatsApp"
              )}
            </button>
            <button
              disabled={billItems.length === 0 || isSavingBill || isGeneratingBill || !isProUser}
              onClick={() => setShowBillPreview(true)}
              className="w-full bg-white text-green-600 border-2 border-green-600 py-3 rounded-2xl font-bold text-sm shadow-sm hover:bg-green-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              👁 View Professional Bill
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ TOAST ═══════ */}
      <AnimatePresence>
        {localToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-48 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] bg-green-800 text-white flex items-center gap-2 font-bold text-sm max-w-[90%] text-center"
          >
            <CheckCircle2 size={18} className="shrink-0 text-white" />
            <span className="leading-snug text-left">{localToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ VARIABLE PRICE MODAL ═══════ */}
      <AnimatePresence>
        {askPriceFor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-6 rounded-[2rem] shadow-xl w-full max-w-sm">
              <h3 className="font-bold text-gray-800 text-lg mb-1">{t.enterPrice || "Enter Price"}</h3>
              <p className="text-xs text-gray-400 mb-4">{askPriceFor.name}</p>
              <input type="number" autoFocus value={variablePrice} onChange={e=>setVariablePrice(e.target.value)} className="w-full bg-gray-50 border border-gray-200 outline-none p-4 rounded-2xl font-bold text-xl mb-4" />
              <div className="flex gap-3">
                <button onClick={()=>setAskPriceFor(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm">{t.cancel || "Cancel"}</button>
                <button onClick={()=>{
                  const priceToUse = Number(variablePrice) || askPriceFor.price;
                  const existing = billItems.find(i => i.id === askPriceFor.id && i.price === priceToUse);
                  if (existing) {
                    setBillItems(prev => prev.map(i => i.id === askPriceFor.id && i.price === priceToUse ? { ...i, quantity: i.quantity + 1 } : i));
                  } else {
                    setBillItems(prev => [...prev, { id: askPriceFor.id + '-' + priceToUse, name: askPriceFor.name, price: priceToUse, quantity: 1 }]);
                  }
                  setAskPriceFor(null);
                }} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm">{t.addItem || "Add"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════ CHANGE PRICE MODAL (for variable items already in bill) ═══════ */}
      <AnimatePresence>
        {changePriceFor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-6 rounded-[2rem] shadow-xl w-full max-w-sm">
              <h3 className="font-bold text-gray-800 text-lg mb-1">Update Price</h3>
              <p className="text-xs text-gray-400 mb-4">{billItems.find(i => i.id === changePriceFor)?.name}</p>
              <input type="number" autoFocus value={newPriceInput} onChange={e=>setNewPriceInput(e.target.value)} className="w-full bg-gray-50 border border-gray-200 outline-none p-4 rounded-2xl font-bold text-xl mb-4" />
              <div className="flex gap-3">
                <button onClick={()=>setChangePriceFor(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm">{t.cancel || "Cancel"}</button>
                <button onClick={()=>{
                  const newPrice = Number(newPriceInput);
                  if (newPrice > 0 && changePriceFor) {
                    setBillItems(prev => prev.map(i => i.id === changePriceFor ? { ...i, price: newPrice } : i));
                  }
                  setChangePriceFor(null);
                }} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm">Update</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════ WHATSAPP PHONE PROMPT MODAL ═══════ */}
      <AnimatePresence>
        {showWhatsAppPhonePrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-6 rounded-[2rem] shadow-xl w-full max-w-sm">
              <h3 className="font-bold text-gray-800 text-lg mb-1">Send WhatsApp Bill</h3>
              <p className="text-xs text-gray-400 mb-4">Enter phone number to send bill</p>
              <input 
                type="tel" 
                autoFocus 
                placeholder="Phone Number"
                value={tempWhatsAppPhone} 
                onChange={e=>setTempWhatsAppPhone(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 outline-none p-4 rounded-2xl font-bold text-xl mb-4" 
              />
              <div className="flex gap-3">
                <button onClick={()=>{ setShowWhatsAppPhonePrompt(false); setTempWhatsAppPhone(""); }} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm">{t.cancel || "Cancel"}</button>
                <button 
                  onClick={async () => {
                    const cleanPhone = tempWhatsAppPhone.replace(/\D/g, "");
                    if (cleanPhone.length < 10) {
                      setLocalToast("Please enter a valid phone number");
                      return;
                    }
                    
                    setIsGeneratingBill(true);
                    setShowWhatsAppPhonePrompt(false);
                    
                    // Create bill as walk-in with this phone for WhatsApp only
                    await handleCreateBill("", billItems, billStatus, billLang);

                    try {
                      const html2canvas = (await import('html2canvas')).default;
                      const canvas = await html2canvas(billTemplateRef.current, { scale: 2, backgroundColor: '#ffffff' });
                      const dataUrl = canvas.toDataURL('image/png');
                      
                      const a = document.createElement('a');
                      a.style.display = 'none';
                      a.href = dataUrl;
                      a.download = `Bill_WalkIn.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);

                      setLocalToast("Bill downloaded. Please attach in WhatsApp.");
                      
                      const finalPhone = cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone;
                      const msg = encodeURIComponent("Your bill is ready.");
                      setTimeout(() => {
                        window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
                      }, 500);
                    } catch (err) {
                      console.error("Error generating bill: ", err);
                    } finally {
                      setBillItems([]);
                      setSelectedCustomer("");
                      setTempWhatsAppPhone("");
                      setIsGeneratingBill(false);
                    }
                  }} 
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm"
                >
                  Send
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════ BILL PREVIEW MODAL ═══════ */}
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
                <h3 className="text-xl font-bold text-gray-800">Preview Bill</h3>
                <button onClick={() => setShowBillPreview(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <div className="flex justify-center mb-6 border border-gray-200 bg-gray-50 p-4 rounded-3xl max-h-[50vh] overflow-y-auto no-scrollbar relative">
                {!isProUser && (
                  <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-800 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100">
                      👑 Upgrade to unlock Professional Bills
                    </span>
                  </div>
                )}
                <div className="origin-top" style={{ transform: 'scale(0.75)' }}>
                  <BillTemplate 
                    shop={shop}
                    customer={selectedCustomerData}
                    items={billItems}
                    total={total}
                    billStatus={billStatus}
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!isProUser || !billTemplateRef.current) return;
                  setIsGeneratingBill(true);
                  try {
                    const html2canvas = (await import('html2canvas')).default;
                    const canvas = await html2canvas(billTemplateRef.current, { scale: 2, backgroundColor: '#ffffff' });
                    const dataUrl = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = dataUrl;
                    a.download = `Bill_${selectedCustomerData?.name || 'Customer'}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setLocalToast("Bill downloaded successfully!");
                    setShowBillPreview(false);
                  } catch (err) {
                    console.error("Error generating bill: ", err);
                  } finally {
                    setIsGeneratingBill(false);
                  }
                }}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-base shadow-sm flex items-center justify-center gap-2 transition-all border",
                  isProUser ? "bg-white text-green-600 border-2 border-green-600 hover:bg-green-50" : "bg-gray-50 text-gray-400 border-gray-100"
                )}
                disabled={isGeneratingBill || isSavingBill}
              >
                Download Bill
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden bill template for html2canvas */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <BillTemplate 
          ref={billTemplateRef}
          shop={shop}
          customer={selectedCustomerData}
          items={billItems}
          total={total}
          billStatus={billStatus}
        />
      </div>
    </div>
  );
});
