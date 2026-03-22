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
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
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
  checkWhatsAppLimit: () => Promise<boolean>;
  showReportPopup: MonthlyReport | null;
  dismissReportPopup: () => void;
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

  useEffect(() => {
    if (!user || !shop) return;

    const shopRef = doc(db, "shops", user.uid);

    const unsubCustomers = onSnapshot(collection(shopRef, "customers"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
      setCustomers(data);
      localStorage.setItem('lekha_customers', JSON.stringify(data));
    });

    const unsubProducts = onSnapshot(collection(shopRef, "products"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      setProducts(data);
      localStorage.setItem('lekha_products', JSON.stringify(data));
    });

    const unsubBills = onSnapshot(query(
      collection(shopRef, "bills"), 
      orderBy("created_at", "desc"), 
      limit(200) // Increased from 50 to 200 for better 7-day analytics
    ), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));
      setBills(data);
      localStorage.setItem('lekha_bills', JSON.stringify(data));
    });

    const unsubUdhar = onSnapshot(query(collection(shopRef, "udhar"), where("status", "==", "pending")), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Udhar));
      setUdharList(data);
      localStorage.setItem('lekha_udhar', JSON.stringify(data));
    });

    const unsubReports = onSnapshot(
      query(collection(shopRef, "monthlyReports"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MonthlyReport));
        setMonthlyReports(data);
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
    if (!user || !shop || archivalDone) return;
    setArchivalDone(true);

    const runArchival = async () => {
      try {
        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        const reportId = `${prevMonth.getFullYear()}-${(prevMonth.getMonth() + 1).toString().padStart(2, '0')}`;
        const reportName = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const reportRef = doc(db, "shops", user.uid, "monthlyReports", reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) return; // Already generated

        // Fetch ALL bills (not just cached) for previous month
        const billsQuery = query(
          collection(doc(db, "shops", user.uid), "bills"),
          orderBy("created_at", "desc")
        );
        const billsSnap = await getDocs(billsQuery);
        const allBills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Bill));

        const prevMonthBills = allBills.filter(b => {
          const d = ensureDate(b.created_at);
          return d >= prevMonth && d <= prevMonthEnd && !b.isArchived;
        });

        if (prevMonthBills.length === 0) return; // Nothing to archive

        const totalSales = prevMonthBills.reduce((a, b) => a + b.total_amount, 0);
        const totalProfit = prevMonthBills.reduce((a, b) => a + (b.total_profit || 0), 0);

        // Item-level stats
        const itemStats: Record<string, { name: string; profit: number }> = {};
        prevMonthBills.forEach(bill => {
          bill.items?.forEach((item: any) => {
            const n = item.name || item.product_name || 'Unknown';
            if (!itemStats[n]) itemStats[n] = { name: n, profit: 0 };
            itemStats[n].profit += (item.price || 0) * (item.quantity || 1);
          });
        });
        const sortedItems = Object.values(itemStats).sort((a, b) => b.profit - a.profit);
        const bestItem = sortedItems[0] || { name: '-', profit: 0 };
        const worstItem = sortedItems[sortedItems.length - 1] || { name: '-', profit: 0 };

        // Profit trend by date
        const trendMap: Record<string, number> = {};
        prevMonthBills.forEach(b => {
          const d = ensureDate(b.created_at);
          const key = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          trendMap[key] = (trendMap[key] || 0) + (b.total_profit || 0);
        });
        const profitTrend = Object.entries(trendMap).map(([dateStr, profit]) => ({ dateStr, profit }));

        // Check previous-previous month for comparison
        const ppMonthId = `${new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 1, 1).getFullYear()}-${(new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 1, 1).getMonth() + 1).toString().padStart(2, '0')}`;
        const ppReportSnap = await getDoc(doc(db, "shops", user.uid, "monthlyReports", ppMonthId));
        let comparisonWithLastMonth = 0;
        if (ppReportSnap.exists()) {
          const ppData = ppReportSnap.data();
          if (ppData.totalSales > 0) {
            comparisonWithLastMonth = Math.round(((totalSales - ppData.totalSales) / ppData.totalSales) * 100);
          }
        }

        const reportData: Omit<MonthlyReport, 'id'> = {
          monthStr: reportName,
          totalSales,
          totalProfit,
          totalBills: prevMonthBills.length,
          bestItem,
          worstItem,
          profitTrend,
          comparisonWithLastMonth,
          createdAt: Timestamp.now(),
          templateVersion: 'v1'
        };

        await setDoc(reportRef, reportData);

        // Archive old bills in batch
        const batch = writeBatch(db);
        prevMonthBills.forEach(b => {
          batch.update(doc(db, "shops", user.uid, "bills", b.id), { isArchived: true });
        });
        await batch.commit();

        setShowReportPopup({ id: reportId, ...reportData } as MonthlyReport);
      } catch (err) {
        console.error('Monthly archival error:', err);
      }
    };

    runArchival();
  }, [user, shop, archivalDone]);

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

  const checkWhatsAppLimit = React.useCallback(async () => {
    if (isProUser) return true;
    if (!user || !shop) return false;
    
    const todayStr = new Date().toDateString();
    let currentCount = shop.whatsappCount || 0;
    if (shop.lastWhatsappDate !== todayStr) currentCount = 0;
    
    if (currentCount >= 10) return false;
    
    try {
      await updateDoc(doc(db, "shops", user.uid), {
        whatsappCount: currentCount + 1,
        lastWhatsappDate: todayStr
      });
      setShop({ ...shop, whatsappCount: currentCount + 1, lastWhatsappDate: todayStr });
      return true;
    } catch (err) {
      console.error("WhatsApp Limit Update Error:", err);
      return false;
    }
  }, [isProUser, shop, user, setShop]);

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
    checkWhatsAppLimit,
    showReportPopup,
    dismissReportPopup
  }), [user, shop, loading, lang, customers, products, bills, udharList, monthlyReports, error, login, handleLogout, isProUser, isPlanExpired, checkWhatsAppLimit, showReportPopup, dismissReportPopup]);

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
