import React, { forwardRef } from 'react';
import { Shop, Customer } from '../types';
import { formatPhone } from '../utils/helpers';

interface BillTemplateProps {
  shop: Shop;
  customer?: Customer | { name: string; phone: string | null };
  items: { id: string; name: string; price: number; quantity: number }[];
  total: number;
  billStatus: "paid" | "pending" | "udhar";
  billId?: string;
  lang?: "en" | "hi";
}

const templateTranslations = {
  en: {
    system: "Smart Billing System",
    billNo: "Bill No",
    date: "Date",
    time: "Time",
    billFrom: "Bill From",
    billTo: "Bill To",
    walkIn: "Walk-in Customer",
    item: "Item",
    qty: "Qty",
    price: "Price",
    total: "Total",
    totalAmount: "Total Amount",
    terms: "Terms",
    taxInc: "Prices are inclusive of all taxes.",
    noReturn: "Goods once sold will not be returned.",
    thanksBiz: "Thank you for your business.",
    visitAgain: "Thank you! Visit Again"
  },
  hi: {
    system: "स्मार्ट बिलिंग सिस्टम",
    billNo: "बिल नंबर",
    date: "दिनांक",
    time: "समय",
    billFrom: "दुकानदार",
    billTo: "ग्राहक",
    walkIn: "सामान्य ग्राहक",
    item: "सामान",
    qty: "मात्रा",
    price: "दाम",
    total: "कुल",
    totalAmount: "कुल राशि",
    terms: "शर्तें",
    taxInc: "सभी कर शामिल हैं।",
    noReturn: "बिका हुआ माल वापस नहीं होगा।",
    thanksBiz: "खरीदारी के लिए धन्यवाद।",
    visitAgain: "धन्यवाद! फिर पधारें"
  }
};

export const BillTemplate = forwardRef<HTMLDivElement, BillTemplateProps>(({ shop, customer, items, total, billStatus, billId, lang = "en" }, ref) => {
  const t = templateTranslations[lang];
  return (
    <div ref={ref} className="bg-[#ffffff] text-[#1f2937] p-5 mx-auto border border-[#e5e7eb]" style={{ width: '400px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div className="text-center border-b border-[#d1d5db] pb-4 mb-4">
        <h1 className="text-3xl font-black tracking-tight text-[#111827] uppercase m-0">LEKHA</h1>
        <p className="text-xs text-[#6b7280] font-medium uppercase tracking-widest mt-1">{t.system}</p>
      </div>

      {/* Meta Info */}
      <div className="flex justify-between items-start text-xs text-[#4b5563] mb-4">
        <div>
          {billId && <p><span className="font-bold text-[#1f2937]">{t.billNo}:</span> #{billId.slice(-6).toUpperCase()}</p>}
        </div>
        <div className="text-right">
          <p><span className="font-bold text-[#1f2937]">{t.date}:</span> {new Date().toLocaleDateString()}</p>
          <p><span className="font-bold text-[#1f2937]">{t.time}:</span> {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
      </div>

      {/* Bill From & To */}
      <div className="flex justify-between items-start mb-6 text-sm">
        <div className="flex-1 pr-2">
          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-1">{t.billFrom}</p>
          <p className="font-bold text-[#1f2937]">{shop.shop_name}</p>
          <p className="text-[#4b5563]">{shop.owner_name}</p>
          <p className="text-[#4b5563]">{formatPhone(shop.phone)}</p>
        </div>
        <div className="flex-1 pl-2 text-right">
          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-1">{t.billTo}</p>
          {customer && (customer.name || customer.phone) ? (
            <>
              <p className="font-bold text-[#1f2937]">{customer.name || t.walkIn}</p>
              {customer.phone && <p className="text-[#4b5563]">{customer.phone}</p>}
            </>
          ) : (
            <p className="font-bold text-[#1f2937]">{t.walkIn}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-6 text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#d1d5db]">
            <th className="text-left py-2 font-bold text-[#4b5563]">{t.item}</th>
            <th className="text-center py-2 font-bold text-[#4b5563]">{t.qty}</th>
            <th className="text-right py-2 font-bold text-[#4b5563]">{t.price}</th>
            <th className="text-right py-2 font-bold text-[#4b5563]">{t.total}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-[#f3f4f6]">
              <td className="py-3 text-[#1f2937]">{item.name}</td>
              <td className="py-3 text-center text-[#4b5563]">{item.quantity}</td>
              <td className="py-3 text-right text-[#4b5563]">Rs {item.price}</td>
              <td className="py-3 text-right font-bold text-[#1f2937]">Rs {item.price * item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className={`inline-block px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider ${billStatus === 'paid' ? 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]' : 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]'} border`}>
            {billStatus === 'paid' ? (lang === 'hi' ? 'पैसे मिल गए' : 'PAID') : (billStatus === 'udhar' ? (lang === 'hi' ? 'उधार' : 'UDHAR') : (lang === 'hi' ? 'बाकी' : 'PENDING'))}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-[#6b7280] uppercase">{t.totalAmount}</p>
          <p className="text-2xl font-black text-[#111827] mt-1">Rs {total}</p>
        </div>
      </div>

      {/* Terms & Footer */}
      <div className="border-t border-[#d1d5db] pt-4 mt-8 flex flex-col gap-4 text-[10px] text-[#6b7280]">
        <div>
          <p className="font-bold text-[#374151] uppercase mb-1">{t.terms}</p>
          <ul className="list-disc pl-4 space-y-0.5">
             <li>{t.taxInc}</li>
             <li>{t.noReturn}</li>
             <li>{t.thanksBiz}</li>
          </ul>
        </div>
        <div className="text-center font-bold text-[#1f2937] text-sm mt-2">
          {t.visitAgain}
        </div>
      </div>
    </div>
  );
});
BillTemplate.displayName = 'BillTemplate';
