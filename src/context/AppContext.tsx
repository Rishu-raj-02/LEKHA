import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  loginWithGoogle,
  logout
} from '../firebase';
import { Shop, Customer, Product, Bill, Udhar } from '../types';

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
  setShop: (shop: Shop | null) => void;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
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

    const unsubBills = onSnapshot(query(collection(shopRef, "bills"), orderBy("created_at", "desc"), limit(50)), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));
      setBills(data);
      localStorage.setItem('lekha_bills', JSON.stringify(data));
    });

    const unsubUdhar = onSnapshot(query(collection(shopRef, "udhar"), where("status", "==", "pending")), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Udhar));
      setUdharList(data);
      localStorage.setItem('lekha_udhar', JSON.stringify(data));
    });

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubBills();
      unsubUdhar();
    };
  }, [user, shop]);

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
    setShop,
    error,
    login,
    logout: handleLogout,
  }), [user, shop, loading, lang, customers, products, bills, udharList, error, login, handleLogout]);

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
