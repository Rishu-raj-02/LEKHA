import React, { useState } from 'react';
import { Edit2, Languages, LogOut, QrCode, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn, ensureDate, formatPhone } from "../utils/helpers";
import { logout, db, doc, updateDoc } from "../firebase";
import { translations } from "../translations";
import { Modal } from "./ui/Modal";

interface ProfileProps {
  setShowEditProfile: (v: boolean) => void;
  setShowPricing: (v: boolean) => void;
}

export const Profile = React.memo(({ setShowEditProfile, setShowPricing }: ProfileProps) => {
  const { user, shop, setShop, lang, setLang, isOwner } = useApp();
  const t = translations[lang];

  const { showUpiModal, setShowUpiModal, setOnUpiSaved } = useApp();
  const [upiIdInput, setUpiIdInput] = useState(shop?.upiId || "");
  const [confirmUpiIdInput, setConfirmUpiIdInput] = useState(shop?.upiId || "");
  const [upiError, setUpiError] = useState("");
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const isPaidProActive = Boolean(shop.isPro && shop.planExpiry && Date.now() <= ensureDate(shop.planExpiry).getTime());
  const isTrialActive = Boolean(shop.trialUsed && shop.trialEndDate && Date.now() <= ensureDate(shop.trialEndDate).getTime());
  const isProPlanActive = isOwner || isPaidProActive || isTrialActive;
  const currentPlanLabel = isOwner ? "Owner Access" : (isProPlanActive ? t.proPlan : t.freePlan);
  const currentPlanBadge = isOwner ? "Owner ✓" : (isProPlanActive ? "Pro Active ✓" : "Free");
  const currentPlanDescription = isOwner
    ? "Full system access"
    : (isProPlanActive
      ? "All Premium Features Unlocked"
      : "Upgrade Available");
  const planModalTitle = isOwner ? "Owner Access Active" : (isProPlanActive ? "Pro Plan Active" : "Upgrade to Pro");
  const planModalBody = isOwner
    ? "You have full system access as the account owner."
    : (isProPlanActive
      ? "You are currently on Pro Plan. Enjoy all premium features."
      : "Unlock advanced insights, premium features, and future updates.");
  const planModalFooter = isOwner
    ? "Unlimited access to all features."
    : (isProPlanActive
      ? "You already have access to all premium features."
      : "Continue with Pro for ₹49/month.");

  if (!shop || !user) return null;

  const isPhoneInvalid = shop.phone.replace(/\D/g, "").length < 10;

  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpiError("");

    const upi = upiIdInput.trim();
    const confirmUpi = confirmUpiIdInput.trim();

    if (!upi || !confirmUpi) {
      setUpiError("Both fields are required");
      return;
    }

    if (upi !== confirmUpi) {
      setUpiError("UPI IDs do not match");
      return;
    }

    const upiRegex = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/;
    if (!upiRegex.test(upi)) {
      setUpiError("Invalid UPI ID format (e.g. name@bank)");
      return;
    }

    setIsSavingUpi(true);
    try {
      const shopRef = doc(db, "shops", user.uid);
      await updateDoc(shopRef, { upiId: upi });
      setShop({ ...shop, upiId: upi });
      setShowUpiModal(false);
      if (setOnUpiSaved) {
        setOnUpiSaved((cb) => {
          if (cb) cb();
          return null;
        });
      }
    } catch (err) {
      console.error(err);
      setUpiError("Failed to save UPI ID to database");
    } finally {
      setIsSavingUpi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 text-3xl font-black">
          {shop.owner_name[0]}
        </div>
        <h3 className="text-xl font-bold text-gray-800">{shop.owner_name}</h3>
        <div className="flex flex-col items-center gap-1">
          <p className={cn("font-medium", isPhoneInvalid ? "text-red-500" : "text-gray-500")}>
            {formatPhone(user.phoneNumber || shop.phone)}
          </p>
          {isPhoneInvalid && (
            <p className="text-[10px] text-red-500 font-bold uppercase">Invalid Number - Please Update</p>
          )}
        </div>
        <div className="mt-4 inline-block px-4 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase">
          {shop.shop_name}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <button
          type="button"
          onClick={() => setShowPlanModal(true)}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-gray-400 font-bold">Current Plan</p>
              <div className="mt-2 flex items-center gap-2">
                <ShieldCheck size={18} className="text-green-600" />
                <p className="text-lg font-bold text-gray-900 truncate">{currentPlanLabel}</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold ${isProPlanActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
              {currentPlanBadge}
            </span>
          </div>
          <div className="mt-4 text-sm text-gray-500 flex items-center justify-between gap-3">
            <p>{currentPlanDescription}</p>
            {!isProPlanActive && <span className="text-green-600 font-bold">→</span>}
          </div>
        </button>
      </div>

      <div className="space-y-2">
        <button 
          onClick={() => setShowEditProfile(true)}
          className="w-full p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 text-gray-700 font-bold"
        >
          <Edit2 size={20} className="text-green-600" />
          {t.editProfile}
        </button>

        {/* UPI Settings Section */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-gray-700 font-bold">
              <QrCode size={20} className="text-green-600" />
              <span>UPI Settings</span>
            </div>
            <button
              onClick={() => {
                setUpiIdInput(shop.upiId || "");
                setConfirmUpiIdInput(shop.upiId || "");
                setUpiError("");
                setShowUpiModal(true);
              }}
              className="text-xs font-black text-green-600 px-3 py-1 bg-green-50 rounded-xl hover:bg-green-100 active:scale-95 transition-all"
            >
              {shop.upiId ? "Edit UPI ID" : "Add UPI ID"}
            </button>
          </div>
          <div className="text-sm flex justify-between items-center text-gray-500">
            <span>Current UPI ID:</span>
            <span className="font-bold text-gray-700">{shop.upiId || "Not Set"}</span>
          </div>
        </div>

        <button className="w-full p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between text-gray-700 font-medium">
          <div className="flex items-center gap-3">
            <Languages size={20} className="text-gray-400" />
            Language
          </div>
          <span className="text-green-600 font-bold">{lang === "en" ? "English" : "Hindi"}</span>
        </button>
        <button onClick={logout} className="w-full p-4 bg-red-50 rounded-2xl border border-red-100 shadow-sm flex items-center gap-3 text-red-600 font-bold">
          <LogOut size={20} />
          {t.logout}
        </button>
      </div>

      {/* UPI ID Setup Modal */}
      <Modal isOpen={showUpiModal} onClose={() => setShowUpiModal(false)} title="UPI Settings">
        <form onSubmit={handleSaveUpi} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">UPI ID</label>
            <input 
              type="text" 
              placeholder="e.g. name@bank" 
              value={upiIdInput} 
              onChange={e => setUpiIdInput(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold text-base mt-1" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Confirm UPI ID</label>
            <input 
              type="text" 
              placeholder="Confirm UPI ID" 
              value={confirmUpiIdInput} 
              onChange={e => setConfirmUpiIdInput(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none font-bold text-base mt-1" 
            />
          </div>
          {upiError && (
            <p className="text-xs text-red-500 font-bold text-center">{upiError}</p>
          )}
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => setShowUpiModal(false)} 
              className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSavingUpi}
              className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center"
            >
              {isSavingUpi ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} title={planModalTitle}>
        <div className="space-y-5 text-gray-700">
          <p className="text-sm leading-6">{planModalBody}</p>
          <div className="space-y-3 bg-gray-50 p-4 rounded-3xl border border-gray-100">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-green-600" />
              <div>
                <p className="text-sm font-bold text-gray-900">{currentPlanLabel}</p>
                <p className="text-xs text-gray-500">{currentPlanBadge}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">{planModalFooter}</p>
          </div>
          <div className="flex flex-col gap-3">
            {!isProPlanActive && (
              <button
                type="button"
                onClick={() => {
                  setShowPricing(true);
                  setShowPlanModal(false);
                }}
                className="w-full bg-green-600 text-white py-3 rounded-2xl font-bold text-sm shadow-lg hover:bg-green-700 transition"
              >
                Upgrade Now
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold text-sm hover:bg-gray-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
});
