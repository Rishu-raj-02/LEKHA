import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { writeBatch } from 'firebase/firestore';
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  handleFirestoreError,
  loginWithGoogle,
  logout
} from '../firebase';
import { Shop, Customer, Product, Bill, Udhar, MonthlyReport } from '../types';
import { ensureDate } from '../utils/helpers';

interface AppContextType {
  user: User | null;
  shop: Shop | null;
  loading: boolean;
  lang: "en" | "hi";
  setLang: (lang: "en" | "hi") => void;
  customers: Customer[];
  products: Product[];
  bills: Bill[];
  udharList: Udhar[];
  monthlyReports: MonthlyReport[];
  setShop: (shop: Shop | null) => void;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isProUser: boolean;
  isPlanExpired: boolean;
  checkFinalizeLimit: () => Promise<boolean>;
  showReportPopup: MonthlyReport | null;
  dismissReportPopup: () => void;
  recentlyUsedIds: string[];
  markProductAsUsed: (id: string) => void;
  prefillProductName: string;
  setPrefillProductName: (name: string) => void;
  updateMonthlyExpenses: (monthKey: string, expenses: any) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "hi">("hi");

  // Data States
  // Data States (Loaded from Cache for instant launch)
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const cached = localStorage.getItem('lekha_customers');
    return cached ? JSON.parse(cached) : [];
  });
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = localStorage.getItem('lekha_products');
    return cached ? JSON.parse(cached) : [];
  });
  const [bills, setBills] = useState<Bill[]>(() => {
    const cached = localStorage.getItem('lekha_bills');
    return cached ? JSON.parse(cached) : [];
  });
  const [udharList, setUdharList] = useState<Udhar[]>(() => {
    const cached = localStorage.getItem('lekha_udhar');
    return cached ? JSON.parse(cached) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [showReportPopup, setShowReportPopup] = useState<MonthlyReport | null>(null);
  const [recentlyUsedIds, setRecentlyUsedIds] = useState<string[]>(() => {
    const cached = localStorage.getItem('lekha_recent_items');
    return cached ? JSON.parse(cached) : [];
  });
  const [prefillProductName, setPrefillProductName] = useState("");
  const [archivalDone, setArchivalDone] = useState(false);
  const dismissReportPopup = useCallback(() => setShowReportPopup(null), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const shopDoc = await getDoc(doc(db, "shops", currentUser.uid));
          if (shopDoc.exists()) {
            setShop({ id: shopDoc.id, ...shopDoc.data() } as Shop);
          } else {
            setShop(null);
          }
        } catch (err) {
          console.error("Error fetching shop data:", err);
          setError("Failed to fetch shop data. Please refresh.");
        } finally {
          setLoading(false);
        }
      } else {
        setShop(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const isProUser = React.useMemo(() => {
    if (user?.email === "yourdemo@gmail.com" || user?.email === "lekhawebapp@gmail.com") return true;
    if (!shop) return false;
    
    if (shop.isPro && shop.planExpiry) {
      const expiryMs = ensureDate(shop.planExpiry).getTime();
      if (Date.now() <= expiryMs) return true;
    }
    return false;
  }, [user, shop]);

  const isPlanExpired = React.useMemo(() => {
    if (user?.email === "yourdemo@gmail.com" || user?.email === "lekhawebapp@gmail.com") return false;
    if (!shop) return false;
    
    if (shop.isPro && shop.planExpiry) {
      const expiryMs = ensureDate(shop.planExpiry).getTime();
      if (Date.now() > expiryMs) return true;
    }
    return false;
  }, [user, shop]);

  useEffect(() => {
    if (!user || !shop) return;

    const shopRef = doc(db, "shops", user.uid);

    const unsubCustomers = onSnapshot(collection(shopRef, "customers"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
      setCustomers(data);
      localStorage.setItem('lekha_customers', JSON.stringify(data));
    }, (error) => {
      console.warn("Customers listener error:", error.message);
    });

    const unsubProducts = onSnapshot(collection(shopRef, "products"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      setProducts(data);
      localStorage.setItem('lekha_products', JSON.stringify(data));
    }, (error) => {
      console.warn("Products listener error:", error.message);
    });

    const unsubBills = onSnapshot(query(
      collection(shopRef, "bills"), 
      orderBy("created_at", "desc"), 
      limit(200) 
    ), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));
      setBills(data);
      localStorage.setItem('lekha_bills', JSON.stringify(data));
    }, (error) => {
      console.warn("Bills listener error:", error.message);
    });

    const unsubUdhar = onSnapshot(query(collection(shopRef, "udhar"), where("status", "==", "pending")), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Udhar));
      setUdharList(data);
      localStorage.setItem('lekha_udhar', JSON.stringify(data));
    }, (error) => {
      console.warn("Udhar listener error:", error.message);
    });

    const unsubReports = onSnapshot(
      query(collection(shopRef, "monthlyReports"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MonthlyReport));
        setMonthlyReports(data);
      }, (error) => {
        console.warn("Reports listener error (expected if not Pro):", error.message);
      }
    );

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubBills();
      unsubUdhar();
      unsubReports();
    };
  }, [user, shop]);

  // --- Month-End Archival Engine ---
  useEffect(() => {
    if (archivalDone || !user || !shop || !isProUser) return;
    
    // Skip archival for demo accounts to avoid permission issues
    if (user.email === "yourdemo@gmail.com" || user.email === "lekhawebapp@gmail.com") return;
    
    setArchivalDone(true);

    const runArchival = async () => {
      try {
        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const reportId = `${prevMonth.getFullYear()}-${(prevMonth.getMonth() + 1).toString().padStart(2, '0')}`;
        const reportName = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const reportRef = doc(db, "shops", user.uid, "monthlyReports", reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) return; 

        const q = query(
          collection(db, "shops", user.uid, "bills"),
          where("created_at", ">=", Timestamp.fromDate(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1))),
          where("created_at", "<", Timestamp.fromDate(new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1)))
        );
        const billsSnap = await getDocs(q);
        const prevMonthBills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Bill));

        if (prevMonthBills.length === 0) return; 

        // CALCULATE total sales and profit correctly from types
        const totalSales = prevMonthBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
        const totalProfit = prevMonthBills.reduce((acc, b) => {
          const items = b.items || [];
          const billProfit = items.reduce((p, item) => {
            const itemPrice = item.price || 0;
            const itemCost = item.cost_price || 0;
            return p + ((itemPrice - itemCost) * (item.quantity || 1));
          }, 0);
          return acc + billProfit;
        }, 0);

        const itemStats: Record<string, { name: string, profit: number }> = {};
        prevMonthBills.forEach(b => {
          (b.items || []).forEach(item => {
            const name = item.product_name || 'Unknown';
            const profitVal = (item.price - (item.cost_price || 0)) * (item.quantity || 1);
            if (!itemStats[name]) itemStats[name] = { name: name, profit: 0 };
            itemStats[name].profit += profitVal;
          });
        });

        const sortedItems = Object.values(itemStats).sort((a, b) => b.profit - a.profit);
        const bestItem = sortedItems[0] || { name: '-', profit: 0 };
        const worstItem = sortedItems[sortedItems.length - 1] || { name: '-', profit: 0 };

        const trendMap: Record<string, number> = {};
        prevMonthBills.forEach(b => {
          const d = ensureDate(b.created_at);
          const key = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          const billProfit = (b.items || []).reduce((p, item) => p + ((item.price - (item.cost_price || 0)) * (item.quantity || 1)), 0);
          trendMap[key] = (trendMap[key] || 0) + billProfit;
        });
        const profitTrend = Object.entries(trendMap).map(([dateStr, profit]) => ({ dateStr, profit }));

        const ppMonthId = `${new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 1, 1).getFullYear()}-${(new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 1, 1).getMonth() + 1).toString().padStart(2, '0')}`;
        const ppReportSnap = await getDoc(doc(db, "shops", user.uid, "monthlyReports", ppMonthId));
        let comparisonWithLastMonth = 0;
        if (ppReportSnap.exists()) {
          const ppData = ppReportSnap.data();
          if (ppData.totalSales > 0) {
            comparisonWithLastMonth = Math.round(((totalSales - ppData.totalSales) / ppData.totalSales) * 100);
          }
        }

        // Calculate total udhar (pending bills) for the month
        const totalUdhar = prevMonthBills
          .filter(b => b.status === 'pending')
          .reduce((acc, b) => acc + (b.totalAmount || 0), 0);

        const reportData: Omit<MonthlyReport, 'id'> = {
          monthStr: reportName,
          totalSales,
          totalProfit,
          totalBills: prevMonthBills.length,
          totalUdhar,
          bestItem,
          worstItem,
          profitTrend,
          comparisonWithLastMonth,
          createdAt: Timestamp.now(),
          templateVersion: 'v2'
        };

        await setDoc(reportRef, reportData);

        const batch = writeBatch(db);
        prevMonthBills.forEach(b => {
          batch.update(doc(db, "shops", user.uid, "bills", b.id), { isArchived: true });
        });
        await batch.commit();

        setShowReportPopup({ id: reportId, ...reportData } as MonthlyReport);
      } catch (err) {
        if (err instanceof Error && err.message.includes('permission-denied')) {
           console.warn("Insufficient permissions for automated monthly archival.");
        } else {
           console.error('Monthly archival error:', err);
        }
      }
    };

    runArchival();
  }, [user, shop, archivalDone, isProUser]);

  const login = React.useCallback(async () => {
    try {
      setError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(`Login Failed: ${err.message}`);
    }
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
      setShop(null);
      setUser(null);
    } catch (err: any) {
      console.error("Logout Error:", err);
    }
  }, []);

  const checkFinalizeLimit = React.useCallback(async () => {
    if (isProUser) return true;
    if (!user || !shop) return false;
    
    const todayStr = new Date().toDateString();
    let currentCount = shop.dailyFinalizeCount || 0;
    if (shop.lastFinalizeDate !== todayStr) currentCount = 0;
    
    if (currentCount >= 15) return false;
    
    try {
      await updateDoc(doc(db, "shops", user.uid), {
        dailyFinalizeCount: currentCount + 1,
        lastFinalizeDate: todayStr
      });
      setShop({ ...shop, dailyFinalizeCount: currentCount + 1, lastFinalizeDate: todayStr });
      return true;
    } catch (err) {
      console.error("Finalize Limit Update Error:", err);
      return false;
    }
  }, [isProUser, shop, user, setShop]);

  const updateProductStock = React.useCallback(async (productId: string, newStock: number) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "shops", user.uid, "products", productId), { stockQuantity: Math.max(0, Math.floor(newStock)) });
    } catch (err) {
      console.error("Update Product Stock Error:", err);
    }
  }, [user]);

  const deleteProduct = React.useCallback(async (productId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "shops", user.uid, "products", productId));
      setRecentlyUsedIds(prev => prev.filter(id => id !== productId));
    } catch (err) {
      console.error("Delete Product Error:", err);
    }
  }, [user]);

  const markProductAsUsed = React.useCallback((id: string) => {
    setRecentlyUsedIds(prev => {
      const newRecent = [id, ...prev.filter(i => i !== id)].slice(0, 5);
      localStorage.setItem('lekha_recent_items', JSON.stringify(newRecent));
      return newRecent;
    });
  }, []);

  const updateMonthlyExpenses = React.useCallback(async (monthKey: string, expenses: any) => {
    if (!user || !shop) return;
    try {
      const shopRef = doc(db, "shops", user.uid);
      const updatedExpenses = {
        ...(shop.monthlyExpenses || {}),
        [monthKey]: expenses
      };
      await updateDoc(shopRef, { monthlyExpenses: updatedExpenses });
      setShop({ ...shop, monthlyExpenses: updatedExpenses });
    } catch (err) {
      console.error("Update Monthly Expenses Error:", err);
      throw err;
    }
  }, [user, shop]);

  const contextValue = React.useMemo(() => ({
    user,
    shop,
    loading,
    lang,
    setLang,
    customers,
    products,
    bills,
    udharList,
    monthlyReports,
    setShop,
    error,
    login,
    logout: handleLogout,
    isProUser,
    isPlanExpired,
    checkFinalizeLimit,
    updateProductStock,
    deleteProduct,
    showReportPopup,
    dismissReportPopup,
    recentlyUsedIds,
    markProductAsUsed,
    prefillProductName,
    setPrefillProductName,
    updateMonthlyExpenses
  }), [user, shop, loading, lang, customers, products, bills, udharList, monthlyReports, error, login, handleLogout, isProUser, isPlanExpired, checkFinalizeLimit, updateProductStock, deleteProduct, showReportPopup, dismissReportPopup, recentlyUsedIds, markProductAsUsed, prefillProductName, updateMonthlyExpenses]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
