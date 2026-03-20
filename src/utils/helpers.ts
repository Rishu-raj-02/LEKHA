import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPhone = (phone: string) => {
  if (!phone) return "";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 10) return `+91 ${clean}`;
  if (clean.length === 12 && clean.startsWith("91")) return `+91 ${clean.slice(2)}`;
  return phone.startsWith("+") ? phone : `+${phone}`;
};

export const openWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, "");
  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  let encoded;
  try {
    encoded = encodeURIComponent(message);
  } catch (e) {
    const plainText = message.replace(/[^\x00-\x7F]/g, "");
    encoded = encodeURIComponent(plainText);
  }
  window.open(`https://wa.me/${finalPhone}?text=${encoded}`, "_blank");
};
