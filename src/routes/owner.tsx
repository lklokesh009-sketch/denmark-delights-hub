import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { BRANCHES, inr, PAYMENT_METHODS, type CartLine } from "@/lib/menu";
import { assignBranchManager } from "@/lib/staff.functions";

export const Route = createFileRoute("/owner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner Console — Denmark Restaurant" },
      { name: "description", content: "Restricted owner and branch manager console for Denmark Restaurant." },
      { property: "og:title", content: "Owner Console — Denmark Restaurant" },
      { property: "og:description", content: "Restricted area." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPage,
});

type Role = { role: "owner" | "branch_manager"; branch: number | null };

function OwnerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!ready) return null;
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-display font-bold tracking-widest text-gradient-ember">DENMARK · OWNER</Link>
          {user && <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{user ? <Console user={user} /> : <SignIn />}</main>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [code, setCode] = useState("");
  const submit = async () => {
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/owner` } });
      if (error) toast.error(error.message); else toast.success("Check your email to confirm your account.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); return; }
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const totp = f?.totp?.[0];
      if (totp) setMfa({ factorId: totp.id });
    }
  };
  const verify = async () => {
    if (!mfa) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfa.factorId, code });
    if (error) toast.error(error.message); else setMfa(null);
  };
  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-2xl border bg-card p-6">
      <h1 className="text-2xl font-bold text-gold">Owner / Branch access</h1>
      {mfa ? (
        <>
          <Label>Authenticator code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          <Button className="w-full" onClick={verify}>Verify</Button>
        </>
      ) : (
        <>
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full" onClick={submit}>{mode === "in" ? "Sign in" : "Create account"}</Button>
          <button className="w-full text-sm text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
          <p className="text-xs text-muted-foreground">The very first account created becomes the main owner. Others get access only when the owner assigns them a branch.</p>
        </>
      )}
    </div>
  );
}

function Console({ user }: { user: User }) {
  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role,branch").eq("user_id", user.id);
      return (data ?? []) as Role[];
    },
  });
  if (isLoading) return null;
  const isOwner = roles?.some((r) => r.role === "owner");
  const branches = isOwner ? [...BRANCHES] : (roles ?? []).filter((r) => r.branch).map((r) => r.branch as number);
  if (!isOwner && !branches.length)
    return <p className="text-center text-muted-foreground">Your account has no access yet. Ask the owner to assign you a branch.</p>;

  return (
    <Tabs defaultValue={`b${branches[0]}`}>
      <TabsList className="flex-wrap">
        {branches.map((b) => <TabsTrigger key={b} value={`b${b}`}>Branch {b}</TabsTrigger>)}
        {isOwner && <TabsTrigger value="menu">Menu</TabsTrigger>}
        {isOwner && <TabsTrigger value="bank">Bank details</TabsTrigger>}
        {isOwner && <TabsTrigger value="staff">Branch servers</TabsTrigger>}
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
      {branches.map((b) => <TabsContent key={b} value={`b${b}`}><Orders branch={b} isOwner={!!isOwner} /></TabsContent>)}
      {isOwner && <TabsContent value="menu"><MenuEditor /></TabsContent>}
      {isOwner && <TabsContent value="bank"><BankEditor /></TabsContent>}
      {isOwner && <TabsContent value="staff"><Staff /></TabsContent>}
      <TabsContent value="security"><Security user={user} /></TabsContent>
    </Tabs>
  );
}

type Order = {
  id: string; branch: number; customer_name: string; phone: string; address: string | null;
  order_type: string; payment_method: string; items: CartLine[]; total: number; status: string; created_at: string;
};

function beep() {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); o.frequency.value = 880;
    o.connect(ctx.destination); o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 400);
  } catch { /* ignore */ }
}

function Orders({ branch, isOwner }: { branch: number; isOwner: boolean }) {
  const qc = useQueryClient();
  const key = ["orders", branch];
  const { data: orders = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("branch", branch).order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as unknown as Order[];
    },
  });
  const qcRef = useRef(qc);
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    const ch = supabase
      .channel(`orders-${branch}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `branch=eq.${branch}` }, (p) => {
        const o = p.new as Order;
        beep();
        toast.success(`New order · Branch ${branch} · ${o.customer_name} · ${inr(Number(o.total))}`);
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("New order — Denmark Restaurant", { body: `Branch ${branch}: ${o.customer_name} (${o.order_type === "dine_in" ? "Dine in" : "Delivery"})` });
        qcRef.current.invalidateQueries({ queryKey: ["orders", branch] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: key });
  };
  const remove = async (id: string) => {
    await supabase.from("orders").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  if (!orders.length) return <p className="py-10 text-center text-muted-foreground">No orders yet. New orders appear here instantly with a sound alert.</p>;
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex justify-between">
            <span className="font-bold">{o.customer_name} · {o.phone}</span>
            <span className="rounded bg-secondary px-2 text-xs uppercase">{o.status}</span>
          </div>
          <p className="text-muted-foreground">
            {o.order_type === "dine_in" ? "DINE IN" : "DELIVERY"} · {PAYMENT_METHODS.find((p) => p.value === o.payment_method)?.label} · {new Date(o.created_at).toLocaleString()}
          </p>
          {o.address && <p className="mt-1">📍 {o.address}</p>}
          <ul className="my-2">{o.items.map((i) => <li key={i.id}>{i.qty} × {i.name} — {inr(i.price * i.qty)}</li>)}</ul>
          <p className="font-bold text-gold">Total {inr(Number(o.total))}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["accepted", "preparing", "completed", "cancelled"].map((s) => (
              <Button key={s} size="sm" variant={o.status === s ? "default" : "outline"} onClick={() => setStatus(o.id, s)}>{s}</Button>
            ))}
            {isOwner && <Button size="sm" variant="destructive" onClick={() => remove(o.id)}>Delete</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}

type MenuRow = { id: string; name: string; category: string; cuisine: string; price: number; available: boolean };

function MenuEditor() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["menu-admin"],
    queryFn: async () => (await supabase.from("menu_items").select("id,name,category,cuisine,price,available").order("sort")).data as MenuRow[],
  });
  const [n, setN] = useState({ name: "", category: "", cuisine: "Arabian", price: "" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["menu-admin"] }); qc.invalidateQueries({ queryKey: ["menu"] }); };
  const update = async (id: string, patch: Partial<MenuRow>) => {
    const { error } = await supabase.from("menu_items").update(patch).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };
  const addItem = async () => {
    const price = Number(n.price);
    if (!n.name || !n.category || !(price > 0)) { toast.error("Fill name, category and price"); return; }
    const { error } = await supabase.from("menu_items").insert({ ...n, price, sort: items.length + 1 });
    if (error) toast.error(error.message); else { setN({ name: "", category: "", cuisine: "Arabian", price: "" }); refresh(); }
  };
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-5">
        <Input placeholder="Dish name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <Input placeholder="Category" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })} />
        <Input placeholder="Cuisine" value={n.cuisine} onChange={(e) => setN({ ...n, cuisine: e.target.value })} />
        <Input placeholder="Price" type="number" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
        <Button onClick={addItem}>Add dish</Button>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-2 p-3">
            <Input className="flex-1 min-w-40" defaultValue={i.name} onBlur={(e) => e.target.value !== i.name && update(i.id, { name: e.target.value })} />
            <span className="w-32 text-xs text-muted-foreground">{i.category}</span>
            <Input className="w-24" type="number" defaultValue={i.price} onBlur={(e) => Number(e.target.value) !== Number(i.price) && update(i.id, { price: Number(e.target.value) })} />
            <Switch checked={i.available} onCheckedChange={(v) => update(i.id, { available: v })} />
            <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("menu_items").delete().eq("id", i.id); refresh(); }}>✕</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BankEditor() {
  const [f, setF] = useState({ account_name: "", account_number: "", ifsc: "", bank_name: "", upi_id: "" });
  useEffect(() => {
    supabase.from("bank_details").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setF({ account_name: data.account_name ?? "", account_number: data.account_number ?? "", ifsc: data.ifsc ?? "", bank_name: data.bank_name ?? "", upi_id: data.upi_id ?? "" });
    });
  }, []);
  const save = async () => {
    const { error } = await supabase.from("bank_details").upsert({ id: 1, ...f, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else toast.success("Bank details saved (visible only to you)");
  };
  return (
    <div className="mt-4 max-w-md space-y-3 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">Private — customers can never see these details.</p>
      {(Object.keys(f) as (keyof typeof f)[]).map((k) => (
        <div key={k}><Label className="capitalize">{k.replace("_", " ")}</Label>
          <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
      ))}
      <Button onClick={save}>Save</Button>
    </div>
  );
}

function Staff() {
  const assign = useServerFn(assignBranchManager);
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState(1);
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => (await supabase.from("user_roles").select("id,user_id,role,branch").eq("role", "branch_manager")).data ?? [],
  });
  return (
    <div className="mt-4 max-w-lg space-y-4 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">Give each branch server access to only their branch. They must first create an account on this page.</p>
      <Input placeholder="Manager email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="flex gap-2">
        {BRANCHES.map((b) => <Button key={b} size="sm" variant={branch === b ? "default" : "outline"} onClick={() => setBranch(b)}>Branch {b}</Button>)}
      </div>
      <Button onClick={async () => {
        try { await assign({ data: { email, branch } }); toast.success("Access granted"); setEmail(""); qc.invalidateQueries({ queryKey: ["staff"] }); }
        catch (e) { toast.error((e as Error).message); }
      }}>Grant access</Button>
      <ul className="space-y-1 text-sm">
        {list.map((r) => (
          <li key={r.id} className="flex items-center justify-between">
            <span className="font-mono text-xs">{r.user_id.slice(0, 8)}… · Branch {r.branch}</span>
            <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("user_roles").delete().eq("id", r.id); qc.invalidateQueries({ queryKey: ["staff"] }); }}>Remove</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Security({ user }: { user: User }) {
  const [factor, setFactor] = useState<{ id: string; status: string } | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const t = data?.totp?.[0];
    setFactor(t ? { id: t.id, status: t.status } : null);
  };
  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) { toast.error(error.message); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const confirmEnroll = async () => {
    if (!enroll) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    if (error) { toast.error(error.message); return; }
    toast.success("Two-step verification enabled"); setEnroll(null); setCode(""); load();
  };
  const changeEmail = async () => {
    if (!factor || factor.status !== "verified") { toast.error("Enable two-step verification first"); return; }
    const { error: pwErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: pw });
    if (pwErr) { toast.error("Password incorrect"); return; }
    const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: emailCode });
    if (mfaErr) { toast.error("Authenticator code incorrect"); return; }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) { toast.error(error.message); return; }
    toast.success("Confirmation links sent to the old and new email addresses");
    setPw(""); setEmailCode(""); setNewEmail("");
  };

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-bold text-gold">Two-step verification</h3>
        {factor?.status === "verified" ? <p className="text-sm">✅ Enabled with authenticator app</p> : enroll ? (
          <>
            <p className="text-sm text-muted-foreground">Scan with Google Authenticator / Authy, then enter the 6-digit code.</p>
            <img src={enroll.qr} alt="Authenticator QR code" className="h-44 w-44 rounded bg-foreground p-2" />
            <p className="break-all font-mono text-xs">{enroll.secret}</p>
            <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="123456" />
            <Button onClick={confirmEnroll}>Confirm</Button>
          </>
        ) : <Button onClick={startEnroll}>Enable two-step verification</Button>}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-bold text-gold">Change login email</h3>
        <p className="text-sm text-muted-foreground">Current: {user.email}</p>
        <Input placeholder="New email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <Input placeholder="Current password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Input placeholder="Authenticator code" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} maxLength={6} />
        <Button onClick={changeEmail}>Verify &amp; change email</Button>
      </div>
    </div>
  );
}
