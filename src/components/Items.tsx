import React, { useState, useMemo } from 'react';
import { Search, X, Package, Plus, Minus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { HighlightedText } from "./ui/HighlightedText";
import { useDebounce } from '../hooks/useDebounce';
import { cn } from '../utils/helpers';
import { translations } from '../translations';

interface ItemsProps {
  setShowAddProduct: (v: boolean) => void;
}

export const Items = React.memo(({ setShowAddProduct }: ItemsProps) => {
  const { products, lang, isProUser, updateProductStock, deleteProduct } = useApp();
  const t = translations[lang];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState<string>("");

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
                {isProUser && typeof p.stockQuantity === 'number' && p.stockQuantity <= 10 && (
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
                    p.stockQuantity <= 5 ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"
                  )}>
                    {t.lowStockAlert} ({p.stockQuantity})
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
                  <div className="flex flex-col items-end gap-2">
                    {typeof p.costPrice === 'number' && p.costPrice > 0 && (
                      <p className="text-[9px] text-gray-400 font-bold uppercase">CP: ₹{p.costPrice}</p>
                    )}
                    
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                        <button 
                          onClick={() => updateProductStock(p.id, Math.max(0, (p.stockQuantity || 0) - 1))}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90 transition-transform"
                        >
                          <Minus size={12} strokeWidth={3} />
                        </button>
                        
                        {editingId === p.id ? (
                          <input 
                            autoFocus
                            type="number"
                            value={stockInput}
                            onChange={(e) => setStockInput(e.target.value)}
                            onBlur={() => {
                              updateProductStock(p.id, Number(stockInput) || 0);
                              setEditingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateProductStock(p.id, Number(stockInput) || 0);
                                setEditingId(null);
                              }
                            }}
                            className="w-10 h-7 text-center bg-white text-[10px] font-black outline-none border-x border-gray-100"
                          />
                        ) : (
                          <div 
                            onClick={() => {
                              setEditingId(p.id);
                              setStockInput(String(p.stockQuantity || 0));
                            }}
                            className="px-2 min-w-[28px] h-7 flex items-center justify-center text-center font-black text-gray-800 text-[10px] cursor-text hover:bg-white transition-colors"
                          >
                            {p.stockQuantity || 0}
                          </div>
                        )}

                        <button 
                          onClick={() => updateProductStock(p.id, (p.stockQuantity || 0) + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-green-600 active:scale-90 transition-transform"
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>

                      <button 
                        onClick={() => {
                          if (window.confirm(t.deleteConfirm || "Are you sure?")) {
                            deleteProduct(p.id);
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-transform hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">Stock Level</p>
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
