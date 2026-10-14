import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BRANCHES, PAYMENT_METHODS, cartTotal, inr, type CartLine } from "@/lib/menu";
import hero from "@/assets/hero.jpg";
import chinese from "@/assets/chinese.jpg";
import arabian from "@/assets/arabian.jpg";
import biryani from "@/assets/biryani.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DENMARK RESTAURANT — Chinese & Arabian Non-Veg, Tamil Nadu" },
      { name: "description", content: "Order authentic non-vegetarian Chinese and Arabian dishes online from Denmark Restaurant. Dine in or delivery." },
      { property: "og:title", content: "DENMARK RESTAURANT" },
      { property: "og:description", content: "Authentic Chinese & Arabian non-veg food in Tamil Nadu. Order online." },
    ],
  }),
  component: Index,
});

type Item = { id: string; name: string; category: string; cuisine: string; price: number; available: boolean };

function Index() {
  const { data: items = [] } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("id,name,category,cuisine,price,available").order("sort");
      if (error) throw error;
      return data as Item[];
    },
  });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cat, setCat] = useState("All");
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const shown = cat === "All" ? items : items.filter((i) => i.category === cat);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const add = (i: Item) => {
    setCart((c) => {
      const ex = c.find((l) => l.id === i.id);
      if (ex) return c.map((l) => (l.id === i.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { id: i.id, name: i.name, price: Number(i.price), qty: 1 }];
    });
    toast.success(`${i.name} added`);
  };
  const setQty = (id: string, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.id !== id) : c.map((l) => (l.id === id ? { ...l, qty } : l))));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-display text-lg font-bold tracking-widest text-gradient-ember">DENMARK</span>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/owner">Owner</Link></Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm">Cart ({count}) · {inr(cartTotal(cart))}</Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader><SheetTitle>Your order</SheetTitle></SheetHeader>
                <Checkout cart={cart} setQty={setQty} clear={() => setCart([])} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden">
        <img src={hero} alt="Arabian mandi and Chinese wok dishes" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover animate-kenburns" />
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-fade" />
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="absolute bottom-0 h-2 w-2 rounded-full bg-gold/70 blur-[1px] animate-rise"
            style={{ left: `${(i * 37) % 100}%`, animationDuration: `${6 + (i % 5) * 2}s`, animationDelay: `${i * 0.6}s` }} />
        ))}
        <div className="relative z-10 px-4 text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.4em] text-gold">Tamil Nadu · Since Generations</p>
          <h1 className="text-5xl font-black tracking-wider text-gradient-ember drop-shadow-2xl sm:text-7xl md:text-8xl">
            DENMARK<br />RESTAURANT
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-foreground/90">
            Authentic non-vegetarian Chinese &amp; Arabian flavours — fired on charcoal, tossed in the wok.
          </p>
          <Button size="lg" className="mt-8 shadow-glow" asChild><a href="#menu">Order Now</a></Button>
        </div>
      </section>

      {/* Cuisine cards */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
        {[
          { img: arabian, t: "Arabian", d: "Shawarma, Al Faham, Mandi" },
          { img: chinese, t: "Chinese", d: "Dragon chicken, noodles, fried rice" },
          { img: biryani, t: "Tamil Special", d: "Dindigul & Ambur biryani" },
        ].map((c, i) => (
          <div key={c.t} className="card-3d overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-hidden">
              <img src={c.img} alt={c.t} loading="lazy" width={1024} height={768} className="h-56 w-full object-cover animate-floaty" style={{ animationDelay: `${i}s` }} />
            </div>
            <div className="p-5">
              <h3 className="text-2xl font-bold text-gold">{c.t}</h3>
              <p className="text-muted-foreground">{c.d}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Menu */}
      <section id="menu" className="mx-auto max-w-6xl px-4 pb-24">
        <h2 className="mb-6 text-center text-4xl font-bold text-gradient-ember">Our Menu</h2>
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <Button key={c} size="sm" variant={c === cat ? "default" : "outline"} onClick={() => setCat(c)}>{c}</Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition hover:border-primary">
              <div>
                <p className="font-semibold">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.cuisine} · {i.category}</p>
                <p className="mt-1 font-bold text-gold">{inr(Number(i.price))}</p>
              </div>
              <Button size="sm" disabled={!i.available} onClick={() => add(i)}>
                {i.available ? "Add +" : "Sold out"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © DENMARK RESTAURANT · 3 branches across Tamil Nadu
      </footer>
    </div>
  );
}

function Checkout({ cart, setQty, clear }: { cart: CartLine[]; setQty: (id: string, q: number) => void; clear: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [branch, setBranch] = useState("1");
  const [orderType, setOrderType] = useState<"dine_in" | "delivery">("dine_in");
  const [payment, setPayment] = useState("cash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const total = cartTotal(cart);

  if (!cart.length) return <p className="mt-8 text-center text-muted-foreground">Your cart is empty.</p>;

  const place = async () => {
    if (!name.trim() || !/^[0-9+ ]{10,15}$/.test(phone.trim())) return toast.error("Enter your name and a valid phone number");
    if (orderType === "delivery" && !address.trim()) return toast.error("Enter delivery address");
    setBusy(true);
    const { error } = await supabase.from("orders").insert({
      branch: Number(branch),
      customer_name: name.trim().slice(0, 100),
      phone: phone.trim(),
      address: orderType === "delivery" ? address.trim().slice(0, 500) : null,
      order_type: orderType,
      payment_method: payment,
      items: cart,
      total,
    });
    setBusy(false);
    if (error) return toast.error("Could not place order. Please try again.");
    toast.success("Order sent to the restaurant! We'll call you shortly.");
    clear();
    setStep(1);
  };

  return (
    <div className="mt-4 space-y-5 px-1 pb-6">
      <div className="space-y-2">
        {cart.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex-1">{l.name}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setQty(l.id, l.qty - 1)}>−</Button>
              <span className="w-6 text-center">{l.qty}</span>
              <Button size="sm" variant="outline" onClick={() => setQty(l.id, l.qty + 1)}>+</Button>
            </div>
            <span className="w-16 text-right">{inr(l.price * l.qty)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 text-lg font-bold">
          <span>Total</span><span className="text-gold">{inr(total)}</span>
        </div>
      </div>

      {step === 1 && <Button className="w-full" onClick={() => setStep(2)}>Continue</Button>}

      {step >= 2 && (
        <div className="space-y-4">
          <div>
            <Label>Branch</Label>
            <div className="mt-2 flex gap-2">
              {BRANCHES.map((b) => (
                <Button key={b} size="sm" variant={branch === String(b) ? "default" : "outline"} onClick={() => setBranch(String(b))}>Branch {b}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label>How would you like it?</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant={orderType === "dine_in" ? "default" : "outline"} onClick={() => setOrderType("dine_in")}>DINE IN</Button>
              <Button variant={orderType === "delivery" ? "default" : "outline"} onClick={() => setOrderType("delivery")}>DELIVERY</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            <Input placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} />
            {orderType === "delivery" && (
              <Textarea placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />
            )}
          </div>
          {step === 2 && <Button className="w-full" onClick={() => setStep(3)}>Continue to payment</Button>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Label>Payment method</Label>
          <RadioGroup value={payment} onValueChange={setPayment}>
            {PAYMENT_METHODS.map((p) => (
              <label key={p.value} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:border-primary">
                <RadioGroupItem value={p.value} /> {p.label}
              </label>
            ))}
          </RadioGroup>
          {payment !== "cash" && (
            <p className="text-xs text-muted-foreground">The restaurant will confirm your order and share a secure payment request for {inr(total)}.</p>
          )}
          <Button className="w-full shadow-glow" size="lg" disabled={busy} onClick={place}>
            {busy ? "Placing…" : `Place order · ${inr(total)}`}
          </Button>
        </div>
      )}
    </div>
  );
}
