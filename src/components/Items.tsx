import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Package, Plus, Minus, Trash2, Camera, RefreshCw, ChevronRight } from "lucide-react";
import Fuse from 'fuse.js';
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { HighlightedText } from "./ui/HighlightedText";
import { useDebounce } from '../hooks/useDebounce';
import { cn } from '../utils/helpers';
import { translations } from '../translations';
import { Product } from '../types';

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

  // --- SCANNER LOGIC / STEP 4 OPTIMIZATIONS ---
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "found" | "did_you_mean" | "error">("idle");
  const [scannedData, setScannedData] = useState<{ name: string; id?: string; stock?: number; suggestions?: Product[] } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const workerRef = useRef<any>(null); // Store Tesseract Web Worker

  useEffect(() => {
    return () => stopScanning();
  }, []);

  const startScanning = async () => {
    setIsScanning(true);
    setScanStatus("scanning");
    setScannedData(null);
    try {
      // 1. Low resolution camera for faster processing
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      
      // 2. Initialize Web Worker ONCE to prevent UI lag
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.default.createWorker('eng', 1, {
         logger: () => {} 
      });
      // Restrict characters specifically
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '
      });
      workerRef.current = worker;
      
      // 3. Timeout System: Error out after 7 seconds
      scanTimeoutRef.current = setTimeout(() => {
        setScanStatus("error");
        stopScanning(false);
      }, 7000);

      processFrames();
    } catch (err) {
      console.error("Camera error:", err);
      setScanStatus("error");
    }
  };

  const stopScanning = (closeUI = true) => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    
    // Stop Camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    
    // Terminate Web Worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    if (closeUI) {
      setIsScanning(false);
      setScanStatus("idle");
      setScannedData(null);
    }
  };

  const processFrames = () => {
    // 4. Control Scan Frequency: Every 2.5s
    scanIntervalRef.current = setInterval(async () => {
      if (scanStatus === "found" || scanStatus === "not_found" || scanStatus === "error") {
         if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
         return;
      }

      if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && workerRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        const cropWidth = video.videoWidth * 0.8;
        const cropHeight = video.videoHeight * 0.3;
        const startX = (video.videoWidth - cropWidth) / 2;
        const startY = (video.videoHeight - cropHeight) / 2;

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Apply visual filters specifically to help OCR engine
        ctx.filter = "grayscale(100%) contrast(200%) brightness(120%)";
        ctx.drawImage(video, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        ctx.filter = "none";
        
        try {
          const { data: { text } } = await workerRef.current.recognize(canvas);
          const cleanText = text.replace(/[^a-zA-Z ]/g, "").trim();
          
          if (cleanText.length > 2) { 
             const lowerText = cleanText.toLowerCase();
             
             // Exact Match verification first
             const exactMatch = products.find(p => p.name.toLowerCase() === lowerText);
             
             if (exactMatch) {
                setScannedData({ name: exactMatch.name, id: exactMatch.id, stock: exactMatch.stockQuantity || 0 });
                setScanStatus("found");
             } else {
                // Fuzzy search logic using fuse.js
                const fuse = new Fuse(products, {
                  keys: ['name'],
                  threshold: 0.4
                });
                const result = fuse.search(cleanText);

                if (result.length > 0) {
                   setScannedData({ name: cleanText, suggestions: result.slice(0, 3).map(r => r.item) });
                   setScanStatus("did_you_mean");
                } else {
                   // Completely unidentifiable or entirely new string
                   setScanStatus("error");
                }
             }
             // 5. Stop camera after detection
             stopScanning(false);
          }
        } catch (err) {
          console.error("OCR error:", err);
        }
      }
    }, 2500); 
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
          onClick={startScanning}
          className="bg-gray-800 text-white shadow-lg px-4 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm hover:scale-105 active:scale-95 transition-all w-auto whitespace-nowrap"
        >
          <Camera size={18} /> Scan Product
        </button>
        <button
          onClick={() => setShowAddProduct(true)}
          className="bg-green-600 text-white shadow-[0_20px_50px_rgba(22,163,74,0.3)] px-4 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm hover:scale-105 active:scale-95 transition-all w-auto whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={3} /> Add Item
        </button>
      </div>

      {/* Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center">
           <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className="absolute w-full h-full object-cover opacity-60"
           />
           <canvas ref={canvasRef} className="hidden" />
           
           <div className="relative z-10 w-full px-6 flex flex-col items-center">
             <div className="w-full aspect-[3/1] border-2 border-dashed border-green-500 rounded-2xl relative bg-green-500/10 backdrop-blur-[2px]">
                <div className="absolute inset-0 bg-green-500/20 animate-pulse rounded-2xl"></div>
             </div>
             <p className="text-white font-bold mt-6 text-center text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Align product name inside box
             </p>
             
             {(scanStatus === "scanning" || scanStatus === "idle") && (
                <div className="mt-6 flex items-center gap-2 text-green-400 font-bold bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-2xl">
                  <RefreshCw className="animate-spin" size={16} /> Scanning text...
                </div>
             )}
             
             {scanStatus === "error" && (
                <div className="mt-10 bg-white p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-5">
                  <h3 className="text-xl font-black text-gray-800 mb-2">Could not detect clearly</h3>
                  <div className="flex flex-col gap-3 mt-4">
                    <button onClick={startScanning} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><RefreshCw size={16} /> Try Again</button>
                    <button onClick={() => { stopScanning(); setShowAddProduct(true); }} className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">Add Manually</button>
                  </div>
                </div>
             )}

             {scanStatus === "found" && scannedData && (
                <div className="mt-10 bg-white p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-5">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Item already exists</h3>
                  <p className="text-2xl font-black text-gray-800 mt-2">{scannedData.name}</p>
                  <p className="text-lg font-bold text-green-600 mt-1">Stock: {scannedData.stock}</p>
                  <div className="flex flex-col gap-3 mt-6">
                    <button onClick={() => { handleUpdateStock(scannedData.id!, (scannedData.stock || 0) + 1); stopScanning(); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                       <Plus size={18} /> Add Stock
                    </button>
                    <button onClick={() => { setPrefillProductName(scannedData.name); stopScanning(); setShowAddProduct(true); }} className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">Add New</button>
                  </div>
                </div>
             )}
             
             {scanStatus === "did_you_mean" && scannedData && (
                <div className="mt-10 bg-white p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-5">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Detected Text:</h3>
                  <p className="text-xl font-black text-gray-400 mt-1 line-through decoration-red-500/50">{scannedData.name}</p>
                  
                  <div className="mt-6 mb-4">
                     <h4 className="text-sm font-black text-gray-800 text-left mb-2">Did you mean:</h4>
                     <div className="flex flex-col gap-2">
                        {scannedData.suggestions?.map((suggestion) => (
                           <button 
                              key={suggestion.id}
                              onClick={() => {
                                 setScannedData({ name: suggestion.name, id: suggestion.id, stock: suggestion.stockQuantity || 0 });
                                 setScanStatus("found");
                              }}
                              className="w-full flex items-center justify-between bg-gray-50 hover:bg-green-50 active:bg-green-100 p-4 rounded-xl transition-all border border-gray-100 font-bold text-gray-800 text-left group"
                           >
                              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> {suggestion.name}</span>
                              <ChevronRight size={16} className="text-gray-400 group-hover:text-green-600" />
                           </button>
                        ))}
                     </div>
                  </div>

                  <button 
                     onClick={() => { 
                        setPrefillProductName(scannedData.name); 
                        stopScanning(); 
                        setShowAddProduct(true); 
                     }} 
                     className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-[0_10px_40px_rgba(22,163,74,0.2)] hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                     Edit manually
                  </button>
                </div>
             )}
           </div>

           <button 
             onClick={stopScanning} 
             className="absolute top-6 right-6 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-all z-20 border border-white/10"
           >
             <X size={24} />
           </button>
        </div>
      )}
    </div>
  );
});
