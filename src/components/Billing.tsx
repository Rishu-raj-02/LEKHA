import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, MessageCircle, X, CheckCircle2, Receipt, ShoppingBag, User, CreditCard, Globe, ScanLine, Camera, Rocket, Lock, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";
import { cn, formatPhone } from "../utils/helpers";
import { HighlightedText } from "./ui/HighlightedText";
import { translations } from "../translations";
import { useDebounce } from '../hooks/useDebounce';
import { BillTemplate } from './BillTemplate';
import { db, doc, updateDoc, collection, addDoc, deleteDoc, getDoc, Timestamp } from "../firebase";
import { Modal } from "./ui/Modal";
import { BarcodeScanner } from "./BarcodeScanner";
import { PaymentActionModal } from "./PaymentActionModal";
interface BillingProps {
  setShowAddCustomer: (v: boolean) => void;
  setShowAddProduct: (v: boolean) => void;
  handleCreateBill: (
    customerId: string, 
    items: { name: string; price: number; quantity: number }[],
    billStatus: "paid" | "pending" | "udhar",
    billLang: "en" | "hi"
  ) => Promise<string | undefined>;
  isSavingBill: boolean;
  setShowPricing: (v: boolean) => void;
}

export const Billing = React.memo(({ setShowAddCustomer, setShowAddProduct, handleCreateBill, isSavingBill, setShowPricing }: BillingProps) => {
  const { customers, products, shop, setShop, lang, isProUser, checkFinalizeLimit, setPrefillProductName, setPrefillBarcode, setPrefillPrice, setPrefillCategory } = useApp();
  const t = translations[lang];

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [billItems, setBillItems] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", price: "", quantity: "1" });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 100);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [pendingScannerBarcode, setPendingScannerBarcode] = useState<string | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  const [billLang, setBillLang] = useState<"en" | "hi">("en");
  const [billStatus, setBillStatus] = useState<"paid" | "pending" | "udhar">("paid");

  const [askPriceFor, setAskPriceFor] = useState<any>(null);
  const [variablePrice, setVariablePrice] = useState("");
  const [changePriceFor, setChangePriceFor] = useState<string | null>(null);
  const [newPriceInput, setNewPriceInput] = useState("");
  
  const [showWhatsAppPhonePrompt, setShowWhatsAppPhonePrompt] = useState(false);
  const [tempWhatsAppCustomerName, setTempWhatsAppCustomerName] = useState("");
  const [tempWhatsAppPhone, setTempWhatsAppPhone] = useState("");
  const [stockError, setStockError] = useState<string | null>(null);
  const [showCashConfirm, setShowCashConfirm] = useState(false);

  const [billingStep, setBillingStep] = useState<'editing' | 'payment_action' | 'show_qr' | 'preview'>('editing');
  const [savedBillId, setSavedBillId] = useState<string | null>(null);
  
  const [showUdharForm, setShowUdharForm] = useState(false);
  const [udharNameInput, setUdharNameInput] = useState("");
  const [udharPhoneInput, setUdharPhoneInput] = useState("");
  
  const [showUpiSetup, setShowUpiSetup] = useState(false);
  const [upiIdInput, setUpiIdInput] = useState("");
  const [confirmUpiIdInput, setConfirmUpiIdInput] = useState("");
  const [upiError, setUpiError] = useState("");
  
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState<string>("");

  const billTemplateRef = React.useRef<HTMLDivElement>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);

  // Track previous lengths for auto-add
  const prevProductsLen = React.useRef(products.length);
  const prevCustomersLen = React.useRef(customers.length);
  const [waitingForNewCustomer, setWaitingForNewCustomer] = useState(false);

  // Toast effect
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
  }, [products, billItems]);

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
  
  const selectedCustomerData = useMemo(() => {
    const matched = customers.find(c => c.id === selectedCustomer);
    if (matched) return matched;
    return {
      name: tempWhatsAppCustomerName || t.walkInCustomer || "Walk-in Customer",
      phone: tempWhatsAppPhone || null
    };
  }, [customers, selectedCustomer, tempWhatsAppCustomerName, tempWhatsAppPhone, t.walkInCustomer]);

  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => 
      (c.name?.toLowerCase() || "").includes(debouncedCustomerSearch.toLowerCase()) || 
      (c.phone || "").includes(debouncedCustomerSearch)
    );
  }, [customers, debouncedCustomerSearch]);

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => 
      (p.name?.toLowerCase() || "").includes(debouncedProductSearch.toLowerCase()) ||
      (p.barcode?.toLowerCase() || "").includes(debouncedProductSearch.toLowerCase())
    );
  }, [products, debouncedProductSearch]);

  const addOrIncrementBillItem = useCallback((product: any) => {
    let message = `✓ ${product.name} added`;
    setBillItems(prev => {
      const existing = prev.find(i => i.id === product.id || i.id.startsWith(`${product.id}-`));
      if (existing) {
        const updated = prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
        message = `✓ ${product.name} x${existing.quantity + 1}`;
        return updated;
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    setScanMessage(message);
  }, []);

  useEffect(() => {
    if (!pendingScannerBarcode) return;
    const matchedProduct = products.find(p => p.barcode === pendingScannerBarcode);
    if (matchedProduct) {
      setPendingScannerBarcode(null);
      addOrIncrementBillItem(matchedProduct);
      setIsScannerOpen(true);
    }
  }, [products, pendingScannerBarcode, addOrIncrementBillItem]);

  const handleBillingScan = async (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addOrIncrementBillItem(product);
      return;
    }
    setIsScannerOpen(false);
    setNotFoundBarcode(barcode);
  };

  const handleCreateMissingProduct = async () => {
    if (!notFoundBarcode) return;
    try {
      const { barcodeService } = await import('../services/barcodeService');
      const { match } = barcodeService.lookupBarcode(notFoundBarcode);
      setPrefillBarcode(notFoundBarcode);
      if (match) {
        setPrefillProductName(match.productName);
        setPrefillPrice(String(match.suggestedSellingPrice));
        setPrefillCategory(match.category || '');
      } else {
        setPrefillProductName('');
        setPrefillPrice('');
        setPrefillCategory('');
      }
      setPendingScannerBarcode(notFoundBarcode);
      setNotFoundBarcode(null);
      setIsScannerOpen(false);
      setShowAddProduct(true);
    } finally {
      // keep pending scanner barcode until product is added or form is cancelled
    }
  };

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

  // Decrement item
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

  const findProductForBillItem = (item: { id: string; name: string; price: number; quantity: number }) => {
    return products.find(
      (product) => product.id === item.id || item.id.startsWith(`${product.id}-`)
    );
  };

  const applyInventoryUpdates = async () => {
    if (!shop) return;

    for (const item of billItems) {
      const product = findProductForBillItem(item);
      if (!product) continue;

      const productRef = doc(db, "shops", shop.id, "products", product.id);
      const productUpdates: any = {};

      if (typeof product.stockQuantity === "number") {
        productUpdates.stockQuantity = Math.max(0, product.stockQuantity - item.quantity);
      }

      if (product.sellingType === "variable" && item.price !== undefined) {
        productUpdates.lastUsedPrice = item.price;
      }

      if (Object.keys(productUpdates).length > 0) {
        await updateDoc(productRef, productUpdates);
      }
    }
  };

  const validateBillStock = () => {
    const oversoldItem = billItems.find((item) => {
      const product = findProductForBillItem(item);
      return (
        product &&
        typeof product.stockQuantity === "number" &&
        item.quantity > product.stockQuantity
      );
    });

    if (!oversoldItem) return true;

    const product = findProductForBillItem(oversoldItem);
    if (!product) return true;

    setStockError(
      `Only ${product.stockQuantity} ${product.name} ${
        product.stockQuantity === 1 ? "unit" : "units"
      } are available. Update the quantity before finalizing.`
    );
    return false;
  };

  const initiateBilling = useCallback(async () => {
    if (billItems.length === 0) {
      setLocalToast(t.noItems);
      return;
    }

    if (!validateBillStock()) {
      return;
    }

    const canProceed = await checkFinalizeLimit();
    if (!canProceed) {
      setShowPricing(true);
      return;
    }

    try {
      const billId = await handleCreateBill(selectedCustomer, billItems, "pending", billLang);
      if (billId) {
        setSavedBillId(billId);
        setBillingStep('payment_action');
      } else {
        setLocalToast("Failed to finalize bill");
      }
    } catch (err) {
      console.error(err);
      setLocalToast("Failed to save bill");
    }
  }, [billItems, selectedCustomer, billLang, handleCreateBill, checkFinalizeLimit, setShowPricing, t.noItems, products]);

  const updateBillStatus = async (status: "paid" | "udhar", customerInfo?: { name: string; phone: string | null }) => {
    if (!savedBillId || !shop) return;
    try {
      const billRef = doc(db, "shops", shop.id, "bills", savedBillId);
      const updates: any = { status };
      if (customerInfo) {
        updates.customer = customerInfo;
      }
      await updateDoc(billRef, updates);
      setBillStatus(status);
    } catch (err) {
      console.error("Error updating bill status:", err);
      setLocalToast("Error updating bill payment status");
    }
  };

  const handleMarkAsUdhar = async (name: string, phone: string) => {
    if (!shop || !savedBillId) return;
    
    try {
      let customerId = selectedCustomer;
      let finalName = name;
      let finalPhone = phone ? phone.replace(/\D/g, "") : "";
      if (finalPhone && !finalPhone.startsWith("91") && finalPhone.length === 10) {
        finalPhone = "91" + finalPhone;
      }

      if (!customerId) {
        // Walk-in Customer: find or create customer
        const existing = customers.find(c => 
          (finalPhone && c.phone === finalPhone) || 
          (c.name.toLowerCase() === finalName.toLowerCase())
        );

        if (existing) {
          customerId = existing.id;
          finalName = existing.name;
          finalPhone = existing.phone;
          
          // Update customer total_udhar in Firestore
          const customerRef = doc(db, "shops", shop.id, "customers", customerId);
          await updateDoc(customerRef, {
            total_udhar: (existing.total_udhar || 0) + total
          });
        } else {
          // Create new customer
          const customerData = {
            name: finalName,
            phone: finalPhone || "",
            total_udhar: total,
            created_at: Timestamp.now()
          };
          const newCustRef = await addDoc(collection(db, "shops", shop.id, "customers"), customerData);
          customerId = newCustRef.id;
        }
      } else {
        // Customer was already selected
        const selectedC = customers.find(c => c.id === customerId);
        if (selectedC) {
          finalName = selectedC.name;
          finalPhone = selectedC.phone || "";
          
          // Update customer total_udhar in Firestore
          const customerRef = doc(db, "shops", shop.id, "customers", customerId);
          await updateDoc(customerRef, {
            total_udhar: (selectedC.total_udhar || 0) + total
          });
        }
      }

      // Update the bill status and customer info
      await updateBillStatus("udhar", {
        name: finalName,
        phone: finalPhone || null
      });

      // Update inventory after bill is finalized as Udhar
      await applyInventoryUpdates();

      // Create Udhar document
      await addDoc(collection(db, "shops", shop.id, "udhar"), {
        customer_id: customerId,
        customer_name: finalName,
        customer_phone: finalPhone || "",
        amount: total,
        status: "pending",
        type: "bill",
        due_date: null,
        created_at: Timestamp.now()
      });

      // Update local states
      setBillStatus("udhar");
      setSelectedCustomer(customerId);
      setTempWhatsAppCustomerName(finalName);
      setTempWhatsAppPhone(finalPhone);
      setLocalToast("Udhar recorded successfully ✅");
      setBillingStep("preview");
      setShowUdharForm(false);
    } catch (err) {
      console.error("Error marking as Udhar:", err);
      setLocalToast("Failed to record Udhar");
    }
  };

  const handleUpiSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpiError("");
    const upi = upiIdInput.trim();
    const confirm = confirmUpiIdInput.trim();
    
    if (!upi || !confirm) {
      setUpiError("Both fields are required");
      return;
    }
    if (upi !== confirm) {
      setUpiError("UPI IDs do not match");
      return;
    }
    const upiRegex = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/;
    if (!upiRegex.test(upi)) {
      setUpiError("Invalid UPI ID format (e.g. name@bank)");
      return;
    }
    
    try {
      const shopRef = doc(db, "shops", shop.id);
      await updateDoc(shopRef, { upiId: upi });
      setShop({ ...shop, upiId: upi });
      setShowUpiSetup(false);
      setBillingStep('show_qr');
      setLocalToast("UPI ID saved successfully ✅");
    } catch (err) {
      console.error("Error saving UPI ID:", err);
      setUpiError("Failed to save UPI ID to database");
    }
  };

  const handleUdharFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = udharNameInput.trim();
    const phone = udharPhoneInput.trim();
    
    if (!name && !phone) {
      setLocalToast("At least one field (Name or Phone) is required");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone && cleanPhone.length !== 10) {
      setLocalToast("Mobile number must be a valid 10-digit number");
      return;
    }
    
    await handleMarkAsUdhar(name || "Udhar Customer", cleanPhone);
  };

  const executeDownload = async () => {
    if (isGeneratingBill) return;
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
      const customerName = selectedCustomerData?.name || tempWhatsAppCustomerName || 'WalkIn';
      a.download = `Bill_${customerName.replace(/\s+/g, '_')}_${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.error(err);
      setLocalToast("Download failed");
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const generateBillWhatsAppText = (langToUse: "en" | "hi", statusToUse: "paid" | "pending" | "udhar") => {
    const customerName = selectedCustomerData?.name || tempWhatsAppCustomerName || (langToUse === 'hi' ? "सामान्य ग्राहक" : "Walk-in Customer");
    const shopName = shop?.shop_name || "LEKHA SHOP";
    
    let itemsList = "";
    billItems.forEach(item => {
      itemsList += `${item.name.padEnd(12)} ${item.quantity.toString().padEnd(6)} ₹${item.price * item.quantity}\n`;
    });

    const statusStr = statusToUse === 'paid' 
      ? (langToUse === 'hi' ? 'पैसे मिल गए (Paid)' : 'PAID') 
      : (statusToUse === 'udhar' ? (langToUse === 'hi' ? 'उधार (Udhar)' : 'UDHAR') : (langToUse === 'hi' ? 'बाकी (Pending)' : 'PENDING'));

    if (langToUse === 'hi') {
      return `🧾 *लेखा बिल (LEKHA BILL)*\n\n*दुकान:* ${shopName}\n\n*ग्राहक:* ${customerName}\n\n------------------------\n*सामान*        *मात्रा*    *₹*\n${itemsList}------------------------\n\n*कुल राशि: ₹${total}*\n*स्थिति: ${statusStr}*\n\nव्यापार के लिए धन्यवाद 🙏`;
    }

    return `🧾 *LEKHA BILL*\n\n*Shop:* ${shopName}\n\n*Customer:* ${customerName}\n\n------------------------\n*Item*        *Qty*    *₹*\n${itemsList}------------------------\n\n*Total: ₹${total}*\n*Status: ${statusStr}*\n\nThank you for your business 🙏`;
  };

  const executeWhatsApp = async () => {
    const phone = selectedCustomerData?.phone || tempWhatsAppPhone || '';
    if (!phone) {
      setShowWhatsAppPhonePrompt(true);
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const finalPhone = cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone;
    
    const billText = generateBillWhatsAppText(billLang, billStatus);
    const msg = encodeURIComponent(billText);
    
    setLocalToast("Opening WhatsApp...");
    window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
  };

  const handleConfirmCashPayment = async () => {
    setShowCashConfirm(false);
    await updateBillStatus('paid');
    await applyInventoryUpdates();
    setBillingStep('preview');
    setLocalToast('Payment Received - Cash ✅');
  };

  const handleCancelBilling = async () => {
    if (shop && savedBillId) {
      try {
        await deleteDoc(doc(db, "shops", shop.id, "bills", savedBillId));
      } catch (err) {
        console.error("Failed to delete pending bill:", err);
      }
    }
    resetBilling();
  };

  const resetBilling = () => {
    setBillingStep('editing');
    setBillItems([]);
    setSelectedCustomer("");
    setManualItem({ name: "", price: "", quantity: "1" });
    setTempWhatsAppPhone("");
    setTempWhatsAppCustomerName("");
    setSavedBillId(null);
    setUdharNameInput("");
    setUdharPhoneInput("");
  };

  if (!shop) return null;

  return (
    <div className="space-y-4 pb-52">
      {/* ═══════ STEP 0: EDITING SCREEN ═══════ */}
      {billingStep === 'editing' && (
        <>
          {/* SECTION 1: ITEMS */}
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center p-4 pb-2">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <ShoppingBag size={13} className="text-green-500" /> {t.addItem || "Select Items"}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowAddProduct(true)}
                  className="text-[10px] font-bold text-green-600 flex items-center gap-0.5 bg-green-50 px-2.5 py-1 rounded-full"
                >
                  <Plus size={12} /> Add New Item
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 pt-4 pb-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-green-500 transition-all font-medium" 
                  placeholder={t.search || "Search items..."} 
                />
                {productSearch && (
                  <button 
                    onClick={() => setProductSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <button 
                onClick={() => {
                  setScanMessage(null);
                  setIsScannerOpen(true);
                }}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors"
              >
                <Camera size={16} /> Scan Items
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {filteredProducts.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  No matching items found.
                </div>
              ) : filteredProducts.map(p => {
                const isVariable = isProUser && p.sellingType === "variable";
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
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-sm text-gray-800 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isVariable && isSelected ? (
                          <button 
                            onClick={() => {
                              setChangePriceFor(billEntryId);
                              setNewPriceInput(displayPrice.toString());
                            }}
                            className="text-xs font-black text-blue-600 px-1.5 py-0.5 bg-blue-50 rounded border border-blue-100 flex items-center gap-0.5 active:scale-95"
                          >
                            ₹{displayPrice}
                            <span className="text-[8px] text-blue-400">✏️</span>
                          </button>
                        ) : (
                          <span className="text-xs font-black text-gray-500">₹{displayPrice}</span>
                        )}
                        {p.stockQuantity !== undefined && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded",
                            p.stockQuantity <= (p.minStock || 5) ? "bg-red-50 text-red-600 font-black" : "bg-gray-50 text-gray-400"
                          )}>
                            Stock: {p.stockQuantity}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-gray-50 rounded-xl overflow-hidden border border-gray-100 p-0.5">
                        <button 
                          onClick={() => decrementItem(billEntryId)} 
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-lg active:scale-90 transition-transform",
                            isSelected ? "text-gray-600" : "text-gray-300 pointer-events-none"
                          )}
                        >
                          <Minus size={14} strokeWidth={3} />
                        </button>

                        {isSelected && (
                          editingQtyId === billEntryId ? (
                            <input 
                              type="number"
                              autoFocus
                              value={qtyInput}
                              onChange={(e) => setQtyInput(e.target.value)}
                              onBlur={() => {
                                const val = Number(qtyInput);
                                const stock = p.stockQuantity ?? 999999;
                                if (!isNaN(val)) {
                                  let finalVal = val;
                                  if (val > stock) {
                                    finalVal = stock;
                                    setLocalToast(`Only available stock can be added (${stock})`);
                                  }
                                  if (finalVal <= 0) {
                                    removeItemFromBill(billEntryId);
                                  } else {
                                    setBillItems(prev => prev.map(i => i.id === billEntryId ? { ...i, quantity: finalVal } : i));
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
                            isSelected ? "bg-green-600 text-white rounded-lg" : "text-gray-400 hover:text-green-600 active:scale-90"
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

          {/* SECTION 2: QUICK ENTRY */}
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

          {/* Manual items list */}
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

          {/* SECTION 3: CUSTOMER SELECTION */}
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

            {selectedCustomerData && selectedCustomer ? (
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

          {/* STICKY BOTTOM ACTIONS */}
          <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-white/95 backdrop-blur-lg border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
            <div className="max-w-md mx-auto space-y-2">
              <div className="flex justify-between items-center px-1">
                 <p className="text-[10px] font-bold text-gray-400 uppercase">{t.total || "Total"}</p>
                 <p className="text-2xl font-black text-green-600">₹{total}</p>
              </div>
              
              <div className="space-y-2 relative">
                {!isProUser && (shop?.dailyFinalizeCount || 0) >= 15 && (
                  <button 
                    onClick={() => setShowPricing(true)}
                    className="w-full bg-blue-50 text-blue-600 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border border-blue-100 animate-pulse mb-1"
                  >
                    <Rocket size={14} /> 🚀 Upgrade to Premium for unlimited billing
                  </button>
                )}
                <button
                  disabled={billItems.length === 0 || isSavingBill || isGeneratingBill || (!isProUser && (shop?.dailyFinalizeCount || 0) >= 15)}
                  onClick={initiateBilling}
                  className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-[0_15px_30px_rgba(22,163,74,0.3)] hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isSavingBill ? (
                    <>
                      <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      Finalizing Bill...
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-black">₹</span> Finalize Bill
                    </>
                  )}
                </button>
              </div>
              
              {!isProUser && (
                <p className="text-[10px] text-center text-gray-400 font-bold tracking-tight mt-3">
                  Free Plan: 15 bills/day • {Math.max(0, 15 - (shop?.dailyFinalizeCount || 0))} remaining today
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════ UPI SETUP MODAL ═══════ */}
      {showUpiSetup && (
        <Modal
          isOpen={true}
          onClose={() => setShowUpiSetup(false)}
          title="Set Up UPI ID"
        >
          <form onSubmit={handleUpiSetupSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase px-4">UPI ID</label>
              <input
                value={upiIdInput}
                onChange={e => setUpiIdInput(e.target.value)}
                required
                placeholder="e.g. name@bank"
                className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase px-4">Confirm UPI ID</label>
              <input
                value={confirmUpiIdInput}
                onChange={e => setConfirmUpiIdInput(e.target.value)}
                required
                placeholder="Re-enter UPI ID"
                className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold"
              />
            </div>
            {upiError && <p className="text-red-500 text-xs">{upiError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-purple-600 text-white py-2 rounded-xl font-bold">
                Save
              </button>
              <button type="button" onClick={() => setShowUpiSetup(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════ STEP 1: PAYMENT ACTION SCREEN ═══════ */}
      {billingStep === 'payment_action' && (
        <PaymentActionModal
          isOpen={true}
          total={total}
          shop={shop}
          customer={selectedCustomerData}
          onUPI={() => {
            if (shop?.upiId) {
              setBillingStep('show_qr');
            } else {
              setShowUpiSetup(true);
            }
          }}
          onCash={() => {
            setShowCashConfirm(true);
          }}
          onUdhar={() => setShowUdharForm(true)}
          onCancel={handleCancelBilling}
        />
      )}

      <Modal isOpen={!!stockError} onClose={() => setStockError(null)} title="Invalid Quantity">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{stockError}</p>
          <button
            onClick={() => setStockError(null)}
            className="w-full bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-700 transition-colors"
          >
            OK
          </button>
        </div>
      </Modal>

      <Modal isOpen={showCashConfirm} onClose={() => setShowCashConfirm(false)} title={t.confirmPaymentReceived || "Confirm Payment"}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t.confirmPaymentReceived || "Have you received the payment?"}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowCashConfirm(false)}
              className="bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCashPayment}
              className="bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!notFoundBarcode} onClose={() => setNotFoundBarcode(null)} title="Product not found">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">We could not find this barcode in inventory.</p>
          <p className="text-xs text-gray-500 break-all">Barcode: {notFoundBarcode}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setNotFoundBarcode(null)}
              className="bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateMissingProduct}
              className="bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-700 transition-colors"
            >
              Add New Item
            </button>
          </div>
        </div>
      </Modal>

      {isScannerOpen && (
        <BarcodeScanner
          continuous
          cooldownMs={3000}
          onScanned={handleBillingScan}
          onClose={() => setIsScannerOpen(false)}
          headerContent={
            <div className="space-y-2 text-sm">
              {scanMessage ? (
                <p className="text-green-700 font-semibold truncate">{scanMessage}</p>
              ) : (
                <p className="text-gray-500">Scan one item at a time. Camera stays on while scanning pauses.</p>
              )}
            </div>
          }
        />
      )}

      {/* ═══════ STEP 2: UPI QR CODE SCREEN ═══════ */}
      {billingStep === 'show_qr' && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6 max-w-md mx-auto text-center mt-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setBillingStep('payment_action')}
              className="text-gray-400 font-bold text-xs flex items-center gap-1 hover:text-gray-600 active:scale-95 transition-transform"
            >
              ← Back
            </button>
            <h3 className="text-lg font-black text-gray-800">Scan & Pay</h3>
            <div className="w-10" />
          </div>

          <div className="border border-gray-100 bg-gray-50 p-6 rounded-[2.5rem] flex flex-col items-center justify-center space-y-4">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{shop.shop_name}</p>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  `upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.shop_name)}&am=${total}&cu=INR&tr=${savedBillId || ''}`
                )}`}
                alt="UPI QR Code" 
                className="w-48 h-48"
              />
            </div>
            <div>
              <p className="text-3xl font-black text-gray-800">₹{total}</p>
              <p className="text-[10px] text-gray-400 font-bold tracking-wider mt-1">UPI ID: {shop.upiId}</p>
            </div>
          </div>

          <button
            onClick={async () => {
              await updateBillStatus("paid");
              await applyInventoryUpdates();
              setBillingStep('preview');
              setLocalToast("Payment Received - UPI QR ✅");
            }}
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-base shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={20} /> Payment Received
          </button>
        </div>
      )}

      {/* ═══════ STEP 3: BILL PREVIEW SCREEN ═══════ */}
      {billingStep === 'preview' && (
        <div className="space-y-6 max-w-md mx-auto pb-10 mt-4">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-green-100 text-green-600 rounded-full">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-800">Bill Saved Successfully!</h3>
              <p className="text-xs text-gray-400 mt-1">Transaction recorded & inventory updated</p>
            </div>
            
            {/* Language Selection Bar */}
            <div className="flex bg-gray-100 rounded-2xl p-1 w-full max-w-[200px]">
              <button 
                onClick={() => setBillLang("en")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black transition-all",
                  billLang === "en" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                English
              </button>
              <button 
                onClick={() => setBillLang("hi")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black transition-all",
                  billLang === "hi" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                हिन्दी
              </button>
            </div>
          </div>

          <div className="border border-gray-100 bg-gray-50 p-4 rounded-[2.5rem] overflow-hidden flex justify-center shadow-inner">
            <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
              <BillTemplate 
                shop={shop}
                customer={selectedCustomerData}
                items={billItems}
                total={total}
                billStatus={billStatus}
                billId={savedBillId || undefined}
                lang={billLang}
                ref={null}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 px-2">
            <button
              onClick={executeWhatsApp}
              className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-black text-base shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <MessageCircle size={20} /> {t.sendOnWhatsApp}
            </button>

            <div className="flex gap-3">
              <button
                disabled={isGeneratingBill}
                onClick={executeDownload}
                className="flex-1 bg-white text-blue-600 border-2 border-blue-600 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {isGeneratingBill ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                    Preparing PDF...
                  </>
                ) : (
                  <>📥 {t.downloadBill || "Download"}</>
                )}
              </button>
              <button
                onClick={resetBilling}
                className="flex-1 bg-gray-950 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                ✨ {t.newBill}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ═══════ CHANGE PRICE MODAL ═══════ */}
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

      {/* ═══════ ONE-TIME UPI ID SETUP MODAL ═══════ */}
      <Modal isOpen={showUpiSetup} onClose={() => setShowUpiSetup(false)} title="UPI Settings Setup">
        <form onSubmit={handleUpiSetupSubmit} className="space-y-4">
          <p className="text-xs text-gray-400">This is a one-time configuration. You can change your UPI ID later from the Profile page.</p>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">UPI ID</label>
            <input 
              type="text" 
              placeholder="e.g. name@bank" 
              value={upiIdInput} 
              onChange={e => setUpiIdInput(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold text-base mt-1" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Confirm UPI ID</label>
            <input 
              type="text" 
              placeholder="Confirm your UPI ID" 
              value={confirmUpiIdInput} 
              onChange={e => setConfirmUpiIdInput(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold text-base mt-1" 
            />
          </div>
          {upiError && (
            <p className="text-xs text-red-500 font-bold text-center">{upiError}</p>
          )}
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => setShowUpiSetup(false)} 
              className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center"
            >
              Save & Show QR
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════ WALK-IN UDHAR DETAILS MODAL ═══════ */}
      <Modal isOpen={showUdharForm} onClose={() => setShowUdharForm(false)} title="Udhar Customer Details">
        <form onSubmit={handleUdharFormSubmit} className="space-y-4">
          <p className="text-xs text-gray-400">Please provide a Customer Name or Mobile Number to associate with this Udhar transaction.</p>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Customer Name</label>
            <input 
              type="text" 
              placeholder="Customer Name" 
              value={udharNameInput} 
              onChange={e => setUdharNameInput(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold text-base mt-1" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Mobile Number</label>
            <input 
              type="tel" 
              placeholder="Mobile Number (e.g. 9876543210)" 
              value={udharPhoneInput} 
              onChange={e => setUdharPhoneInput(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold text-base mt-1" 
            />
          </div>
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => setShowUdharForm(false)} 
              className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl text-sm shadow-md"
            >
              Confirm Udhar
            </button>
          </div>
        </form>
      </Modal>

      {/* Hidden bill template for html2canvas generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <BillTemplate 
          ref={billTemplateRef}
          shop={shop}
          customer={selectedCustomerData}
          items={billItems}
          total={total}
          billStatus={billStatus}
          billId={savedBillId || undefined}
          lang={billLang}
        />
      </div>
    </div>
  );
});
