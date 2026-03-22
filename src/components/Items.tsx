import React, { useState, useMemo } from 'react';
import { Search, X, Package, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { HighlightedText } from "./ui/HighlightedText";
import { translations } from "../translations";
import { useDebounce } from '../hooks/useDebounce';

interface ItemsProps {
  setShowAddProduct: (v: boolean) => void;
}

export const Items = React.memo(({ setShowAddProduct }: ItemsProps) => {
  const { products, lang, isProUser } = useApp();
  const t = translations[lang];

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => 
      (p.name?.toLowerCase() || "").includes(debouncedSearch.toLowerCase()) ||
      (p.category?.toLowerCase() || "").includes(debouncedSearch.toLowerCase())
    );
  }, [products, debouncedSearch]);

  return (
    <div className="space-y-4 pb-24">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-green-500 transition-all" 
          placeholder={t.search} 
        />
        {search && (
          <button 
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {!search && products.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.quickAdd}</h3>
          <div className="grid grid-cols-2 gap-2">
            {products.slice(0, 4).map(p => (
              <button
                key={`quick-${p.id}`}
                onClick={() => setSearch(p.name)}
                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left flex items-center gap-2 hover:bg-green-50 transition-colors"
              >
                <div className="w-6 h-6 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                  <Plus size={14} />
                </div>
                <span className="text-xs font-bold text-gray-700 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
          <Package size={48} className="mx-auto mb-3 opacity-10" />
          <p className="text-gray-400 text-sm font-medium">{t.noResults}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((p) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={p.id} 
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-green-500 transition-colors"
            >
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 mb-3">
                <Package size={20} />
              </div>
              <div className="flex justify-between items-start">
                <p className="font-bold text-gray-800 text-sm mb-1">
                  <HighlightedText text={p.name} highlight={debouncedSearch} />
                </p>
                {isProUser && typeof p.stockQuantity === 'number' && p.stockQuantity < (p.minStock || 0) && (
                  <span className="text-[9px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Low Stock
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <p className="text-green-600 font-black">₹{p.price}</p>
                {isProUser && p.sellingType === 'variable' && (
                  <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">Var</span>
                )}
              </div>

              <div className="flex justify-between items-end mt-2">
                {p.category ? (
                  <p className="text-[10px] text-gray-400 uppercase font-bold">
                    <HighlightedText text={p.category} highlight={debouncedSearch} />
                  </p>
                ) : <div/>}

                {isProUser && (
                  <div className="text-right">
                    {typeof p.costPrice === 'number' && p.costPrice > 0 && (
                      <p className="text-[9px] text-gray-400 font-bold uppercase">CP: ₹{p.costPrice}</p>
                    )}
                    {typeof p.stockQuantity === 'number' && (
                      <p className="text-[10px] text-gray-600 font-bold">{p.stockQuantity} in stock</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAddProduct(true)}
        className="fixed bottom-32 right-6 w-16 h-16 bg-green-600 text-white rounded-2xl shadow-[0_20px_50px_rgba(22,163,74,0.3)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[80]"
      >
        <Plus size={32} strokeWidth={3} />
      </button>
    </div>
  );
});
