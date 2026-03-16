import React, { forwardRef } from "react";
import { format } from "date-fns";

// Flexible interface to handle different API shapes
interface SaleItem {
  product_name?: string;
  name?: string; // Fallback if product_name is missing
  quantity: number;
  unit_price?: number | string;
  price?: number | string; // Fallback if unit_price is missing
  total_price?: number | string;
}

interface SaleData {
  id: number | string;
  receipt_id?: string;
  created_at: string;
  total_amount: number | string;
  payment_method?: string;
  cashier_name?: string;
  items: SaleItem[];
}

interface StoreSettings {
  store_name: string;
  store_address: string;
  currency_symbol: string;
}

interface ReceiptProps {
  sale: SaleData;
  settings: StoreSettings;
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ sale, settings }, ref) => {
    // Safety check: ensure sale and items exist before rendering
    if (!sale || !sale.items) return null;

    // --- SMART FALLBACKS FOR OFFLINE RECEIPTS ---
    
    // 1. Grab cashier from local storage if the backend hasn't provided it yet
    const localCashier = typeof window !== 'undefined' ? localStorage.getItem('username') : "Admin";
    const displayCashier = sale.cashier_name || localCashier;

    // 2. Default to CASH if payment method is missing in offline payload
    const displayPaymentMethod = sale.payment_method || "CASH";

    // 3. Clean up the ugly Dexie "OFF-" timestamp ID to look like a real receipt
    let displayReceiptId = sale.receipt_id || sale.id?.toString();
    if (displayReceiptId && displayReceiptId.toString().startsWith("OFF-")) {
        // Turns "OFF-1773492952756" into "POS-52756"
        displayReceiptId = "POS-" + displayReceiptId.toString().slice(-5);
    }

    return (
      <div
        ref={ref}
        className="w-[80mm] p-4 bg-card text-black font-mono text-sm leading-tight"
      >
        {/* --- HEADER --- */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold uppercase">
            {settings?.store_name || "Store Name"}
          </h1>
          <p className="text-xs mt-1 whitespace-pre-wrap">
            {settings?.store_address}
          </p>
        </div>

        {/* --- META INFO --- */}
        <div className="border-b border-dashed border-black pb-2 mb-2 space-y-1">
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</span>
          </div>
          <div className="flex justify-between">
            <span>Receipt #:</span>
            <span>{displayReceiptId}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span className="capitalize">{displayCashier}</span>
          </div>
        </div>

        {/* --- ITEMS TABLE --- */}
        <div className="mb-2">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="py-1 w-1/2">Item</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => {
                const name = item.product_name || item.name || "Unknown Item";
                const rawPrice = item.unit_price ?? item.price ?? 0;
                const price = parseFloat(rawPrice.toString());
                const rawTotal = item.total_price ?? price * item.quantity;
                const lineTotal = parseFloat(rawTotal.toString());

                return (
                  <tr key={index}>
                    <td className="py-1 pr-1 truncate max-w-[40mm]">{name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">
                      {lineTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* --- TOTALS --- */}
        <div className="border-t border-dashed border-black pt-2 space-y-1">
          <div className="flex justify-between font-bold text-lg">
            <span>TOTAL:</span>
            <span>
              {settings?.currency_symbol}
              {Number(sale.total_amount).toLocaleString(undefined, {
                minimumFractionDigits: 0,
              })}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Paid via:</span>
            <span className="uppercase">{displayPaymentMethod}</span>
          </div>
        </div>

        {/* --- FOOTER --- */}
        <div className="text-center mt-6 border-t border-dashed border-black pt-2">
          <p className="text-xs">Thanks for your patronage!</p>
          <p className="text-[10px] mt-1">No refunds after 3 days.</p>
        </div>
      </div>
    );
  },
);

ReceiptTemplate.displayName = "ReceiptTemplate";