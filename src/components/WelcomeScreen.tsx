import React, { useEffect } from 'react';

interface WelcomeScreenProps {
  userName: string;
  onComplete: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ userName, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-[#16a34a] z-[300] flex flex-col items-center justify-center p-6 text-white text-center animate-welcome-bg overflow-hidden">
      <div className="max-w-xs sm:max-w-md w-full space-y-4">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight animate-welcome-text">
          👋 Welcome, {userName}
        </h1>
        
        <p className="text-lg sm:text-xl font-medium opacity-90 leading-relaxed animate-welcome-sub">
          “Let’s manage your shop smarter with LEKHA”
        </p>

        {/* Subtle decorative dot for extra polish */}
        <div className="pt-8 opacity-20 animate-pulse">
           <div className="w-1.5 h-1.5 bg-white rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
};
