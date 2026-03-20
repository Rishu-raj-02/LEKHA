export interface Shop {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  created_at: any;
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
}

export interface Bill {
  id: string;
  customer_id: string;
  total_amount: number;
  created_at: any;
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
