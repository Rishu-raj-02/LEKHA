import React, { useState, useMemo } from 'react';
import { Search, X, Package, Plus, Minus, Trash2, Camera, RefreshCw, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { HighlightedText } from "./ui/HighlightedText";
import { useDebounce } from '../hooks/useDebounce';
import { cn } from '../utils/helpers';
import { translations } from '../translations';
import { Product } from '../types';
import { BarcodeScanner } from './BarcodeScanner';

interface ItemsProps {
  setShowAddProduct: (v: boolean) => void;
}

export const Items = React.memo(({ setShowAddProduct }: ItemsProps) => {
  const { products, lang, isProUser, updateProductStock, deleteProduct, recentlyUsedIds, markProductAsUsed, setPrefillProductName } = useApp();
  const t = translations[lang];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState<string>("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 100); // Faster search for "instant" feel

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => 
      (p.name?.toLowerCase() || "").includes(debouncedSearch.toLowerCase()) ||
      (p.category?.toLowerCase() || "").includes(debouncedSearch.toLowerCase())
    );
  }, [products, debouncedSearch]);

  const recentlyUsedProducts = useMemo(() => {
    return (recentlyUsedIds || [])
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => !!p);
  }, [recentlyUsedIds, products]);

  const handleUpdateStock = (productId: string, newStock: number) => {
    const finalStock = Math.max(0, Math.floor(newStock));
    updateProductStock(productId, finalStock);
    markProductAsUsed(productId);
  };

  // --- BARCODE SCANNER STATE ---
  const [isScanning, setIsScanning] = useState(false);

  const { setPrefillBarcode, setPrefillPrice, setPrefillCategory } = useApp();

  const handleBarcodeScanned = async (barcode: string) => {
    setIsScanning(false); // Unmount BarcodeScanner
    
    const { barcodeService } = await import('../services/barcodeService');
    const { match } = barcodeService.lookupBarcode(barcode);
    
    setPrefillBarcode(barcode);
    
    if (match) {
       setPrefillProductName(match.productName);
       setPrefillPrice(String(match.suggestedSellingPrice));
       setPrefillCategory(match.category || '');
    } else {
       setPrefillProductName('');
       setPrefillPrice('');
       setPrefillCategory('');
    }
    
    setShowAddProduct(true);
  };


  return (
    <div className="space-y-4 pb-24">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-green-500 transition-all font-medium" 
          placeholder="Search items quickly..." 
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

      {!search && recentlyUsedProducts.length > 0 && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Recently Used</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {recentlyUsedProducts.map(p => (
              <button
                key={`recent-${p.id}`}
                onClick={() => setSearch(p.name)}
                className="bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm text-left flex items-center gap-2 hover:bg-green-50 transition-all active:scale-95 flex-shrink-0"
              >
                <div className="w-6 h-6 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                  <Package size={14} />
                </div>
                <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{p.name}</span>
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={p.id} 
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-green-500 transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-green-500 transition-colors">
                  <Package size={20} />
                </div>
                {isProUser && typeof p.stockQuantity === 'number' && p.stockQuantity <= 10 && (
                  <span className={cn(
                    "text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse",
                    p.stockQuantity <= 5 ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"
                  )}>
                    ⚠️ Low stock ({p.stockQuantity})
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <p className="font-bold text-gray-800 text-sm line-clamp-1">
                  <HighlightedText text={p.name} highlight={debouncedSearch} />
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-green-600 font-black">₹{p.price}</p>
                  {isProUser && p.sellingType === 'variable' && (
                    <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Varied</span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-50 space-y-3">
                {isProUser && (
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      <button 
                        onClick={() => handleUpdateStock(p.id, (p.stockQuantity || 0) - 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90 transition-transform"
                      >
                        <Minus size={14} strokeWidth={3} />
                      </button>
                      
                      {editingId === p.id ? (
                        <input 
                          autoFocus
                          type="number"
                          value={stockInput}
                          onChange={(e) => setStockInput(e.target.value)}
                          onBlur={() => {
                            handleUpdateStock(p.id, Number(stockInput) || 0);
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateStock(p.id, Number(stockInput) || 0);
                              setEditingId(null);
                            }
                          }}
                          className="w-12 h-8 text-center bg-white text-xs font-black outline-none border-x border-gray-100"
                        />
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingId(p.id);
                            setStockInput(String(p.stockQuantity || 0));
                          }}
                          className="px-2 min-w-[32px] h-8 flex items-center justify-center text-center font-black text-gray-800 text-xs cursor-text hover:bg-white transition-colors"
                        >
                          {p.stockQuantity || 0}
                        </div>
                      )}

                      <button 
                        onClick={() => handleUpdateStock(p.id, (p.stockQuantity || 0) + 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-green-600 active:scale-90 transition-transform"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        if (window.confirm(t.deleteConfirm || "Are you sure?")) {
                          deleteProduct(p.id);
                        }
                      }}
                      className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-all hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter text-gray-400">
                  <span>{p.category || 'Standard'}</span>
                  {isProUser && typeof p.stockQuantity === 'number' && (
                    <span>Qty</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="fixed bottom-32 right-6 flex flex-col gap-3 z-[80] items-end">
        <button
          onClick={() => setIsScanning(true)}
          className="bg-gray-800 text-white shadow-lg px-4 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm hover:scale-105 active:scale-95 transition-all w-auto whitespace-nowrap"
        >
          <Camera size={18} /> Scan Barcode
        </button>
        <button
          onClick={() => setShowAddProduct(true)}
          className="bg-green-600 text-white shadow-[0_20px_50px_rgba(22,163,74,0.3)] px-4 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm hover:scale-105 active:scale-95 transition-all w-auto whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={3} /> Add Item
        </button>
      </div>

      {/* Isolated scanner — mounts/unmounts cleanly with its own lifecycle */}
      {isScanning && (
        <BarcodeScanner
          onScanned={handleBarcodeScanned}
          onClose={() => setIsScanning(false)}
        />
      )}
    </div>
  );
});
