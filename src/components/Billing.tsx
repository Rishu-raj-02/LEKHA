import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, MessageCircle, X, CheckCircle2, Receipt, ShoppingBag, User, CreditCard, Globe, ScanLine, Camera, Rocket, Lock } from "lucide-react";
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
  setShowPricing: (v: boolean) => void;
}

export const Billing = React.memo(({ setShowAddCustomer, setShowAddProduct, handleCreateBill, isSavingBill, setShowPricing }: BillingProps) => {
  const { customers, products, shop, lang, isProUser, checkFinalizeLimit } = useApp();
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
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState(false);
  const [autoDownloadOptions, setAutoDownloadOptions] = useState({ onSave: true, onNoSave: true });
  const [savePreference, setSavePreference] = useState<'ask' | 'always' | 'never'>('ask');
  const [billingStep, setBillingStep] = useState<'editing' | 'deciding' | 'ready'>('editing');
  const [isSavedInDB, setIsSavedInDB] = useState(false);
  const [showDiamondMenu, setShowDiamondMenu] = useState(false);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState<string>("");

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

  // Increment item with stock limit check
  const incrementItem = useCallback((product: any) => {
    const stock = product.stockQuantity ?? 999999;
    
    if (isProUser && product.sellingType === "variable") {
      const existing = billItems.find(i => i.id === product.id || i.id.startsWith(product.id + '-'));
      if (existing) {
        if (existing.quantity >= stock) {
          setLocalToast(`Stock limit reached (${stock})`);
          return;
        }
        setBillItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
      } else {
        if (stock <= 0) {
          setLocalToast("Out of Stock");
          return;
        }
        setAskPriceFor(product);
        setVariablePrice(product.lastUsedPrice ? product.lastUsedPrice.toString() : product.price.toString());
      }
      return;
    }

    const existing = billItems.find(i => i.id === product.id);
    if (existing) {
      if (existing.quantity >= stock) {
        setLocalToast(`Stock limit reached (${stock})`);
        return;
      }
      setBillItems(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      if (stock <= 0) {
        setLocalToast("Out of Stock");
        return;
      }
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

  // Remove item completely
  const removeItemFromBill = useCallback((itemBillId: string) => {
    setBillItems(prev => prev.filter(i => i.id !== itemBillId));
  }, []);

  const initiateBilling = useCallback(async () => {
    if (billItems.length === 0) {
      setLocalToast(t.noItems);
      return;
    }

    const canProceed = await checkFinalizeLimit();
    if (!canProceed) {
      setShowPricing(true);
      return;
    }

    if (savePreference === 'always') {
      handleDecision(true);
    } else if (savePreference === 'never') {
      handleDecision(false);
    } else {
      setBillingStep('deciding');
    }
  }, [billItems, savePreference, t, checkFinalizeLimit, setShowPricing]);

  const handleDecision = async (shouldSave: boolean) => {
    setBillingStep('ready');
    setIsSavedInDB(shouldSave);
    
    if (shouldSave) {
      // SAVE TO DB + UPDATE INVENTORY
      // This logic must be atomic and strict
      try {
        await handleCreateBill(selectedCustomer, billItems, billStatus, billLang);
        setLocalToast("Bill Saved & Inventory Updated ✅");
        
        // Final Auto Download Trigger
        if (autoDownloadEnabled && autoDownloadOptions.onSave) {
          executeDownload();
        }
      } catch (err) {
        setLocalToast("Failed to save bill");
      }
    } else {
      setLocalToast("Action Ready (Bill Not Saved)");
      if (autoDownloadEnabled && autoDownloadOptions.onNoSave) {
        executeDownload();
      }
    }
  };

  const executeDownload = async () => {
    setIsGeneratingBill(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(billTemplateRef.current, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true 
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Bill_${selectedCustomerData?.name || 'WalkIn'}_${Date.now()}.png`;
      a.click();
    } catch (err) {
      setLocalToast("Download failed");
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const generateBillWhatsAppText = () => {
    const customerName = selectedCustomerData?.name || "Walk-in Customer";
    const shopName = shop?.shop_name || "LEKHA SHOP";
    
    let itemsList = "";
    billItems.forEach(item => {
      itemsList += `${item.name.padEnd(12)} ${item.quantity.toString().padEnd(6)} ₹${item.price * item.quantity}\n`;
    });

    return `🧾 *LEKHA BILL*\n\n*Shop:* ${shopName}\n\n*Customer:* ${customerName}\n\n------------------------\n*Item*        *Qty*    *₹*\n${itemsList}------------------------\n\n*Total: ₹${total}*\n*Status: ${billStatus.toUpperCase()}*\n\nThank you for your business 🙏`;
  };

  const executeWhatsApp = async () => {
    const phone = selectedCustomerData?.phone || tempWhatsAppPhone || '';
    if (!phone) {
      setShowWhatsAppPhonePrompt(true);
      return;
    }

    // Unlimited for everyone in the new rule (only Finalize is limited)
    const cleanPhone = phone.replace(/\D/g, "");
    const finalPhone = cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone;
    
    const billText = generateBillWhatsAppText();
    const msg = encodeURIComponent(billText);
    
    setLocalToast("Opening WhatsApp...");
    window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
  };

  const resetBilling = () => {
    setBillingStep('editing');
    setIsSavedInDB(false);
    setBillItems([]);
    setSelectedCustomer("");
    setManualItem({ name: "", price: "", quantity: "1" });
    setTempWhatsAppPhone("");
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
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAddProduct(true)}
              className="text-[10px] font-bold text-green-600 flex items-center gap-0.5 bg-green-50 px-2.5 py-1 rounded-full ml-1"
            >
              <Plus size={12} /> Add New Item
            </button>
          </div>
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
                    {isProUser && p.stockQuantity !== undefined && (
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                        p.stockQuantity === 0 ? "bg-red-100 text-red-600" :
                        (p.stockQuantity - qty) <= 0 ? "bg-red-100 text-red-600" :
                        (p.stockQuantity - qty) <= 5 ? "bg-red-50 text-red-500 border border-red-100" : 
                        (p.stockQuantity - qty) <= 10 ? "bg-yellow-50 text-yellow-600 border border-yellow-100" : "bg-gray-50 text-gray-400 border border-gray-100"
                      )}>
                        {p.stockQuantity === 0 ? "Out of Stock ❌" : 
                         (p.stockQuantity - qty) <= 0 ? "No more stock 🚫" :
                         (p.stockQuantity - qty) <= 10 ? `${t.lowStockAlert} (${p.stockQuantity - qty} left)` : `Available: ${p.stockQuantity - qty} left`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                    {isSelected && (
                      <button 
                        onClick={() => decrementItem(billEntryId)} 
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90 transition-transform"
                      >
                        <Minus size={14} strokeWidth={3} />
                      </button>
                    )}
                    {isSelected && (
                      editingQtyId === billEntryId ? (
                        <input 
                          autoFocus
                          type="number"
                          value={qtyInput}
                          onChange={(e) => setQtyInput(e.target.value)}
                          onBlur={() => {
                            const stock = p.stockQuantity ?? 999999;
                            let val = Number(qtyInput);
                            if (val > stock) {
                              val = stock;
                              setLocalToast(`Only available stock can be added (${stock})`);
                            }
                            if (val <= 0) {
                              removeItemFromBill(billEntryId);
                            } else {
                              setBillItems(prev => prev.map(i => i.id === billEntryId ? { ...i, quantity: val } : i));
                            }
                            setEditingQtyId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const stock = p.stockQuantity ?? 999999;
                              let val = Number(qtyInput);
                              if (val > stock) {
                                val = stock;
                                setLocalToast(`Only available stock can be added (${stock})`);
                              }
                              if (val <= 0) {
                                removeItemFromBill(billEntryId);
                              } else {
                                setBillItems(prev => prev.map(i => i.id === billEntryId ? { ...i, quantity: val } : i));
                              }
                              setEditingQtyId(null);
                            }
                          }}
                          className="w-10 h-8 text-center bg-white text-[10px] font-black outline-none border-x border-gray-100"
                        />
                      ) : (
                        <span 
                          onClick={() => {
                            setEditingQtyId(billEntryId);
                            setQtyInput(qty.toString());
                          }}
                          className="px-2 min-w-[24px] text-center font-black text-gray-800 text-xs cursor-text hover:bg-white transition-colors"
                        >
                          {qty}
                        </span>
                      )
                    )}
                    <button 
                      disabled={p.stockQuantity === 0 || qty >= (p.stockQuantity ?? 999999)}
                      onClick={() => incrementItem(p)} 
                      className={cn(
                        "w-8 h-8 flex items-center justify-center transition-all",
                        (p.stockQuantity === 0 || qty >= (p.stockQuantity ?? 999999)) ? "opacity-30 cursor-not-allowed bg-gray-100 text-gray-300" : 
                        isSelected ? "bg-green-600 text-white" : "text-gray-400 hover:text-green-600 active:scale-90"
                      )}
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>

                  {isSelected && (
                    <button 
                      onClick={() => removeItemFromBill(billEntryId)}
                      className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-transform hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
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

        {/* Auto Download System */}
        <div className="pt-2 border-t border-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoDownloadEnabled}
                  onChange={(e) => setAutoDownloadEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                {t.autoDownload || "Auto Download Bill"}
              </label>
              <button 
                onClick={() => setShowDiamondMenu(!showDiamondMenu)}
                className={cn(
                  "p-1 rounded-lg transition-all",
                  showDiamondMenu ? "bg-blue-100 text-blue-600" : "text-gray-300 hover:text-blue-500"
                )}
              >
                <Globe size={14} className={cn(autoDownloadEnabled && "text-blue-500")} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showDiamondMenu && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 space-y-2 overflow-hidden"
              >
                <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Download Preference</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={autoDownloadOptions.onSave}
                    onChange={(e) => setAutoDownloadOptions(prev => ({ ...prev, onSave: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-blue-200 text-blue-600"
                  />
                  <span className="text-[10px] font-bold text-blue-700">Apply on Save Bill</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={autoDownloadOptions.onNoSave}
                    onChange={(e) => setAutoDownloadOptions(prev => ({ ...prev, onNoSave: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-blue-200 text-blue-600"
                  />
                  <span className="text-[10px] font-bold text-blue-700">Apply on Don't Save Bill</span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2 pt-1">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Default Action Preference</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setSavePreference('always')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all border",
                  savePreference === 'always' ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-400 border-gray-100"
                )}
              >
                Always Save
              </button>
              <button 
                onClick={() => setSavePreference('never')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all border",
                  savePreference === 'never' ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-400 border-gray-100"
                )}
              >
                Never Save
              </button>
              <button 
                onClick={() => setSavePreference('ask')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all border",
                  savePreference === 'ask' ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-gray-400 border-gray-100"
                )}
              >
                Ask Me
              </button>
            </div>
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
            {/* STEP 2: READY (Actions) */}
            {billingStep === 'ready' ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className={cn(
                  "p-3 rounded-2xl border text-center mb-1",
                  isSavedInDB ? "bg-green-50 border-green-100 text-green-700" : "bg-gray-50 border-gray-100 text-gray-600"
                )}>
                  <p className="font-black text-sm flex items-center justify-center gap-2">
                    {isSavedInDB ? (
                      <><CheckCircle2 size={16} /> {t.billCreated || "Bill Saved & Stock Updated"}</>
                    ) : (
                      <><Globe size={16} /> Bill Generated (Not Saved)</>
                    )}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <button
                    onClick={executeWhatsApp}
                    className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-base shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <MessageCircle size={20} /> {t.sendOnWhatsApp}
                  </button>

                  {!autoDownloadEnabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setShowBillPreview(true)}
                        className="bg-white text-green-600 border-2 border-green-600 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                      >
                        👁 {t.viewBill || "View Bill"}
                      </button>
                      <button
                        onClick={executeDownload}
                        className="bg-white text-blue-600 border-2 border-blue-600 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                      >
                        📥 {t.downloadBill || "Download"}
                      </button>
                    </div>
                  )}
                  
                  <button
                    onClick={resetBilling}
                    className="w-full bg-gray-100 text-gray-800 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    ✨ {t.newBill}
                  </button>
                </div>
              </div>
            ) : billingStep === 'deciding' ? (
              /* STEP 1: DECISION (Save vs Don't Save) */
              <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <button
                    onClick={() => handleDecision(true)}
                    className="w-full bg-green-600 text-white py-4 rounded-3xl font-black text-base shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <CheckCircle2 size={20} /> Save Bill (Stock Update)
                  </button>
                  <button
                    onClick={() => handleDecision(false)}
                    className="w-full bg-white text-gray-800 border-2 border-gray-200 py-4 rounded-3xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <X size={20} /> Don't Save (Just Send)
                  </button>
                  <button onClick={() => setBillingStep('editing')} className="text-xs font-bold text-gray-400 py-2">← Back to editing</button>
              </div>
            ) : (
              /* STEP 0: IDLE (Finalize) */
              <div className="space-y-2">
                {!isProUser && (shop?.dailyFinalizeCount || 0) >= 15 && (
                  <button 
                    onClick={() => setShowPricing(true)}
                    className="w-full bg-blue-50 text-blue-600 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border border-blue-100 animate-pulse mb-1"
                  >
                    <Rocket size={14} /> 🚀 Upgrade to Premium for unlimited billing
                  </button>
                )}
                <button
                  disabled={billItems.length === 0 || isSavingBill || (typeof isGeneratingBill !== 'undefined' && isGeneratingBill) || (!isProUser && (shop?.dailyFinalizeCount || 0) >= 15)}
                  onClick={initiateBilling}
                  className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-[0_15px_30px_rgba(22,163,74,0.3)] hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <span className="text-2xl font-black">₹</span> Finalize Bill
                </button>
              </div>
            )}
            
            {!isProUser && (
              <p className="text-[10px] text-center text-gray-400 font-bold tracking-tight mt-3">
                Free Plan: 15 bills/day • {Math.max(0, 15 - (shop?.dailyFinalizeCount || 0))} remaining today
              </p>
            )}
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
              <h3 className="font-bold text-gray-800 text-lg mb-1">Customer Phone</h3>
              <p className="text-xs text-gray-400 mb-4">Enter phone number to send bill via WhatsApp</p>
              <input 
                type="tel" 
                autoFocus 
                placeholder="Phone Number (e.g. 9876543210)"
                value={tempWhatsAppPhone} 
                onChange={e=>setTempWhatsAppPhone(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 outline-none p-4 rounded-2xl font-bold text-xl mb-4 text-center tracking-widest" 
              />
              <div className="flex gap-3">
                <button onClick={()=>{ setShowWhatsAppPhonePrompt(false); setTempWhatsAppPhone(""); }} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm">Cancel</button>
                <button 
                  onClick={() => {
                    const cleanPhone = tempWhatsAppPhone.replace(/\D/g, "");
                    if (cleanPhone.length < 10) {
                      setLocalToast("Enter a valid 10-digit number");
                      return;
                    }
                    setShowWhatsAppPhonePrompt(false);
                    executeWhatsApp();
                  }} 
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm shadow-lg active:scale-95"
                >
                  Confirm Send
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
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-6 shadow-2xl overflow-y-auto max-h-[90vh] pb-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-800">Bill Preview</h3>
                <button onClick={() => setShowBillPreview(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <div className="border border-gray-100 bg-gray-50 p-4 rounded-[2.5rem] overflow-hidden mb-6 flex justify-center">
                <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                  <BillTemplate 
                    shop={shop}
                    customer={selectedCustomerData || { name: t.walkInCustomer, phone: tempWhatsAppPhone }}
                    items={billItems}
                    total={total}
                    billStatus={billStatus}
                    ref={null}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  setShowBillPreview(false);
                  executeDownload();
                }}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                📥 Download PNG
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden bill template for html2canvas generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <BillTemplate 
          ref={billTemplateRef}
          shop={shop}
          customer={selectedCustomerData || { name: t.walkInCustomer, phone: tempWhatsAppPhone }}
          items={billItems}
          total={total}
          billStatus={billStatus}
        />
      </div>
    </div>
  );
});
