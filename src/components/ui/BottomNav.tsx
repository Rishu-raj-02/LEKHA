import React, { useEffect, useRef } from "react";
import { Home, Users, IndianRupee, History, Package, User as UserIcon, TrendingUp, FileText } from "lucide-react";
import { cn } from "../../utils/helpers";

export const BottomNav = ({ activeTab, setActiveTab, t }: { activeTab: string; setActiveTab: (t: string) => void; t: any }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Only auto-scroll on mobile screens to avoid shifting desktop layout
    if (activeItemRef.current && window.innerWidth < 768) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest"
      });
    }
  }, [activeTab]);

  useEffect(() => {
    // One-time subtle nudge animation for mobile only
    if (window.innerWidth < 768 && !sessionStorage.getItem('nav_nudge_played')) {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollBy({ left: 40, behavior: 'smooth' });
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            }
          }, 800);
        }
        sessionStorage.setItem('nav_nudge_played', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const tabs = [
    { id: "home", icon: Home, label: t.home },
    { id: "customers", icon: Users, label: t.customers },
    { id: "billing", icon: IndianRupee, label: t.billing },
    { id: "udhar", icon: History, label: t.udhar },
    { id: "insights", icon: TrendingUp, label: t.insights },
    { id: "reports", icon: FileText, label: t.reports || "Reports" },
    { id: "items", icon: Package, label: t.items },
    { id: "profile", icon: UserIcon, label: t.profile },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90]">
      {/* Mobile-only gradient hint */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white via-white/40 to-transparent pointer-events-none z-20 md:hidden rounded-tr-[2.5rem]" />
      
      <nav 
        ref={scrollRef}
        className="bg-white/95 backdrop-blur-xl border-t border-gray-100 py-3 flex items-center rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] overflow-x-auto md:overflow-x-visible no-scrollbar scroll-smooth px-4 md:px-0 hide-scrollbar justify-start md:justify-center relative"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex items-center justify-start md:justify-center w-full max-w-5xl mx-auto md:px-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={activeTab === tab.id ? activeItemRef : null}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 flex-shrink-0 md:flex-1 min-w-[85px] md:min-w-0 md:max-w-[120px] outline-none",
                activeTab === tab.id ? "text-green-600 scale-110" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-2xl transition-all",
                activeTab === tab.id ? "bg-green-100 shadow-inner" : "bg-transparent"
              )}>
                <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-tight whitespace-nowrap",
                activeTab === tab.id ? "opacity-100" : "opacity-0 invisible h-0"
              )}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
