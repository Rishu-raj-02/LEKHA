import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import { MonthlyReport } from '../types';
import { ReportTemplate } from './ReportTemplate';
import { Modal } from './ui/Modal';
import { motion } from 'motion/react';
import { Crown, Lock, FileText, Download, Eye, CalendarDays, TrendingUp, IndianRupee, AlertTriangle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Timestamp, updateDoc, doc, db } from '../firebase';

const fmtFull = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const Reports = React.memo(() => {
  const { monthlyReports, shop, isProUser, lang, user, setShop } = useApp();
  const t = translations[lang];
  const [viewReport, setViewReport] = useState<MonthlyReport | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!reportRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `Lekha_Report_${viewReport?.monthStr?.replace(/\s+/g, '_') || 'report'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Report download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isProUser) {
    const openRazorpayCheckout = () => {
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: 4900,
        currency: "INR",
        name: t.appName || "Lekha",
        description: "Pro Subscription (1 Month)",
        handler: async function (response: any) {
          try {
            const planStart = Timestamp.now();
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            const planExpiry = Timestamp.fromDate(expiryDate);
            await updateDoc(doc(db, "shops", user!.uid), { isPro: true, planType: "pro", planStart, planExpiry });
            setShop({ ...shop!, isPro: true, planType: "pro", planStart, planExpiry });
          } catch (error) {
            console.error(error);
          }
        },
        prefill: { name: shop?.owner_name, email: user?.email, contact: shop?.phone },
        theme: { color: "#16a34a" }
      };
      new (window as any).Razorpay(options).open();
    };

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 blur-md bg-gray-50 flex flex-col gap-4 p-4">
           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm h-64 w-full"></div>
           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm h-48 w-full"></div>
        </div>
        <div className="relative z-10 bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-xl border border-gray-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-[1.5rem] mx-auto flex items-center justify-center mb-6 shadow-sm border-2 border-green-100">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">{t.monthlyReports || "Monthly Reports"}</h2>
          <p className="text-gray-500 mb-8 font-medium text-sm leading-relaxed">{t.proReportMsg || "Upgrade to unlock professional reports."}</p>
          <button
            onClick={openRazorpayCheckout}
            className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Crown size={20} /> {t.upgradeToPro || "Upgrade"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center">
          <CalendarDays size={16} className="text-purple-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">{t.monthlyReports || "Monthly Reports"}</h3>
          <p className="text-[10px] text-gray-400 font-medium">Calendar month archives</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl">
        <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
          📅 Reports are auto-generated on the 1st of every month. Each report contains previous month's complete data.
        </p>
      </div>

      {monthlyReports.length === 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full mx-auto flex items-center justify-center mb-4">
            <FileText size={28} className="text-gray-300" />
          </div>
          <h4 className="font-bold text-gray-700 mb-1">{t.noReports || "No Reports Yet"}</h4>
          <p className="text-xs text-gray-400">Reports will appear here after the first month-end.</p>
        </div>
      )}

      <div className="space-y-3">
        {monthlyReports.map((report, idx) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm"
          >
            {/* Report Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <FileText size={18} className="text-purple-500" />
                </div>
                <div>
                  <h4 className="font-black text-gray-800 text-sm">{report.monthStr}</h4>
                  <p className="text-[10px] text-gray-400 font-bold">{report.totalBills} {t.totalBillsMonth || "Bills"}</p>
                </div>
              </div>
              {report.comparisonWithLastMonth !== 0 && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${
                  report.comparisonWithLastMonth > 0 
                    ? 'bg-green-50 text-green-600' 
                    : 'bg-red-50 text-red-600'
                }`}>
                  <TrendingUp size={10} className={report.comparisonWithLastMonth < 0 ? "rotate-180" : ""} />
                  {Math.abs(report.comparisonWithLastMonth)}%
                </div>
              )}
            </div>

            {/* Report Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-green-50 p-3 rounded-xl flex items-center gap-2">
                <IndianRupee size={14} className="text-green-600" />
                <div>
                  <p className="text-[8px] font-bold text-green-600 uppercase">{t.totalSalesMonth || "Sales"}</p>
                  <p className="text-sm font-black text-green-700">{fmtFull(report.totalSales)}</p>
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl flex items-center gap-2">
                <TrendingUp size={14} className="text-blue-600" />
                <div>
                  <p className="text-[8px] font-bold text-blue-600 uppercase">{t.totalProfitMonth || "Profit"}</p>
                  <p className="text-sm font-black text-blue-700">{fmtFull(report.totalProfit)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-purple-50 p-3 rounded-xl flex items-center gap-2">
                <FileText size={14} className="text-purple-600" />
                <div>
                  <p className="text-[8px] font-bold text-purple-600 uppercase">{t.bestItemMonth || "Best Item"}</p>
                  <p className="text-xs font-black text-gray-800 truncate">{report.bestItem?.name || '-'}</p>
                </div>
              </div>
              {report.totalUdhar != null && report.totalUdhar > 0 && (
                <div className="bg-red-50 p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <div>
                    <p className="text-[8px] font-bold text-red-600 uppercase">{t.totalUdharReport || "Udhar"}</p>
                    <p className="text-sm font-black text-red-700">{fmtFull(report.totalUdhar)}</p>
                  </div>
                </div>
              )}
              {(report.totalUdhar == null || report.totalUdhar === 0) && (
                <div className="bg-orange-50 p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} className="text-orange-500" />
                  <div>
                    <p className="text-[8px] font-bold text-orange-600 uppercase">{t.worstItemMonth || "Least Item"}</p>
                    <p className="text-xs font-black text-gray-800 truncate">{report.worstItem?.name || '-'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewReport(report)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 hover:bg-gray-200 active:scale-[0.98] transition-all"
              >
                <Eye size={14} /> {t.viewReport || "View"}
              </button>
              <button
                onClick={() => {
                  setViewReport(report);
                  setTimeout(() => handleDownload(), 500);
                }}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 hover:bg-green-700 active:scale-[0.98] transition-all"
              >
                <Download size={14} /> {t.downloadReport || "Download"}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View Report Modal */}
      <Modal isOpen={!!viewReport} onClose={() => setViewReport(null)} title={viewReport?.monthStr || 'Report'}>
        <div className="overflow-auto max-h-[70vh] -mx-4">
          {viewReport && (
            <ReportTemplate
              ref={reportRef}
              report={viewReport}
              shopName={shop?.shop_name || ''}
              ownerName={shop?.owner_name || ''}
            />
          )}
        </div>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isDownloading ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <><Download size={18} /> {t.downloadReport || "Download"}</>
          )}
        </button>
      </Modal>
    </div>
  );
});
