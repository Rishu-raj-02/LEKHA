import React, { forwardRef } from 'react';
import { Shop, Customer } from '../types';
import { formatPhone } from '../utils/helpers';

interface BillTemplateProps {
  shop: Shop;
  customer?: Customer;
  items: { id: string; name: string; price: number; quantity: number }[];
  total: number;
  billStatus: "paid" | "pending";
  billId?: string;
}

export const BillTemplate = forwardRef<HTMLDivElement, BillTemplateProps>(({ shop, customer, items, total, billStatus, billId }, ref) => {
  return (
    <div ref={ref} className="bg-[#ffffff] text-[#1f2937] p-5 mx-auto border border-[#e5e7eb]" style={{ width: '400px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div className="text-center border-b border-[#d1d5db] pb-4 mb-4">
        <h1 className="text-3xl font-black tracking-tight text-[#111827] uppercase m-0">LEKHA</h1>
        <p className="text-xs text-[#6b7280] font-medium uppercase tracking-widest mt-1">Smart Billing System</p>
      </div>

      {/* Meta Info */}
      <div className="flex justify-between items-start text-xs text-[#4b5563] mb-4">
        <div>
          {billId && <p><span className="font-bold text-[#1f2937]">Bill No:</span> #{billId}</p>}
        </div>
        <div className="text-right">
          <p><span className="font-bold text-[#1f2937]">Date:</span> {new Date().toLocaleDateString()}</p>
          <p><span className="font-bold text-[#1f2937]">Time:</span> {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
      </div>

      {/* Bill From & To */}
      <div className="flex justify-between items-start mb-6 text-sm">
        <div className="flex-1 pr-2">
          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-1">Bill From</p>
          <p className="font-bold text-[#1f2937]">{shop.shop_name}</p>
          <p className="text-[#4b5563]">{shop.owner_name}</p>
          <p className="text-[#4b5563]">{formatPhone(shop.phone)}</p>
        </div>
        <div className="flex-1 pl-2 text-right">
          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-1">Bill To</p>
          {customer ? (
            <>
              <p className="font-bold text-[#1f2937]">{customer.name}</p>
              <p className="text-[#4b5563]">{customer.phone}</p>
            </>
          ) : (
            <p className="font-bold text-[#1f2937]">Walk-in Customer</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-6 text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#d1d5db]">
            <th className="text-left py-2 font-bold text-[#4b5563]">Item</th>
            <th className="text-center py-2 font-bold text-[#4b5563]">Qty</th>
            <th className="text-right py-2 font-bold text-[#4b5563]">Price</th>
            <th className="text-right py-2 font-bold text-[#4b5563]">Total</th>
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
            {billStatus === 'paid' ? 'PAID' : 'PENDING'}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-[#6b7280] uppercase">Total Amount</p>
          <p className="text-2xl font-black text-[#111827] mt-1">Rs {total}</p>
        </div>
      </div>

      {/* Terms & Footer */}
      <div className="border-t border-[#d1d5db] pt-4 mt-8 flex flex-col gap-4 text-[10px] text-[#6b7280]">
        <div>
          <p className="font-bold text-[#374151] uppercase mb-1">Terms</p>
          <ul className="list-disc pl-4 space-y-0.5">
             <li>Prices are inclusive of all taxes.</li>
             <li>Goods once sold will not be returned.</li>
             <li>Thank you for your business.</li>
          </ul>
        </div>
        <div className="text-center font-bold text-[#1f2937] text-sm mt-2">
          Thank you! Visit Again
        </div>
      </div>
    </div>
  );
});
BillTemplate.displayName = 'BillTemplate';
