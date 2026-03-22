import React, { useState, useEffect } from "react";
import { User as UserIcon, Receipt, AlertCircle, CheckCircle2, Languages } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, openWhatsApp } from "./utils/helpers";
import {
  db,
  doc,
  setDoc,
  addDoc,
  collection,
  updateDoc,
  Timestamp,
  handleFirestoreError,
  OperationType,
  getDoc,
} from "./firebase";
import { Udhar, Shop } from "./types";
import { translations } from "./translations";
import { AppProvider, useApp } from "./context/AppContext";

// Components
import { Header } from "./components/ui/Header";
import { BottomNav } from "./components/ui/BottomNav";
import { Modal } from "./components/ui/Modal";
import { Footer } from "./components/ui/Footer";
import { PrivacyPolicy, TermsAndConditions, RefundPolicy, ContactUs } from "./components/LegalPages";

import { PricingModal } from "./components/ui/PricingModal";

const Home = React.lazy(() => import("./components/Home").then(m => ({ default: m.Home })));
const Customers = React.lazy(() => import("./components/Customers").then(m => ({ default: m.Customers })));
const Billing = React.lazy(() => import("./components/Billing").then(m => ({ default: m.Billing })));
const UdharComp = React.lazy(() => import("./components/Udhar").then(m => ({ default: m.UdharTab })));
const Items = React.lazy(() => import("./components/Items").then(m => ({ default: m.Items })));
const Profile = React.lazy(() => import("./components/Profile").then(m => ({ default: m.Profile })));
const Insights = React.lazy(() => import("./components/Insights").then(m => ({ default: m.Insights })));
const Reports = React.lazy(() => import("./components/Reports").then(m => ({ default: m.Reports })));

function AppContent() {
  const { user, shop, loading, lang, setLang, customers, products, setShop, error, login, isProUser, isPlanExpired, checkWhatsAppLimit, showReportPopup, dismissReportPopup } = useApp();
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState("home");
  const [currentLegalPage, setCurrentLegalPage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddUdhar, setShowAddUdhar] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Loading states for UI feedback
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingUdhar, setIsAddingUdhar] = useState(false);
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isMarkingPaidId, setIsMarkingPaidId] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Handlers ---
  const handleCreateShop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const phone = formData.get("phone") as string;
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length !== 10 && cleanPhone.length !== 12) {
      setToast({ message: "Invalid phone number. Please enter 10 digits.", type: "error" });
      return;
    }

    const finalPhone = cleanPhone.startsWith("91") ? "+" + cleanPhone : "+91" + cleanPhone;
    const shopData = {
      shop_name: formData.get("shop_name") as string,
      owner_name: formData.get("owner_name") as string,
      phone: finalPhone,
      created_at: Timestamp.now(),
    };
    try {
      await setDoc(doc(db, "shops", user.uid), shopData);
      setShop({ id: user.uid, ...shopData } as Shop);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shops/${user.uid}`);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !shop) return;
    const formData = new FormData(e.currentTarget);
    const phone = formData.get("phone") as string;
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length !== 10) {
      setToast({ message: t.invalidPhoneError, type: "error" });
      return;
    }

    const finalPhone = "+91" + cleanPhone;
    const updatedData = {
      ...shop,
      shop_name: formData.get("shop_name") as string,
      owner_name: formData.get("owner_name") as string,
      phone: finalPhone,
    };

    setIsUpdatingProfile(true);
    try {
      const { id, ...dataToSave } = updatedData;
      await updateDoc(doc(db, "shops", user.uid), dataToSave);
      setShop(updatedData);
      setToast({ message: t.profileUpdated, type: "success" });
      setShowEditProfile(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${user.uid}`);
      setToast({ message: "Error updating profile", type: "error" });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !shop) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const phone = formData.get("phone") as string;
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length !== 10 && cleanPhone.length !== 12) {
      setToast({ message: "Invalid phone number. Please enter 10 digits.", type: "error" });
      return;
    }

    const finalPhone = cleanPhone.startsWith("91") ? "+" + cleanPhone : "+91" + cleanPhone;
    const customerData = {
      name: formData.get("name") as string,
      phone: finalPhone,
      total_udhar: 0,
      created_at: Timestamp.now(),
    };

    setIsAddingCustomer(true);
    try {
      await addDoc(collection(db, "shops", user.uid, "customers"), customerData);
      setToast({ message: t.addCustomer + " Success", type: "success" });
      setShowAddCustomer(false);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${user.uid}/customers`);
      setToast({ message: "Error saving customer", type: "error" });
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !shop) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const productData = {
      name: formData.get("name") as string,
      price: Number(formData.get("price")),
      category: formData.get("category") as string,
      stockQuantity: isProUser ? Number(formData.get("stockQuantity") || 0) : 0,
      costPrice: isProUser ? Number(formData.get("costPrice") || 0) : 0,
      sellingType: isProUser ? (formData.get("sellingType") as string || "fixed") : "fixed",
      minStock: isProUser ? Number(formData.get("minStock") || 0) : 0,
      lastUsedPrice: Number(formData.get("price")),
    };

    setIsAddingProduct(true);
    try {
      await addDoc(collection(db, "shops", user.uid, "products"), productData);
      setToast({ message: t.addItem + " Success", type: "success" });
      setShowAddProduct(false);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${user.uid}/products`);
      setToast({ message: "Error saving product", type: "error" });
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleAddUdhar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !shop) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const customerId = formData.get("customer_id") as string;
    const amount = Number(formData.get("amount"));
    const dueDate = formData.get("due_date") as string;
    const udharData = {
      customer_id: customerId,
      amount: amount,
      status: "pending",
      due_date: dueDate || null,
      created_at: Timestamp.now(),
    };

    setIsAddingUdhar(true);
    try {
      await addDoc(collection(db, "shops", user.uid, "udhar"), udharData);
      const customerRef = doc(db, "shops", user.uid, "customers", customerId);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        const currentUdhar = customerDoc.data().total_udhar || 0;
        await updateDoc(customerRef, { total_udhar: currentUdhar + amount });
      }
      setToast({ message: t.addUdhar + " Success", type: "success" });
      setShowAddUdhar(false);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${user.uid}/udhar`);
      setToast({ message: "Error saving udhar", type: "error" });
    } finally {
      setIsAddingUdhar(false);
    }
  };

  const handleMarkPaid = async (udhar: Udhar) => {
    if (!user || !shop) return;
    setIsMarkingPaidId(udhar.id);
    try {
      await updateDoc(doc(db, "shops", user.uid, "udhar", udhar.id), { status: "paid" });
      const customerRef = doc(db, "shops", user.uid, "customers", udhar.customer_id);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        const currentUdhar = customerDoc.data().total_udhar || 0;
        await updateDoc(customerRef, { total_udhar: Math.max(0, currentUdhar - udhar.amount) });
      }
      setToast({ message: "Marked as Paid", type: "success" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${user.uid}/udhar/${udhar.id}`);
      setToast({ message: "Error updating status", type: "error" });
    } finally {
      setIsMarkingPaidId(null);
    }
  };

  const handleCreateBill = async (customerId: string, items: { name: string; price: number; quantity: number }[], billStatus: "paid" | "pending", billLang: "en" | "hi") => {
    if (!user || !shop) return;
    if (items.length === 0) {
      setToast({ message: t.noItems, type: "error" });
      return;
    }

    setIsSavingBill(true);
    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    
    // Inventory & Profit Calculations
    let total_cost = 0;
    const itemsData = items.map(i => {
      const p = products.find(prod => prod.name === i.name);
      const cp = p?.costPrice || 0;
      total_cost += cp * i.quantity;
      return { product_name: i.name, price: i.price, quantity: i.quantity, cost_price: cp };
    });
    const total_profit = total - total_cost;

    const customerName = customerId ? (customers.find(c => c.id === customerId)?.name || "Customer") : "Walk-in Customer";

    const billData = {
      customer_id: customerId || "walk-in",
      customer_name: customerName,
      total_amount: total,
      total_cost,
      total_profit,
      status: billStatus,
      items: itemsData,
      created_at: Timestamp.now(),
    };

    try {
      await addDoc(collection(db, "shops", user.uid, "bills"), billData);
      
      if (billStatus === "pending" && customerId) {
        await addDoc(collection(db, "shops", user.uid, "udhar"), {
          customer_id: customerId,
          amount: total,
          status: "pending",
          due_date: null,
          created_at: Timestamp.now(),
        });
        const customerRef = doc(db, "shops", user.uid, "customers", customerId);
        const customerDoc = await getDoc(customerRef);
        if (customerDoc.exists()) {
          const currentUdhar = customerDoc.data().total_udhar || 0;
          await updateDoc(customerRef, { total_udhar: currentUdhar + total });
        }
      }
      
      // Update inventory stock and last prices
      if (isProUser) {
        for (const i of items) {
          const p = products.find(prod => prod.name === i.name);
          if (p && p.id) {
            const productRef = doc(db, "shops", user.uid, "products", p.id);
            const updates: any = {};
            if (p.stockQuantity !== undefined) {
              updates.stockQuantity = Math.max(0, p.stockQuantity - i.quantity);
            }
            if (p.sellingType === "variable") {
              updates.lastUsedPrice = i.price;
            }
            if (Object.keys(updates).length > 0) {
              await updateDoc(productRef, updates).catch(console.error);
            }
          }
        }
      }
      
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        const itemsList = items.map(i => `${i.name} x ${i.quantity} = Rs ${i.price * i.quantity}`).join("\n");
        let message = "";
        
        if (billLang === "en") {
          const statusText = billStatus === "paid" ? "Paid" : "Pending";
          const footerText = billStatus === "paid" ? "Payment received successfully. Thank you." : "Please complete your payment at the earliest.";
          message = `Hello ${customer.name},\n\n*INVOICE / BILL*\n\nThank you for your purchase from *${shop.shop_name}*.\n\n*Items:*\n\n${itemsList}\n--------------------------------\n\n*Total Amount: Rs ${total}*\n*Payment Status: ${statusText}*\n\n${footerText}\n\nThank you for your business.\n\n*${shop.shop_name}*`;
        } else {
          const statusText = billStatus === "paid" ? "भुगतान हुआ" : "लंबित";
          const footerText = billStatus === "paid" 
            ? "आपका भुगतान प्राप्त हो गया है। धन्यवाद।" 
            : "कृपया अपना भुगतान जल्द से जल्द पूरा करें।";
          
          message = `नमस्ते ${customer.name},\n\n*बिल विवरण*\n\n*${shop.shop_name}* से खरीदारी करने के लिए धन्यवाद।\n\n*सामान:*\n\n${itemsList}\n--------------------------------\n\n*कुल राशि: Rs ${total}*\n*भुगतान स्थिति: ${statusText}*\n\n${footerText}\n\n--------------------------------\n\nधन्यवाद।\n\n*${shop.shop_name}*`;
        }

        const canSend = await checkWhatsAppLimit();
        if (canSend) {
          openWhatsApp(customer.phone, message);
        } else {
          setToast({ message: "Free plan limit reached (10/day). Upgrade to Pro!", type: "error" });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${user.uid}/bills`);
    } finally {
      setIsSavingBill(false);
    }
  };

  // --- Render logic ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="max-w-xs">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-600 p-6 text-white relative">
        <button 
          onClick={() => setLang(lang === "en" ? "hi" : "en")} 
          className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white flex items-center gap-2 font-bold transition-all text-sm"
        >
          <Languages size={18} />
          {lang === "en" ? "हिंदी" : "English"}
        </button>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-green-600 mx-auto mb-6 shadow-xl">
            <Receipt size={48} />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">Lekha</h1>
          <p className="text-green-100 mb-10 text-lg">Simple shop management for everyone.</p>
          <button
            disabled={isLoggingIn}
            onClick={async () => {
              setIsLoggingIn(true);
              try {
                await login();
              } catch (err: any) {
                console.error("Login Error Catch in App.tsx:", err);
              } finally {
                setIsLoggingIn(false);
              }
            }}
            className="bg-white text-green-600 px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-green-50 transition-all flex items-center gap-3 w-full max-w-xs mx-auto justify-center disabled:opacity-50"
          >
            <UserIcon size={20} />
            {isLoggingIn ? "..." : t.login}
          </button>
        </motion.div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 relative">
        <button 
          onClick={() => setLang(lang === "en" ? "hi" : "en")} 
          className="absolute top-6 right-6 p-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-xl text-green-600 flex items-center gap-2 font-bold transition-all text-sm"
        >
          <Languages size={18} />
          {lang === "en" ? "हिंदी" : "English"}
        </button>
        <div className="max-w-md mx-auto pt-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">{t.createShop}</h2>
          <form onSubmit={handleCreateShop} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.shopName}</label>
              <input name="shop_name" required className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. Sharma Kirana Store" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.ownerName}</label>
              <input name="owner_name" required className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. Rajesh Sharma" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.phone}</label>
              <input name="phone" type="tel" required className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. 9876543210" />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-green-700 transition-all mt-4">
              {t.save}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (shop && !shop.planType) {
    return <PricingModal onPlanSelected={() => setActiveTab("home")} />;
  }

  if (shop && isPlanExpired && shop.planType === "pro") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 relative">
        <button 
          onClick={() => setLang(lang === "en" ? "hi" : "en")} 
          className="absolute top-6 right-6 p-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-xl text-green-600 flex items-center gap-2 font-bold transition-all text-sm"
        >
          <Languages size={18} />
          {lang === "en" ? "हिंदी" : "English"}
        </button>
        <div className="bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-xl border border-gray-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[1.5rem] mx-auto flex items-center justify-center mb-6">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Plan Expired</h2>
          <p className="text-gray-500 mb-8 font-medium text-sm leading-relaxed">Your 1-month plan has expired.<br/>Renew to continue Pro features.</p>
          <div className="space-y-4">
             <button 
                onClick={() => {
                  const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    amount: 4900,
                    currency: "INR",
                    name: t.appName,
                    description: "Pro Subscription Renewal",
                    handler: async function (response: any) {
                      const planStart = Timestamp.now();
                      const expiryDate = new Date();
                      expiryDate.setDate(expiryDate.getDate() + 30);
                      const planExpiry = Timestamp.fromDate(expiryDate);
                      await updateDoc(doc(db, "shops", user!.uid), { isPro: true, planType: "pro", planStart, planExpiry });
                      setShop({ ...shop, isPro: true, planType: "pro", planStart, planExpiry });
                    },
                    prefill: { name: shop.owner_name, email: user!.email, contact: shop.phone },
                    theme: { color: "#16a34a" }
                  };
                  new (window as any).Razorpay(options).open();
                }}
                className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-green-700 active:scale-[0.98] transition-all"
             >
               Renew Now
             </button>
             <button 
                onClick={async () => {
                  await updateDoc(doc(db, "shops", user!.uid), { planType: "free", isPro: false });
                  setShop({ ...shop, planType: "free", isPro: false });
                }}
                className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl hover:bg-gray-200 active:scale-[0.98] transition-all"
             >
               Continue Free
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-36">
      <Header shop={shop} lang={lang} setLang={setLang} />
      
      <main className="p-4 pb-36 max-w-md mx-auto">
        <React.Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"
            />
          </div>
        }>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "home" && (
              <Home 
                setActiveTab={setActiveTab} 
                setShowAddCustomer={setShowAddCustomer} 
                setShowAddUdhar={setShowAddUdhar} 
                handleMarkPaid={handleMarkPaid} 
                isMarkingPaidId={isMarkingPaidId}
              />
            )}
            {activeTab === "customers" && <Customers setShowAddCustomer={setShowAddCustomer} />}
            {activeTab === "billing" && (
              <Billing 
                setShowAddCustomer={setShowAddCustomer} 
                setShowAddProduct={setShowAddProduct} 
                handleCreateBill={handleCreateBill}
                isSavingBill={isSavingBill}
              />
            )}
            {activeTab === "udhar" && (
              <UdharComp 
                setShowAddUdhar={setShowAddUdhar} 
                handleMarkPaid={handleMarkPaid} 
                setToast={setToast} 
                isMarkingPaidId={isMarkingPaidId}
              />
            )}
            {activeTab === "insights" && <Insights />}
            {activeTab === "reports" && <Reports />}
            {activeTab === "items" && <Items setShowAddProduct={setShowAddProduct} />}
            {activeTab === "profile" && <Profile setShowEditProfile={setShowEditProfile} />}
          </motion.div>
        </React.Suspense>

        {activeTab === "home" && <Footer onNavigate={(page) => setCurrentLegalPage(page)} />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} t={t} />

      {/* Monthly Report Popup */}
      <AnimatePresence>
        {showReportPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-xl font-black text-gray-800 mb-2">{t.reportReady || "Your Monthly Report is Ready!"}</h2>
              <p className="text-sm text-gray-500 font-medium mb-1">{showReportPopup.monthStr}</p>
              <div className="grid grid-cols-3 gap-2 my-4">
                <div className="bg-green-50 p-2 rounded-xl">
                  <p className="text-[8px] font-bold text-green-600 uppercase">{t.totalSalesMonth || "Sales"}</p>
                  <p className="text-sm font-black text-green-700">₹{showReportPopup.totalSales}</p>
                </div>
                <div className="bg-blue-50 p-2 rounded-xl">
                  <p className="text-[8px] font-bold text-blue-600 uppercase">{t.totalProfitMonth || "Profit"}</p>
                  <p className="text-sm font-black text-blue-700">₹{showReportPopup.totalProfit}</p>
                </div>
                <div className="bg-purple-50 p-2 rounded-xl">
                  <p className="text-[8px] font-bold text-purple-600 uppercase">{t.totalBillsMonth || "Bills"}</p>
                  <p className="text-sm font-black text-purple-700">{showReportPopup.totalBills}</p>
                </div>
              </div>
              <button
                onClick={() => { dismissReportPopup(); setActiveTab('reports'); }}
                className="w-full bg-green-600 text-white font-black py-3 rounded-2xl shadow-lg mb-2 active:scale-[0.98] transition-all"
              >
                👁 {t.viewReport || "View Full Report"}
              </button>
              <button
                onClick={dismissReportPopup}
                className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl active:scale-[0.98] transition-all"
              >
                {t.cancel || "Close"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legal Pages Overlay */}
      <AnimatePresence>
        {currentLegalPage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white overflow-y-auto"
          >
            {currentLegalPage === 'privacy' && <PrivacyPolicy onBack={() => setCurrentLegalPage(null)} />}
            {currentLegalPage === 'terms' && <TermsAndConditions onBack={() => setCurrentLegalPage(null)} />}
            {currentLegalPage === 'refund' && <RefundPolicy onBack={() => setCurrentLegalPage(null)} />}
            {currentLegalPage === 'contact' && <ContactUs onBack={() => setCurrentLegalPage(null)} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-32 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-2 font-bold text-sm",
              toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <Modal isOpen={showAddCustomer} onClose={() => setShowAddCustomer(false)} title={t.addCustomer}>
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <input name="name" required placeholder={t.name} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          <input name="phone" type="tel" required placeholder={t.phone} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          <button disabled={isAddingCustomer} type="submit" className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
            {isAddingCustomer ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : t.save}
          </button>
        </form>
      </Modal>

      <Modal isOpen={showAddProduct} onClose={() => setShowAddProduct(false)} title={t.addItem}>
        <form onSubmit={handleAddProduct} className="space-y-4">
          <input name="name" required placeholder={t.name} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          <div className="grid grid-cols-2 gap-2">
            <input name="price" type="number" required placeholder={t.price} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
            <input name="category" placeholder={t.category} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>

          <div className="relative">
            {!isProUser && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-2xl border border-gray-100">
                <span className="text-xs font-bold text-gray-800 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-1">
                  <span className="text-green-600">👑</span> Upgrade to unlock Inventory
                </span>
              </div>
            )}
            <div className="bg-gray-50 p-4 rounded-2xl grid grid-cols-2 gap-3 border border-gray-100">
              <div className="col-span-2 flex justify-between items-center text-xs font-bold text-gray-500 mb-1">
                <span>INVENTORY SETTINGS</span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase text-[9px] tracking-wider">PRO</span>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Pricing Type</label>
                <select name="sellingType" className="w-full p-3 rounded-xl bg-white border-none outline-none text-xs font-bold">
                  <option value="fixed">Fixed Price</option>
                  <option value="variable">Variable Price</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Cost Price (CP)</label>
                <input name="costPrice" type="number" placeholder="₹0" className="w-full p-3 rounded-xl bg-white border-none outline-none text-xs font-bold" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Current Stock</label>
                <input name="stockQuantity" type="number" placeholder="Qty" className="w-full p-3 rounded-xl bg-white border-none outline-none text-xs font-bold" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Min Stock Alert</label>
                <input name="minStock" type="number" placeholder="Min" defaultValue={5} className="w-full p-3 rounded-xl bg-white border-none outline-none text-xs font-bold" />
              </div>
            </div>
          </div>

          <button disabled={isAddingProduct} type="submit" className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mt-4">
            {isAddingProduct ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : t.save}
          </button>
        </form>
      </Modal>

      <Modal isOpen={showAddUdhar} onClose={() => setShowAddUdhar(false)} title={t.addUdhar}>
        <form onSubmit={handleAddUdhar} className="space-y-4">
          <select name="customer_id" required className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold">
            <option value="">{t.selectCustomer}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="amount" type="number" required placeholder={t.amount} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">{t.dueDate} ({t.optional})</label>
            <input name="due_date" type="date" className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>
          <button disabled={isAddingUdhar} type="submit" className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
            {isAddingUdhar ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : t.save}
          </button>
        </form>
      </Modal>

      <Modal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} title={t.editProfile}>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">{t.shopName}</label>
            <input name="shop_name" defaultValue={shop?.shop_name} required className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">{t.ownerName}</label>
            <input name="owner_name" defaultValue={shop?.owner_name} required className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">{t.phone}</label>
            <input 
              name="phone" 
              type="tel" 
              defaultValue={shop?.phone.replace(/\D/g, "").slice(-10)} 
              required 
              placeholder="Enter 10-digit phone number"
              className={cn(
                "w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold",
                shop?.phone.replace(/\D/g, "").length < 10 && "ring-2 ring-red-500"
              )} 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">Email / Login ID</label>
            <input value={user?.email || ""} disabled className="w-full p-4 rounded-2xl bg-gray-100 border-none outline-none font-bold text-gray-400" />
          </div>
          <button disabled={isUpdatingProfile} type="submit" className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
            {isUpdatingProfile ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : t.saveChanges}
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
