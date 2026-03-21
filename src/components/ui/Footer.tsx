import React from 'react';

export const Footer = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-12 py-8 border-t border-gray-100 bg-white/50">
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4 px-4">
        {[
          { id: 'privacy', label: 'Privacy Policy' },
          { id: 'terms', label: 'Terms' },
          { id: 'refund', label: 'Refund Policy' },
          { id: 'contact', label: 'Contact' }
        ].map((link) => (
          <button
            key={link.id}
            onClick={() => onNavigate(link.id)}
            className="text-[11px] font-bold text-gray-400 hover:text-green-600 transition-colors"
          >
            {link.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-center text-gray-300 font-medium">
        © {currentYear} Lekha App. All rights reserved.
      </p>
    </footer>
  );
};
