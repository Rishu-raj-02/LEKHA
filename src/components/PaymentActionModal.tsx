import React from 'react';
import { ScanLine, CheckCircle2, User, X } from 'lucide-react';
import { cn } from '../utils/helpers';

interface PaymentActionModalProps {
  isOpen: boolean;
  total: number;
  shop: any; // expected Shop interface
  customer: { name: string; phone?: string | null };
  onUPI: () => void;
  onCash: () => void;
  onUdhar: () => void;
  onCancel: () => void;
}

export const PaymentActionModal: React.FC<PaymentActionModalProps> = ({
  isOpen,
  total,
  shop,
  customer,
  onUPI,
  onCash,
  onUdhar,
  onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6 max-w-md mx-auto text-center mt-6">
      <div>
        <h3 className="text-xl font-black text-gray-800">Select Payment Method</h3>
        <p className="text-xs text-gray-400 mt-1">Choose how the customer will pay for this bill</p>
      </div>
      {/* UPI QR Option */}
      <button
        onClick={onUPI}
        className="w-full p-4 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-3xl border border-purple-100 flex items-center justify-between font-bold active:scale-[0.98] transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500 text-white rounded-2xl">
            <ScanLine size={20} />
          </div>
          <div>
            <p className="font-black text-base">UPI QR Code</p>
            <p className="text-xs text-purple-500 font-medium">Generate QR for customer scan</p>
          </div>
        </div>
        <span className="text-purple-400 font-bold">→</span>
      </button>

      {/* Cash Received Option */}
      <button
        onClick={onCash}
        className="w-full p-4 bg-green-50 text-green-700 hover:bg-green-100 rounded-3xl border border-green-100 flex items-center justify-between font-bold active:scale-[0.98] transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-500 text-white rounded-2xl">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="font-black text-base">Cash Received</p>
            <p className="text-xs text-green-500 font-medium">Mark payment as fully paid</p>
          </div>
        </div>
        <span className="text-green-400 font-bold">→</span>
      </button>

      {/* Mark as Udhar Option */}
      <button
        onClick={onUdhar}
        className="w-full p-4 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-3xl border border-orange-100 flex items-center justify-between font-bold active:scale-[0.98] transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500 text-white rounded-2xl">
            <User size={20} />
          </div>
          <div>
            <p className="font-black text-base">Mark as Udhar</p>
            <p className="text-xs text-orange-500 font-medium">Save bill as pending/credit</p>
          </div>
        </div>
        <span className="text-orange-400 font-bold">→</span>
      </button>

      {/* Cancel / Void */}
      <button
        onClick={onCancel}
        className="w-full py-3 text-xs text-red-500 font-bold hover:text-red-700 active:scale-95 transition-transform"
      >
        Cancel &amp; Void Bill
      </button>
    </div>
  );
};
