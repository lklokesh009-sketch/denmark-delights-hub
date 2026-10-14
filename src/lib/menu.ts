export const BRANCHES = [1, 2, 3] as const;

export const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "net_banking", label: "Net Banking (all banks)" },
  { value: "upi", label: "UPI (GPay / PhonePe / Paytm)" },
  { value: "cash", label: "Cash on Delivery / at Counter" },
] as const;

export type CartLine = { id: string; name: string; price: number; qty: number };

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((s, l) => s + l.price * l.qty, 0);
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
