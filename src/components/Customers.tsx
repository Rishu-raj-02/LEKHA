import React, { useState, useMemo } from 'react';
import { Search, X, User as UserIcon, Phone, MessageCircle, Plus, Edit3, Trash2, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { cn, openWhatsApp } from "../utils/helpers";
import { HighlightedText } from "./ui/HighlightedText";
import { translations } from "../translations";
import { Modal } from "./ui/Modal";
import { db, doc, updateDoc, deleteDoc } from "../firebase";
import { useDebounce } from '../hooks/useDebounce';

interface CustomersProps {
  setShowAddCustomer: (v: boolean) => void;
}

export const Customers = React.memo(({ setShowAddCustomer }: CustomersProps) => {
  const { customers, shop, lang } = useApp();
  const t = translations[lang];
  
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [newName, setNewName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    return (customers || []).filter(c => 
      (c.name?.toLowerCase() || "").includes(debouncedSearch.toLowerCase()) || 
      (c.phone || "").includes(debouncedSearch)
    );
  }, [customers, debouncedSearch]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !newName.trim() || !shop) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "shops", shop.id, "customers", editingCustomer.id), {
        name: newName.trim()
      });
      setEditingCustomer(null);
      setNewName("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCustomer = () => {
    if (!editingCustomer || !shop) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!editingCustomer || !shop) return;

    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, "shops", shop.id, "customers", editingCustomer.id));
      setShowDeleteConfirm(false);
      setEditingCustomer(null);
      setNewName("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!shop) return null;

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

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
          <UserIcon size={48} className="mx-auto mb-3 opacity-10" />
          <p className="text-gray-400 text-sm font-medium">{t.noResults}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={c.id} 
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 font-bold text-lg">
                  {c.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800">
                      <HighlightedText text={c.name} highlight={debouncedSearch} />
                    </p>
                    <button 
                      onClick={() => {
                        setEditingCustomer(c);
                        setNewName(c.name);
                      }}
                      className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                  <p className={cn("text-xs", c.phone.replace(/\D/g, "").length < 10 ? "text-red-500 font-bold" : "text-gray-500")}>
                    <HighlightedText text={c.phone} highlight={debouncedSearch} />
                    {c.phone.replace(/\D/g, "").length < 10 && " (Invalid)"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-orange-600">₹{c.total_udhar || 0}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => window.open(`tel:${c.phone}`)} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                    <Phone size={16} />
                  </button>
                  <button
                    onClick={() => {
                      const message = `Hello ${c.name},\n\nThis is ${shop.shop_name}. Just wanted to stay in touch.\n\nThank you for being our customer.\n\n${shop.shop_name}`;
                      openWhatsApp(c.phone, message);
                    }}
                    className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors"
                  >
                    <MessageCircle size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <button
        onClick={() => setShowAddCustomer(true)}
        className="fixed bottom-32 right-6 w-16 h-16 bg-green-600 text-white rounded-2xl shadow-[0_20px_50px_rgba(22,163,74,0.3)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[80]"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      {/* Edit Name Modal */}
      <Modal 
        isOpen={!!editingCustomer} 
        onClose={() => setEditingCustomer(null)} 
        title="Edit Name"
      >
        <form onSubmit={handleUpdateName} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-4">{t.name}</label>
            <input 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required 
              placeholder="Enter new name" 
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold" 
            />
          </div>
          <button 
            disabled={isUpdating} 
            type="submit" 
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 active:scale-95 transition-all mt-4"
          >
            {isUpdating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : t.save}
          </button>
          <button 
            type="button" 
            onClick={() => setEditingCustomer(null)}
            className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl active:scale-95 transition-all"
          >
            {t.cancel}
          </button>
          
          <div className="pt-4 border-t border-gray-50 flex justify-center">
            <button
               type="button"
               disabled={isUpdating}
               onClick={handleDeleteCustomer}
               className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider p-2"
            >
              <Trash2 size={14} />
              Delete Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={showDeleteConfirm} 
        onClose={() => setShowDeleteConfirm(false)} 
        title="Delete Customer?"
      >
        <div className="flex flex-col items-center text-center space-y-6 py-4">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center animate-bounce">
            <AlertTriangle size={40} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-black text-gray-800">Are you sure?</h3>
            <p className="text-gray-500 font-medium">
              You are about to delete <span className="text-gray-800 font-bold">"{editingCustomer?.name}"</span> permanently.
              <br/>Existing udhar entries will remain, but the profile will be gone.
            </p>
          </div>

          <div className="w-full space-y-3 pt-4">
            <button
               disabled={isUpdating}
               onClick={confirmDelete}
               className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isUpdating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : "Yes, Delete Customer"}
            </button>
            <button
               onClick={() => setShowDeleteConfirm(false)}
               className="w-full bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl active:scale-95 transition-all"
            >
              No, Keep Profile
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
});
