export interface GlobalBarcodeRecord {
  barcode: string;
  productName: string;
  suggestedSellingPrice: number;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

// In-memory or localStorage based mock for global community intelligence
export const barcodeService = {
  // Save or update a product from a shop to the community DB
  contributeToCommunity: (barcode: string, name: string, price: number, category?: string) => {
    try {
      const dbStr = localStorage.getItem("global_barcode_library");
      const db = dbStr ? JSON.parse(dbStr) : {};
      
      if (!db[barcode]) {
        db[barcode] = [];
      }
      
      db[barcode].push({
        name,
        price,
        category: category || "",
        timestamp: Date.now()
      });
      
      localStorage.setItem("global_barcode_library", JSON.stringify(db));
    } catch (err) {
      console.error("Error contributing to barcode community", err);
    }
  },

  // Lookup the consensus matching for a barcode
  lookupBarcode: (barcode: string): { match: GlobalBarcodeRecord | null, confidence: "High Confidence" | "Low Confidence" | null } => {
    try {
      const dbStr = localStorage.getItem("global_barcode_library");
      if (!dbStr) return { match: null, confidence: null };
      
      const db = JSON.parse(dbStr);
      const contributions = db[barcode] || [];
      
      if (contributions.length === 0) {
        return { match: null, confidence: null };
      }

      // Consensus logic
      const nameCounts: Record<string, number> = {};
      const priceCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      
      contributions.forEach((c: any) => {
        nameCounts[c.name] = (nameCounts[c.name] || 0) + 1;
        priceCounts[String(c.price)] = (priceCounts[String(c.price)] || 0) + 1;
        if (c.category) {
          categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
        }
      });
      
      const bestName = Object.keys(nameCounts).reduce((a, b) => nameCounts[a] > nameCounts[b] ? a : b);
      const bestPriceStr = Object.keys(priceCounts).reduce((a, b) => priceCounts[a] > priceCounts[b] ? a : b);
      const bestPrice = Number(bestPriceStr);
      const bestCategory = Object.keys(categoryCounts).length > 0 ? Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b) : undefined;
      
      const match: GlobalBarcodeRecord = {
        barcode,
        productName: bestName,
        suggestedSellingPrice: bestPrice,
        category: bestCategory,
        createdAt: contributions[0].timestamp,
        updatedAt: contributions[contributions.length - 1].timestamp
      };

      const confidence = contributions.length > 3 ? "High Confidence" : "Low Confidence";

      return { match, confidence };
    } catch (err) {
      console.error("Error looking up barcode", err);
      return { match: null, confidence: null };
    }
  }
};
