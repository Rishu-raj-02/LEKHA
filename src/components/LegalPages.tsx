import React from 'react';
import { ArrowLeft, Mail, ShieldCheck, FileText, RefreshCcw } from "lucide-react";
import { motion } from "motion/react";

const PageContainer = ({ title, icon: Icon, children, onBack }: { title: string; icon: any; children: React.ReactNode; onBack: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="min-h-screen bg-white p-6 pb-24"
  >
    <button 
      onClick={onBack}
      className="flex items-center gap-2 text-gray-500 mb-8 hover:text-green-600 transition-colors"
    >
      <ArrowLeft size={20} />
      <span className="font-bold text-sm">Back to Home</span>
    </button>

    <div className="flex items-center gap-4 mb-8">
      <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
        <Icon size={24} />
      </div>
      <h1 className="text-2xl font-black text-gray-800">{title}</h1>
    </div>

    <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-6">
      {children}
    </div>
  </motion.div>
);

export const PrivacyPolicy = ({ onBack }: { onBack: () => void }) => (
  <PageContainer title="Privacy Policy" icon={ShieldCheck} onBack={onBack}>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">Data Collection</h3>
      <p>Lekha collects only the necessary information to manage your shop's digital ledger, including your shop name, owner name, and phone number.</p>
    </section>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">Storage & Security</h3>
      <p>Your data is stored securely using Google Firebase (Firestore). We implement standard security practices to ensure your information is protected and isolated from other users using unique authentication IDs.</p>
    </section>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">Third-Party Sharing</h3>
      <p>We do not share, sell, or rent your business or personal data to any third parties for marketing or any other purposes.</p>
    </section>
  </PageContainer>
);

export const TermsAndConditions = ({ onBack }: { onBack: () => void }) => (
  <PageContainer title="Terms & Conditions" icon={FileText} onBack={onBack}>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">Usage Policy</h3>
      <p>Lekha is a digital ledger tool provided to small businesses on a subscription basis. Users are responsible for the accuracy of the data they enter into the system.</p>
    </section>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">Subscriptions</h3>
      <p>Premium subscriptions (if applicable) are valid for a duration of 1 month from the date of purchase. Access to premium features will be available for the entire paid duration.</p>
    </section>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">Restrictions</h3>
      <p>Misuse of the application for illegal activities or fraudulent data entry is strictly prohibited and may result in immediate account suspension.</p>
    </section>
  </PageContainer>
);

export const RefundPolicy = ({ onBack }: { onBack: () => void }) => (
  <PageContainer title="Refund Policy" icon={RefreshCcw} onBack={onBack}>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">No Refund Policy</h3>
      <p>As Lekha provides digital services and subscriptions, we follow a strict **No Refund** policy after a purchase is made.</p>
    </section>
    <section>
      <h3 className="text-lg font-bold text-gray-800 mb-2">Subscription Validity</h3>
      <p>Once a subscription is paid for, it remains valid and active for its entire duration. You will continue to have access to all paid features until the subscription period expires.</p>
    </section>
  </PageContainer>
);

export const ContactUs = ({ onBack }: { onBack: () => void }) => (
  <PageContainer title="Contact Us" icon={Mail} onBack={onBack}>
    <section>
      <p className="text-lg font-medium text-gray-700">For any support, queries, or feedback, please reach out to us at:</p>
      <div className="mt-6 p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Email Support</p>
        <p className="text-xl font-black text-green-600">lekhawebapp@gmail.com</p>
      </div>
    </section>
    <section>
      <p>We aim to respond to all queries within 24-48 business hours.</p>
    </section>
  </PageContainer>
);
