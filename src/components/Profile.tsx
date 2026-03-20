import React, { useState } from 'react';
import { Edit2, Languages, LogOut } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn, formatPhone } from "../utils/helpers";
import { logout } from "../firebase";
import { translations } from "../translations";

interface ProfileProps {
  setShowEditProfile: (v: boolean) => void;
}

export const Profile = React.memo(({ setShowEditProfile }: ProfileProps) => {
  const { user, shop, lang, setLang } = useApp();
  const t = translations[lang];

  if (!shop || !user) return null;

  const isPhoneInvalid = shop.phone.replace(/\D/g, "").length < 10;
  
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

      <div className="space-y-2">
        <button 
          onClick={() => setShowEditProfile(true)}
          className="w-full p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 text-gray-700 font-bold"
        >
          <Edit2 size={20} className="text-green-600" />
          {t.editProfile}
        </button>
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
    </div>
  );
});
