import React from 'react';
import { Languages } from "lucide-react";
import { Shop } from "../../types";

export const Header = ({ shop, lang, setLang }: { shop: Shop | null; lang: "en" | "hi"; setLang: (l: "en" | "hi") => void }) => {
  return (
    <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-40 border-b border-gray-100">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold">
          {shop?.shop_name?.[0] || "L"}
        </div>
        <h1 className="font-bold text-lg text-gray-800">{shop?.shop_name || "Lekha"}</h1>
      </div>
      <button
        onClick={() => setLang(lang === "en" ? "hi" : "en")}
        className="p-2 rounded-full hover:bg-gray-100 text-gray-600 flex items-center gap-1 text-xs font-bold"
      >
        <Languages size={16} />
        {lang === "en" ? "HI" : "EN"}
      </button>
    </header>
  );
};
