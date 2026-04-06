import React, { forwardRef } from 'react';
import { MonthlyReport } from '../types';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';

interface ReportTemplateProps {
  report: MonthlyReport;
  shopName: string;
  ownerName: string;
}

export const ReportTemplate = forwardRef<HTMLDivElement, ReportTemplateProps>(({ report, shopName, ownerName }, ref) => {
  const { lang } = useApp();
  const t = translations[lang];
  const maxTrend = Math.max(...(report.profitTrend || []).map(p => Math.abs(p.profit)), 1);

  return (
    <div ref={ref} className="bg-[#ffffff] text-[#1f2937] p-6 mx-auto border border-[#e5e7eb]" style={{ width: '420px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div className="text-center border-b-2 border-[#16a34a] pb-4 mb-5">
        <h1 className="text-3xl font-black tracking-tight text-[#111827] uppercase m-0">LEKHA</h1>
        <p className="text-xs text-[#6b7280] font-medium uppercase tracking-widest mt-1">{t.monthlyReports || "Monthly Business Report"}</p>
        <p className="text-lg font-bold text-[#16a34a] mt-2">{report.monthStr}</p>
      </div>

      {/* Shop Info */}
      <div className="mb-5 text-sm">
        <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-1">{t.profile || "Business"}</p>
        <p className="font-bold text-[#1f2937]">{shopName}</p>
        <p className="text-[#4b5563]">{ownerName}</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-5">
        <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-3">{t.insights || "Summary"}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-[9px] font-bold text-[#16a34a] uppercase">{t.totalSalesMonth || "Sales"}</p>
            <p className="text-lg font-black text-[#166534]">₹{report.totalSales}</p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <p className="text-[9px] font-bold text-[#2563eb] uppercase">{t.totalProfitMonth || "Profit"}</p>
            <p className="text-lg font-black text-[#1e40af]">₹{report.totalProfit}</p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe' }}>
            <p className="text-[9px] font-bold text-[#7c3aed] uppercase">{t.totalBillsMonth || "Bills"}</p>
            <p className="text-lg font-black text-[#5b21b6]">{report.totalBills}</p>
          </div>
          {report.totalUdhar != null && (
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-[9px] font-bold text-[#dc2626] uppercase">{t.totalUdharReport || "Udhar"}</p>
              <p className="text-lg font-black text-[#991b1b]">₹{report.totalUdhar}</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance */}
      <div className="mb-5">
        <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-3">{t.salesAnalytics || "Performance"}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-[9px] font-bold text-[#16a34a] uppercase">🏆 {t.bestItemMonth || "Best Product"}</p>
            <p className="font-bold text-sm text-[#1f2937] mt-1">{report.bestItem?.name || '-'}</p>
            <p className="text-xs text-[#16a34a] font-bold">₹{report.bestItem?.profit || 0}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
            <p className="text-[9px] font-bold text-[#dc2626] uppercase">⚠️ {t.worstItemMonth || "Worst Product"}</p>
            <p className="font-bold text-sm text-[#1f2937] mt-1">{report.worstItem?.name || '-'}</p>
            <p className="text-xs text-[#dc2626] font-bold">₹{report.worstItem?.profit || 0}</p>
          </div>
        </div>
      </div>

      {/* Profit Trend */}
      {report.profitTrend && report.profitTrend.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-3">{t.profitTrendMonth || "Profit Trend"}</p>
          <div className="flex items-end justify-between p-3 rounded-lg h-24" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            {report.profitTrend.slice(0, 15).map((pt, i) => {
              const h = (Math.abs(pt.profit) / maxTrend) * 100;
              return (
                <div key={i} className="flex flex-col items-center flex-1" style={{ gap: '4px' }}>
                  <div className="flex items-end justify-center" style={{ height: '48px', width: '100%' }}>
                    <div style={{
                      width: '60%',
                      maxWidth: '10px',
                      height: `${Math.max(8, h)}%`,
                      backgroundColor: pt.profit >= 0 ? '#4ade80' : '#f87171',
                      borderRadius: '3px 3px 0 0'
                    }} />
                  </div>
                  <span className="font-bold" style={{ fontSize: '6px', color: '#9ca3af' }}>{pt.dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparison Insight */}
      {report.comparisonWithLastMonth !== 0 && (
        <div className="p-3 rounded-lg mb-5 text-sm font-medium" style={{
          backgroundColor: report.comparisonWithLastMonth > 0 ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${report.comparisonWithLastMonth > 0 ? '#bbf7d0' : '#fecaca'}`,
          color: report.comparisonWithLastMonth > 0 ? '#166534' : '#991b1b'
        }}>
          {report.comparisonWithLastMonth > 0
            ? `📈 ${t.salesIncreased || "Sales increased!"} (${report.comparisonWithLastMonth}%)`
            : `📉 ${t.salesDecreased || "Sales decreased."} (${Math.abs(report.comparisonWithLastMonth)}%)`}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#d1d5db] pt-4 mt-4 text-center">
        <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-widest">Generated by Lekha</p>
        <p className="text-[9px] text-[#d1d5db] mt-1">Smart Billing System</p>
      </div>
    </div>
  );
});
ReportTemplate.displayName = 'ReportTemplate';
