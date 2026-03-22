export interface Shop {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  created_at: any;
  isPro?: boolean;
  planType?: "free" | "pro";
  planStart?: any;
  planExpiry?: any;
  whatsappCount?: number;
  lastWhatsappDate?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  total_udhar: number;
  created_at: any;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
  stockQuantity?: number;
  costPrice?: number;
  sellingType?: "fixed" | "variable";
  lastUsedPrice?: number;
  minStock?: number;
}

export interface Bill {
  id: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  total_cost?: number;
  total_profit?: number;
  created_at: any;
  items?: BillItem[]; 
  isArchived?: boolean;
}

export interface BillItem {
  id: string;
  product_name: string;
  price: number;
  quantity: number;
  cost_price?: number;
}

export interface Udhar {
  id: string;
  customer_id: string;
  customer_name?: string;
  amount: number;
  status: "pending" | "paid";
  due_date?: string;
  created_at: any;
}

export interface Expense {
  id: string; 
  electricity: number;
  rent: number;
  staff: number;
  other: number;
  updated_at?: any;
}

export interface MonthlyReport {
  id: string; 
  monthStr: string; 
  totalSales: number;
  totalProfit: number;
  totalBills: number;
  bestItem: { name: string; profit: number };
  worstItem: { name: string; profit: number };
  profitTrend: { dateStr: string; profit: number }[];
  comparisonWithLastMonth: number;
  createdAt: any;
  templateVersion: string;
}
