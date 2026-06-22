import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Gavel, ShieldCheck, LogOut, Plus, X, Calendar, Users, CheckCircle2, XCircle,
  Smartphone, Armchair, Dumbbell, Watch, Package, TrendingUp, Inbox, Layers,
  PlayCircle, StopCircle, ChevronRight, Clock, Bell, RotateCcw, Trophy, Star,
  Trash2, LayoutDashboard, Sun, Moon, ChevronDown,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import * as api from "./api";
import { fmtWhen } from "./api";
import PlayRooms from "./PlayRooms";

/* ============================== helpers ============================== */
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
function who(id) {
  if (!id) return "";
  const base = id.includes("@") ? id.split("@")[0] : id;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
const serif = { fontFamily: 'Fraunces, Georgia, "Times New Roman", serif' };
function minIncrement(p) { if (p < 5000) return 100; if (p < 25000) return 250; if (p < 100000) return 500; return 1000; }
function nextMin(l) { return l.currentBid == null ? l.basePrice : l.currentBid + minIncrement(l.currentBid); }
function fmtClock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

const CATS = ["Electronics", "Furniture", "Sports", "Accessories", "Other"];
function catTone(c) {
  return ({
    Electronics: { bg: "bg-sky-50", fg: "text-sky-300", Icon: Smartphone },
    Furniture: { bg: "bg-amber-50", fg: "text-amber-300", Icon: Armchair },
    Sports: { bg: "bg-emerald-50", fg: "text-emerald-300", Icon: Dumbbell },
    Accessories: { bg: "bg-rose-50", fg: "text-rose-300", Icon: Watch },
    Other: { bg: "bg-stone-100", fg: "text-stone-300", Icon: Package },
  })[c] || { bg: "bg-stone-100", fg: "text-stone-300", Icon: Package };
}
function ItemImage({ item, className = "h-48" }) {
  const [err, setErr] = useState(false);
  const { bg, fg, Icon } = catTone(item.category);
  if (item.image && !err)
    return <img src={item.image} alt={item.title} onError={() => setErr(true)} className={"w-full object-cover " + className} />;
  return <div className={"flex w-full items-center justify-center " + bg + " " + className}><Icon className={"h-12 w-12 " + fg} /></div>;
}
function StatusBadge({ status }) {
  const m = {
    pending: ["bg-amber-50 text-amber-700 ring-amber-200", "Pending review"],
    live: ["bg-emerald-50 text-emerald-700 ring-emerald-200", "On the block"],
    sold: ["bg-stone-900 text-white ring-stone-900", "Sold"],
    unsold: ["bg-stone-100 text-stone-500 ring-stone-200", "Unsold"],
    rejected: ["bg-red-50 text-red-700 ring-red-200", "Rejected"],
  };
  const [c, l] = m[status] || m.pending;
  return <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset " + c}>{l}</span>;
}
function TimerBadge({ endsAt, now, size = "md" }) {
  const left = (endsAt || 0) - now;
  const urgent = left <= 30000;
  const pad = size === "lg" ? "px-4 py-2 text-xl" : "px-3 py-1.5 text-sm";
  return (
    <span style={urgent ? { background: "#7C2D12", color: "#FECACA" } : { background: "#16130D", color: "#E7C76B" }}
      className={"inline-flex items-center gap-2 rounded-full font-semibold tabular-nums " + pad}>
      <Clock className="h-4 w-4" /> {fmtClock(left)}
    </span>
  );
}

function ThemeStyle() {
  return (
    <style>{`
      .app-root{
        --paper:#FFFDF7; --ink:#16130D; --muted:#7A7363; --gold:#9A7A2C;
        --hair:rgba(22,19,13,.10); --glass:rgba(244,239,227,.82);
        --pageTop:#F6F1E6; --pageBot:#EEE7D7; --cardShadow:rgba(22,19,13,.13);
        font-family:'Manrope',ui-sans-serif,system-ui,-apple-system,sans-serif;
        background:linear-gradient(180deg,var(--pageTop),var(--pageBot));background-attachment:fixed;color:var(--ink);min-height:100vh;
      }
      .app-root[data-theme="dark"]{
        --paper:#1C1A13; --ink:#F3EEE2; --muted:#A7A091; --gold:#DcBd6a;
        --hair:rgba(243,238,226,.12); --glass:rgba(18,16,10,.78);
        --pageTop:#100E09; --pageBot:#17130C; --cardShadow:rgba(0,0,0,.5);
      }
      .fdisplay{font-family:'Fraunces',Georgia,serif;font-optical-sizing:auto;}
      .glass{background:var(--glass);}
      .bg-paper{background:var(--paper);} .bg-ink{background:#16130D;}
      .text-ink{color:var(--ink);} .text-gold{color:var(--gold);}
      .text-cream{color:#F3EEE2;} .text-cream-dim{color:rgba(243,238,226,.60);} .text-muted{color:var(--muted);}
      .border-hair{border:1px solid var(--hair);}
      .btn-gold{background:linear-gradient(180deg,#DEBE6B 0%,#C2A14E 55%,#B08F3E 100%);color:#16130D;transition:filter .2s,transform .1s;box-shadow:0 1px 0 rgba(255,255,255,.25) inset;}
      .btn-gold:hover{filter:brightness(1.06);} .btn-gold:active{transform:scale(.98);}
      .btn-ink{background:#16130D;color:#F3EEE2;transition:background .2s,transform .1s;}
      .app-root[data-theme="dark"] .btn-ink{background:#322c1e;}
      .btn-ink:hover{background:#2c2718;} .btn-ink:active{transform:scale(.98);}
      .card-lift{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease;border:1px solid var(--hair);}
      .card-lift:hover{transform:translateY(-4px);box-shadow:0 18px 38px var(--cardShadow);border-color:rgba(194,161,78,.5);}
      .edge-green{border-color:rgba(16,185,129,.75)!important;box-shadow:0 0 0 1px rgba(16,185,129,.45),0 12px 30px rgba(16,185,129,.22)!important;}
      .edge-red{border-color:rgba(239,68,68,.7)!important;box-shadow:0 0 0 1px rgba(239,68,68,.4),0 12px 30px rgba(239,68,68,.18)!important;}
      .edge-grey{border-color:var(--hair)!important;}
      .hero-grad{background:radial-gradient(90% 120% at 92% -12%, rgba(231,199,107,.20), transparent 55%),linear-gradient(160deg,#241E13 0%,#16130D 55%,#100D08 100%);}
      .hero-rule{height:1px;background:linear-gradient(90deg,transparent,rgba(231,199,107,.55),transparent);}
      .gold-top{border-top:2px solid #C2A14E;} .luxe{letter-spacing:.2em;}
      @keyframes auRise{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
      .au-rise{animation:auRise .5s ease both;}
      .app-root[data-theme="dark"] .bg-stone-50{background:#211D15;}
      .app-root[data-theme="dark"] .bg-stone-100{background:#2a2519;}
      .app-root[data-theme="dark"] .bg-stone-200{background:#322c1e;}
      .app-root[data-theme="dark"] .bg-amber-50{background:rgba(231,199,107,.12);}
      .app-root[data-theme="dark"] .bg-emerald-50{background:rgba(16,185,129,.14);}
      .app-root[data-theme="dark"] .bg-red-50{background:rgba(220,38,38,.16);}
      .app-root[data-theme="dark"] .text-stone-900{color:#F3EEE2;}
      .app-root[data-theme="dark"] .text-stone-800{color:#E7E1D2;}
      .app-root[data-theme="dark"] .text-stone-700{color:#D8D1C0;}
      .app-root[data-theme="dark"] .text-stone-600{color:#C3BBA9;}
      .app-root[data-theme="dark"] .text-stone-500{color:#ABA393;}
      .app-root[data-theme="dark"] .text-stone-400{color:#8C8474;}
      .app-root[data-theme="dark"] .text-stone-300{color:#6f6857;}
      .app-root[data-theme="dark"] .text-emerald-700{color:#6EE7B7;}
      .app-root[data-theme="dark"] .text-amber-700{color:#FCD34D;}
      .app-root[data-theme="dark"] .text-red-600,.app-root[data-theme="dark"] .text-red-700{color:#FCA5A5;}
      .app-root[data-theme="dark"] .border-stone-300{border-color:rgba(243,238,226,.18);}
      .app-root[data-theme="dark"] .border-stone-100{border-color:rgba(243,238,226,.08);}
      .app-root[data-theme="dark"] .border-emerald-200{border-color:rgba(16,185,129,.3);}
      .app-root[data-theme="dark"] .divide-stone-100 > * + *{border-color:rgba(243,238,226,.08);}
      .app-root[data-theme="dark"] .ring-stone-200{--tw-ring-color:rgba(243,238,226,.15);}
      .app-root[data-theme="dark"] .ring-emerald-200{--tw-ring-color:rgba(16,185,129,.3);}
      .app-root[data-theme="dark"] .ring-amber-200{--tw-ring-color:rgba(231,199,107,.3);}
      .app-root[data-theme="dark"] .hover\\:bg-stone-50:hover{background:#262017;}
      .app-root[data-theme="dark"] .hover\\:bg-stone-100:hover{background:#2c2619;}
      .app-root[data-theme="dark"] .hover\\:text-stone-600:hover,.app-root[data-theme="dark"] .hover\\:text-stone-700:hover{color:#E7E1D2;}
      .app-root[data-theme="dark"] input,.app-root[data-theme="dark"] select,.app-root[data-theme="dark"] textarea{background:#16130D;color:#F3EEE2;}
      .app-root[data-theme="dark"] input::placeholder,.app-root[data-theme="dark"] textarea::placeholder{color:#6f6857;}
      .app-root[data-theme="dark"] input[type="checkbox"]{accent-color:#C2A14E;}
    `}</style>
  );
}

function AuctaMark({ size = 42 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id="auInk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2A2418" /><stop offset="1" stopColor="#16130D" /></linearGradient>
        <linearGradient id="auGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E7C76B" /><stop offset="1" stopColor="#B0903F" /></linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#auInk)" />
      <circle cx="24" cy="24" r="19.5" fill="none" stroke="url(#auGold)" strokeWidth="1" opacity="0.9" />
      <text x="24" y="25.5" textAnchor="middle" dominantBaseline="central" fontFamily="Fraunces, Georgia, serif" fontSize="26" fontWeight="600" fill="url(#auGold)">A</text>
      <rect x="17" y="34" width="14" height="1.4" rx="0.7" fill="url(#auGold)" />
    </svg>
  );
}
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
function ThemeToggle({ theme, onToggle }) {
  return (
    <button onClick={onToggle} title="Toggle theme" aria-label="Toggle theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border-hair text-muted hover:text-ink">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/* ============================== App ============================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("aucta-theme") || "dark");
  const [adminMode, setAdminMode] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);

  const [auctions, setAuctions] = useState([]);
  const [listings, setListings] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [watchSet, setWatchSet] = useState(new Set());
  const [joinedSet, setJoinedSet] = useState(new Set());
  const [bidSet, setBidSet] = useState(new Set());
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const endedRef = useRef(new Set());
  const reloadTimer = useRef(null);
  const me = session?.user || null;

  useEffect(() => { localStorage.setItem("aucta-theme", theme); }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  function flash(type, msg) { setNotice({ type, msg }); setTimeout(() => setNotice(null), 3800); }

  /* auth */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    if (!me) { setProfile(null); setAdminMode(false); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", me.id).single();
    setProfile(data);
  }, [me?.id]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  /* data */
  const loadData = useCallback(async () => {
    const d = await api.fetchAll(me?.id);
    setAuctions(d.auctions); setListings(d.listings); setNotifs(d.notifications);
    setWatchSet(d.watchSet); setJoinedSet(d.joinedSet); setBidSet(d.bidSet); setReady(true);
  }, [me?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => loadData(), 250);
  }, [loadData]);

  useEffect(() => {
    const ch = supabase.channel("aucta-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, scheduleReload)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [scheduleReload]);

  /* clock + client-side auto close (server cron is the backstop) */
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    for (const a of auctions) {
      if (a.status === "live" && a.endsAt && now >= a.endsAt && !endedRef.current.has(a.id)) {
        endedRef.current.add(a.id);
        api.endAuction(a.id).then(loadData).catch(() => {});
      }
    }
  }, [now, auctions, loadData]);

  /* action runner */
  async function run(promise, okMsg) {
    try {
      const r = await promise;
      if (r && r.error) throw r.error;
      if (okMsg) flash("ok", okMsg);
      await loadData();
      return true;
    } catch (e) {
      flash("err", e.message || "Something went wrong");
      return false;
    }
  }

  /* auth actions */
  const signIn = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const signOut = async () => { await supabase.auth.signOut(); setAdminMode(false); };

  /* user actions */
  const join = (auctionId) => (me ? run(api.joinAuction(me, auctionId), "You're in. Place your bids.") : signIn());
  const bid = (id, amount) => run(api.placeBid(id, amount), "Bid placed — you're leading.");
  const toggleWatch = (id) => {
    if (!me) return signIn();
    return watchSet.has(id) ? run(api.removeWatch(me, id)) : run(api.addWatch(me, id));
  };
  const dismiss = (id) => run(api.dismissNotif(id));
  const dismissAll = () => me && run(api.dismissAllNotifs(me.id));

  async function submitListing(f) {
    if (!me) return;
    try {
      const url = await api.uploadImage(me, f.file);
      const { error } = await api.createListing(me, profile, { ...f, image: url });
      if (error) throw error;
      setSellOpen(false);
      flash("ok", "Submitted. Our team will verify it before the auction.");
      await loadData();
    } catch (e) { flash("err", e.message || "Upload failed"); }
  }

  /* admin actions */
  const approve = (id, auctionId) => run(api.verifyListing(id, auctionId), "Verified, scheduled, and the seller has been notified.");
  const reject = (id) => run(api.rejectListing(id), "Listing rejected.");
  const returnToReview = (id) => run(api.returnToReview(id), "Moved back to the verification queue.");
  const moveItem = (id, auctionId) => run(api.moveUnsold(id, auctionId), "Unsold lot moved into the selected auction.");
  const createAuction = (name, startAt, auto) => run(api.createAuction(name, startAt, auto), "Auction scheduled.");
  const reschedule = (id, startAt, auto) => run(api.rescheduleAuction(id, startAt, auto), "Rescheduled.");
  const setStatus = (id, status) => status === "live"
    ? run(api.startAuction(id), "Auction is now live — 5 minutes on the clock.")
    : run(api.endAuction(id), "Auction closed and settled.");
  const del = (id) => run(api.deleteAuction(id), "Auction deleted.");
  const delAll = (status) => run(api.deleteAllByStatus(status), "Cleared.");

  const isAdmin = !!profile?.is_admin;

  return (
    <div className="app-root text-ink" data-theme={theme}>
      <ThemeStyle />
      {playOpen && me ? (
        <PlayRooms me={me} profile={profile} theme={theme} onToggleTheme={toggleTheme} onExit={() => setPlayOpen(false)} />
      ) : isAdmin && adminMode ? (
        <AdminConsole session={me} listings={listings} auctions={auctions} now={now} theme={theme} ready={ready}
          onToggleTheme={toggleTheme} onExit={() => setAdminMode(false)} onSignOut={signOut}
          onApprove={approve} onReject={reject} onReturn={returnToReview} onMove={moveItem}
          onStatus={setStatus} onCreate={createAuction} onReschedule={reschedule} onDelete={del} onDeleteAll={delAll} />
      ) : (
        <Storefront me={me} profile={profile} listings={listings} auctions={auctions} notifs={notifs}
          watchSet={watchSet} joinedSet={joinedSet} bidSet={bidSet}
          now={now} theme={theme} ready={ready} isAdmin={isAdmin}
          onToggleTheme={toggleTheme} onEnterAdmin={() => setAdminMode(true)}
          onPlay={() => (me ? setPlayOpen(true) : signIn())}
          onSignIn={signIn} onSignOut={signOut}
          onSell={() => (me ? setSellOpen(true) : signIn())}
          onJoin={join} onBid={bid} onToggleWatch={toggleWatch} onDismiss={dismiss} onDismissAll={dismissAll} />
      )}

      {me && profile && !profile.onboarded && (
        <OnboardingModal me={me} profile={profile} onSignOut={signOut}
          onSave={async (fields) => {
            const { error } = await api.saveProfile(me.id, fields);
            if (error) { flash("err", error.message); return; }
            await loadProfile(); await loadData();
            flash("ok", "Welcome to Aucta, " + fields.display_name + "!");
          }} />
      )}

      {notice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-full px-5 py-2.5 text-sm font-medium shadow-lg"
            style={notice.type === "err" ? { background: "#7C2D12", color: "#FECACA" } : { background: "#16130D", color: "#E7C76B" }}>{notice.msg}</div>
        </div>
      )}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onGoogle={signIn} />}
      {sellOpen && <SellModal onClose={() => setSellOpen(false)} onSubmit={submitListing} />}
    </div>
  );
}

/* ============================== storefront ============================== */
function Storefront(p) {
  const { me, profile, listings, auctions, notifs, watchSet, joinedSet, bidSet, now, theme, ready, isAdmin,
    onToggleTheme, onEnterAdmin, onPlay, onSignIn, onSignOut, onSell, onJoin, onBid, onToggleWatch, onDismiss, onDismissAll } = p;
  const [view, setView] = useState("browse");
  const myName = (profile && profile.display_name) || (me ? who(me.email) : "");

  const live = auctions.filter((a) => a.status === "live");
  const rest = auctions.filter((a) => a.status !== "live");
  const dayKey = (a) => a.dateLabel.split(" · ")[0];
  const dayMap = {}; const dayOrder = [];
  for (const a of rest) { const k = dayKey(a); if (!dayMap[k]) { dayMap[k] = []; dayOrder.push(k); } dayMap[k].push(a); }

  const groups = [];
  if (live.length) groups.push({ key: "__live__", label: "Live now", live: true, auctions: live });
  for (const k of dayOrder) groups.push({ key: k, label: k, live: false, auctions: dayMap[k] });

  const [sel, setSel] = useState(null);
  const current = groups.find((g) => g.key === sel) || groups[0];

  return (
    <>
      <header className="sticky top-0 z-30 glass backdrop-blur" style={{ borderBottom: "1px solid rgba(22,19,13,.10)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <AuctaMark size={42} />
            <div className="leading-none">
              <div style={serif} className="text-2xl tracking-tight text-ink">Aucta</div>
              <div className="mt-1 text-[10px] uppercase luxe text-gold">Bid with confidence</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button onClick={onPlay} className="inline-flex items-center gap-1.5 rounded-full border-hair px-3 py-2 text-sm text-muted hover:text-ink"><Trophy className="h-4 w-4 text-gold" /> Play with friends</button>
            {isAdmin && <button onClick={onEnterAdmin} className="inline-flex items-center gap-1.5 rounded-full border-hair px-3 py-2 text-sm text-muted hover:text-ink"><ShieldCheck className="h-4 w-4" /> Admin</button>}
            {me ? (
              <>
                <button onClick={onSell} className="btn-gold inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Sell an item</button>
                <span className="hidden text-sm text-muted sm:inline">Hi, {myName}</span>
                <button onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-full border-hair px-3 py-2 text-sm text-muted hover:text-ink"><LogOut className="h-4 w-4" /></button>
              </>
            ) : (
              <button onClick={onSignIn} className="btn-ink rounded-full px-5 py-2 text-sm font-semibold">Sign in</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {!ready ? (
          <p className="text-muted">Loading the auction room…</p>
        ) : (
          <>
            {me && (
              <div className="mb-8 flex gap-1" style={{ borderBottom: "1px solid rgba(22,19,13,.10)" }}>
                <button onClick={() => setView("browse")} style={view === "browse" ? { borderBottomColor: "#C2A14E" } : {}}
                  className={"flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition " + (view === "browse" ? "text-ink" : "border-transparent text-muted hover:text-ink")}><Gavel className="h-4 w-4" /> Auctions</button>
                <button onClick={() => setView("activity")} style={view === "activity" ? { borderBottomColor: "#C2A14E" } : {}}
                  className={"flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition " + (view === "activity" ? "text-ink" : "border-transparent text-muted hover:text-ink")}><LayoutDashboard className="h-4 w-4" /> My activity</button>
              </div>
            )}

            {me && view === "activity" ? (
              <MyActivity me={me} listings={listings} auctions={auctions} />
            ) : !current ? (
              <EmptyState me={me} onSell={onSell} onSignIn={onSignIn} />
            ) : (
              <>
                {me && <NotificationsPanel me={me} notifs={notifs} onDismiss={onDismiss} onDismissAll={onDismissAll} />}
                {groups.length > 1 && (
                  <div className="mb-8 flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const active = g.key === current.key;
                      return (
                        <button key={g.key} onClick={() => setSel(g.key)}
                          className={"inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition " + (active ? (g.live ? "btn-gold" : "btn-ink") : "bg-paper text-muted border-hair hover:text-ink")}>
                          {g.live && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                          {g.label}{g.auctions.length > 1 ? " (" + g.auctions.length + ")" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-14">
                  {current.auctions.map((au) => (
                    <AuctionSection key={au.id} auction={au} listings={listings} me={me} watchSet={watchSet} joinedSet={joinedSet} bidSet={bidSet} now={now}
                      onJoin={onJoin} onBid={onBid} onSignIn={onSignIn} onToggleWatch={onToggleWatch} />
                  ))}
                </div>
                <div className="mt-14"><HowItWorks /></div>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

function HowItWorks({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const steps = [
    { n: "1", icon: <CheckCircle2 className="h-5 w-5" />, t: "List & get verified", d: "Submit your item with a photo. Our team inspects and approves it before it goes anywhere." },
    { n: "2", icon: <Gavel className="h-5 w-5" />, t: "Join the live auction", d: "Verified lots go under the hammer in a timed, live room — bid in real time against others." },
    { n: "3", icon: <Trophy className="h-5 w-5" />, t: "Highest bid wins", d: "When the clock stops, the top bidder takes it. We connect buyer and seller to complete the handover." },
  ];
  return (
    <section className="bg-paper border-hair overflow-hidden rounded-2xl">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <AuctaMark size={34} />
          <div>
            <h2 style={serif} className="text-ink text-xl leading-none">How Aucta works</h2>
            <p className="mt-1 text-xs uppercase luxe text-gold">Trusted live auctions for second-hand goods</p>
          </div>
        </div>
        <ChevronDown className={"h-5 w-5 shrink-0 text-muted transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="px-6 pb-6">
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Aucta is a marketplace where people auction their pre-owned goods and buyers bid for them live. Every lot is inspected and verified by our team before it reaches the block — so buyers bid with confidence and sellers reach genuine demand, with none of the guesswork of an ordinary classifieds listing.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="border-hair rounded-xl p-4">
                <div className="mb-2 flex items-center gap-2 text-gold"><span style={serif} className="text-2xl">{s.n}</span>{s.icon}</div>
                <p className="text-ink font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs uppercase luxe text-muted">Verified lots · live timed bidding · secure handover</p>
        </div>
      )}
    </section>
  );
}

function EmptyState({ me, onSell, onSignIn }) {
  return (
    <div className="au-rise space-y-6">
      <div className="border-hair bg-paper rounded-3xl px-8 py-16 text-center">
        <div className="mb-6 flex justify-center"><AuctaMark size={60} /></div>
        <span className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase luxe text-gold" style={{ background: "rgba(194,161,78,.12)" }}>No live or upcoming lots right now</span>
        <h1 style={serif} className="text-ink mx-auto mt-4 max-w-2xl text-4xl leading-tight sm:text-5xl">The block is quiet — for the moment.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
          There are no live or upcoming auctions just yet. New lots are verified and added before each sale — so this is your chance to put the first piece under the hammer.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {me
            ? <button onClick={onSell} className="btn-gold rounded-full px-6 py-3 text-sm font-semibold">List the first item</button>
            : <button onClick={onSignIn} className="btn-ink rounded-full px-6 py-3 text-sm font-semibold">Sign in to get started</button>}
        </div>
      </div>
      <HowItWorks defaultOpen />
    </div>
  );
}

function AuctionSection({ auction, listings, me, watchSet, joinedSet, bidSet, now, onJoin, onBid, onSignIn, onToggleWatch }) {
  const joined = me && joinedSet.has(auction.id);
  return (
    <section>
      <div className="hero-grad gold-top au-rise mb-8 overflow-hidden rounded-3xl p-9 text-cream">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            {auction.status === "live" ? (
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase luxe text-gold" style={{ background: "rgba(231,199,107,.12)" }}>
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span> Live now
              </span>
            ) : auction.status === "ended" ? (
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase luxe text-cream-dim" style={{ background: "rgba(243,238,226,.10)" }}>Closed</span>
            ) : (
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase luxe text-gold" style={{ background: "rgba(231,199,107,.12)" }}>Upcoming</span>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <h1 style={serif} className="text-5xl leading-none tracking-tight">{auction.name}</h1>
              {auction.status === "live" && auction.endsAt && <TimerBadge endsAt={auction.endsAt} now={now} size="lg" />}
            </div>
            <div className="mt-5 hero-rule w-full max-w-md" />
            <p className="mt-4 flex flex-wrap items-center gap-5 text-sm text-cream-dim">
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-gold" /> {auction.dateLabel}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-gold" /> {auction.participantCount} in the room</span>
            </p>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-cream-dim">Every lot is inspected and verified by our team before it reaches the block. Bid with confidence.</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            {auction.status === "live" && me && (
              joined
                ? <span className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-gold" style={{ background: "rgba(231,199,107,.12)" }}><CheckCircle2 className="h-4 w-4" /> You've joined</span>
                : <button onClick={() => onJoin(auction.id)} className="btn-gold rounded-full px-6 py-3 text-sm font-semibold">Join this auction</button>
            )}
            {auction.status === "live" && !me && (
              <button onClick={onSignIn} className="btn-gold rounded-full px-6 py-3 text-sm font-semibold">Sign in to bid</button>
            )}
          </div>
        </div>
      </div>
      <Board auction={auction} listings={listings} me={me} watchSet={watchSet} joined={joined} bidSet={bidSet}
        onJoin={onJoin} onBid={onBid} onSignIn={onSignIn} onToggleWatch={onToggleWatch} />
    </section>
  );
}

function Board({ auction, listings, me, watchSet, joined, bidSet, onJoin, onBid, onSignIn, onToggleWatch }) {
  const [watchOnly, setWatchOnly] = useState(false);
  const all = listings.filter((l) => l.auctionId === auction.id && ["live", "sold", "unsold"].includes(l.status));
  const isWatched = (it) => watchSet.has(it.id);
  const watchedCount = all.filter(isWatched).length;
  if (all.length === 0)
    return <p className="border-hair text-muted rounded-xl border-dashed px-4 py-16 text-center text-sm">No lots on this board yet.</p>;
  let items = [...all].sort((a, b) => (isWatched(b) ? 1 : 0) - (isWatched(a) ? 1 : 0));
  if (watchOnly) items = items.filter(isWatched);
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 style={serif} className="text-ink text-2xl">{all.length} lot{all.length === 1 ? "" : "s"} on the block</h2>
        {me && (
          <div className="bg-paper border-hair flex items-center gap-1 rounded-full p-1 text-sm">
            <button onClick={() => setWatchOnly(false)} className={"rounded-full px-3 py-1 font-medium " + (!watchOnly ? "btn-ink" : "text-muted hover:text-ink")}>All</button>
            <button onClick={() => setWatchOnly(true)} className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium " + (watchOnly ? "btn-gold" : "text-muted hover:text-ink")}>
              <Star className="h-3.5 w-3.5" fill="currentColor" /> Watching {watchedCount}
            </button>
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className="border-hair text-muted rounded-xl border-dashed px-4 py-16 text-center text-sm">Tap the <Star className="mx-1 inline h-3.5 w-3.5" /> on any lot to add it here.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <LotCard key={it.id} item={it} auction={auction} me={me} joined={joined} bidSet={bidSet}
              watched={isWatched(it)} onToggleWatch={onToggleWatch} onJoin={onJoin} onBid={onBid} onSignIn={onSignIn} />
          ))}
        </div>
      )}
    </>
  );
}

function LotCard({ item, auction, me, joined, bidSet, watched, onToggleWatch, onJoin, onBid, onSignIn }) {
  const min = nextMin(item);
  const [amt, setAmt] = useState(min);
  useEffect(() => { setAmt((a) => (a < min ? min : a)); }, [min]);
  const leading = me && item.highBidderId === me.id;
  const hasBid = me && bidSet && bidSet.has(item.id);
  const live = auction.status === "live" && item.status === "live";
  const edge = !live || !me ? "" : leading ? "edge-green" : hasBid ? "edge-red" : "edge-grey";
  return (
    <div className={"card-lift bg-paper flex flex-col overflow-hidden rounded-2xl " + edge}>
      <div className="relative">
        <ItemImage item={item} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: "linear-gradient(to top, rgba(22,19,13,.45), transparent)" }} />
        <span className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase luxe text-cream" style={{ background: "rgba(22,19,13,.7)", backdropFilter: "blur(4px)" }}>{item.condition}</span>
        <button onClick={() => (me ? onToggleWatch(item.id) : onSignIn())} title={watched ? "Remove from watchlist" : "Add to watchlist"}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-110" style={{ background: "rgba(22,19,13,.7)", backdropFilter: "blur(4px)" }}>
          <Star className="h-4 w-4" fill={watched ? "currentColor" : "none"} style={{ color: watched ? "#E7C76B" : "#F3EEE2" }} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 style={serif} className="text-xl leading-snug text-ink">{item.title}</h3>
        <p className="mt-1 text-xs uppercase luxe text-muted">{item.category} · {who(item.sellerName)}</p>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{item.description}</p>
        <div className="mt-4 flex items-end justify-between" style={{ borderTop: "1px solid rgba(22,19,13,.10)", paddingTop: "0.75rem" }}>
          <div>
            <p className="text-[11px] uppercase luxe text-muted">{item.currentBid != null ? "Current bid" : "Starting at"}</p>
            <p style={serif} className="text-gold text-3xl tabular-nums">{inr(item.currentBid != null ? item.currentBid : item.basePrice)}</p>
            {item.currentBid != null && <p className="mt-0.5 text-[11px] text-muted tabular-nums">Base {inr(item.basePrice)}</p>}
          </div>
          <div className="text-right text-xs text-muted">
            <p className="flex items-center justify-end gap-1"><TrendingUp className="h-3 w-3" />{item.bidCount} bid{item.bidCount === 1 ? "" : "s"}</p>
            {item.highBidder && <p className="mt-0.5">High: {leading ? "you" : who(item.highBidder)}</p>}
          </div>
        </div>
        <div className="mt-4">
          {item.status !== "live" ? (
            <p className="bg-ink rounded-xl py-2.5 text-center text-sm font-medium text-gold">
              {item.status === "sold" ? <>Sold for {inr(item.currentBid)}</> : "Closed — no winning bid"}
            </p>
          ) : !live ? (
            <p className="rounded-xl py-2.5 text-center text-xs text-muted" style={{ background: "rgba(22,19,13,.04)" }}>Bidding opens when the auction goes live.</p>
          ) : !me ? (
            <button onClick={onSignIn} className="border-hair w-full rounded-full py-2.5 text-sm font-medium text-ink hover:text-gold">Sign in to bid</button>
          ) : !joined ? (
            <button onClick={() => onJoin(auction.id)} className="border-hair w-full rounded-full py-2.5 text-sm font-medium text-ink hover:text-gold">Join the auction to bid</button>
          ) : (
            <>
              {leading
                ? <p className="mb-2 text-center text-xs font-semibold text-emerald-700">You're the highest bidder</p>
                : hasBid
                  ? <p className="mb-2 text-center text-xs font-semibold text-red-600">You've been outbid</p>
                  : null}
              <div className="flex gap-2">
                <input type="number" value={amt} min={min} step={minIncrement(item.currentBid ?? item.basePrice)} onChange={(e) => setAmt(Number(e.target.value))}
                  className="border-hair bg-paper w-full rounded-full px-4 py-2.5 text-sm tabular-nums outline-none" />
                <button onClick={() => onBid(item.id, Number(amt))} className="btn-gold shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold">Bid</button>
              </div>
              <p className="mt-2 text-center text-xs text-muted">Minimum next bid {inr(min)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== notifications + activity ============================== */
function NotificationsPanel({ me, notifs, onDismiss, onDismissAll }) {
  const mine = (notifs || []).slice().sort((a, b) => b.ts - a.ts);
  if (mine.length === 0) return null;
  const meta = {
    listed: { icon: <Calendar className="h-4 w-4" />, title: "Scheduled for auction", body: (n) => <>“{n.itemTitle}” is verified and scheduled for <span className="font-medium text-ink">{n.auctionName}</span>.</> },
    won: { icon: <Trophy className="h-4 w-4" />, title: "You won a lot", body: (n) => <>You won “{n.itemTitle}” for <span className="font-semibold tabular-nums">{inr(n.amount)}</span>. Collect from seller <span className="font-medium text-ink">{who(n.seller)}</span>.</> },
    sold: { icon: <Package className="h-4 w-4" />, title: "Your item sold", body: (n) => <>“{n.itemTitle}” sold for <span className="font-semibold tabular-nums">{inr(n.amount)}</span> to <span className="font-medium text-ink">{who(n.buyer)}</span>.</> },
    unsold: { icon: <RotateCcw className="h-4 w-4" />, title: "Your item didn't sell", body: (n) => <>“{n.itemTitle}” had no winning bid in {n.auctionName}. We can re-list it.</> },
  };
  return (
    <section className="bg-paper border-hair mb-8 rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink"><Bell className="h-5 w-5 text-gold" /><h2 style={serif} className="text-xl">Notifications</h2><span className="text-sm text-muted">({mine.length})</span></div>
        <button onClick={onDismissAll} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted hover:text-ink">Dismiss all <X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {mine.map((n) => {
          const m = meta[n.kind] || meta.listed;
          return (
            <div key={n.id} className="relative rounded-xl p-4" style={{ background: "rgba(194,161,78,.08)", border: "1px solid rgba(194,161,78,.25)" }}>
              <button onClick={() => onDismiss(n.id)} aria-label="Dismiss" className="absolute right-2 top-2 rounded-full p-1 text-muted hover:text-ink"><X className="h-4 w-4" /></button>
              <div className="flex items-center gap-2 text-sm font-semibold text-gold">{m.icon} {m.title}</div>
              <p className="mt-1.5 pr-6 text-sm text-muted">{m.body(n)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MyActivity({ me, listings, auctions }) {
  const auMap = {}; auctions.forEach((a) => { auMap[a.id] = a; });
  const auStatus = (l) => (auMap[l.auctionId] ? auMap[l.auctionId].status : null);
  const uid = me.id;
  const mine = listings.filter((l) => l.sellerId === uid);
  const won = listings.filter((l) => l.highBidderId === uid && l.status === "sold");
  const leading = listings.filter((l) => l.highBidderId === uid && l.status === "live");
  const reviewing = mine.filter((l) => l.status === "pending");
  const liveNow = mine.filter((l) => l.status === "live" && auStatus(l) === "live");
  const upcoming = mine.filter((l) => l.status === "live" && auStatus(l) === "scheduled");
  const sold = mine.filter((l) => l.status === "sold");
  const unsold = mine.filter((l) => l.status === "unsold");
  const rejected = mine.filter((l) => l.status === "rejected");
  const total = won.length + leading.length + reviewing.length + liveNow.length + upcoming.length + sold.length + unsold.length + rejected.length;
  if (total === 0)
    return <p className="border-hair text-muted rounded-xl border-dashed px-4 py-16 text-center text-sm">Nothing here yet. Join a live auction to bid, or list an item to sell.</p>;
  return (
    <div>
      <ActivitySection title="Bought — ready to collect" icon={<Trophy className="h-5 w-5 text-gold" />} items={won} auMap={auMap} note={(it) => "Seller " + who(it.sellerName)} right={(it) => inr(it.currentBid)} />
      <ActivitySection title="You're the highest bidder" icon={<TrendingUp className="h-5 w-5 text-gold" />} items={leading} auMap={auMap} note={() => "Leading"} right={(it) => inr(it.currentBid)} />
      <ActivitySection title="Your lots — live now" icon={<Gavel className="h-5 w-5 text-gold" />} items={liveNow} auMap={auMap} note={() => "On the block"} right={(it) => it.currentBid != null ? inr(it.currentBid) : "base " + inr(it.basePrice)} />
      <ActivitySection title="Your lots — in upcoming auctions" icon={<Calendar className="h-5 w-5 text-gold" />} items={upcoming} auMap={auMap} note={() => "Verified & scheduled"} right={(it) => "base " + inr(it.basePrice)} />
      <ActivitySection title="Your lots — in review" icon={<Inbox className="h-5 w-5 text-gold" />} items={reviewing} auMap={auMap} note={() => "Awaiting verification"} right={(it) => "base " + inr(it.basePrice)} />
      <ActivitySection title="Your lots — unsold (awaiting re-list)" icon={<RotateCcw className="h-5 w-5 text-gold" />} items={unsold} auMap={auMap} note={() => "No winning bid"} right={(it) => "base " + inr(it.basePrice)} />
      <ActivitySection title="Your lots — sold" icon={<Package className="h-5 w-5 text-gold" />} items={sold} auMap={auMap} note={(it) => "Buyer " + who(it.highBidder)} right={(it) => inr(it.currentBid)} />
      <ActivitySection title="Your lots — not approved" icon={<XCircle className="h-5 w-5 text-gold" />} items={rejected} auMap={auMap} note={() => "Rejected at review"} right={() => ""} />
    </div>
  );
}

function ActivitySection({ title, icon, items, note, right, auMap }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">{icon}<h2 style={serif} className="text-ink text-xl">{title}</h2><span className="text-sm text-muted">({items.length})</span></div>
      <div className="space-y-2">
        {items.map((it) => {
          const au = auMap[it.auctionId];
          return (
            <div key={it.id} className="bg-paper border-hair flex items-center gap-3 rounded-xl p-3">
              <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg"><ItemImage item={it} className="h-14" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate font-medium">{it.title}</p>
                <p className="text-muted truncate text-xs">{au ? au.dateLabel : "No auction"}{note(it) ? " · " + note(it) : ""}</p>
              </div>
              {right(it) ? <span style={serif} className="text-gold shrink-0 text-lg tabular-nums">{right(it)}</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============================== modals ============================== */
function Shell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(22,19,13,.5)" }} onClick={onClose}>
      <div className={"bg-paper gold-top w-full " + (wide ? "max-w-lg" : "max-w-md") + " rounded-2xl p-6 shadow-xl"} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 style={serif} className="text-2xl text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OnboardingModal({ me, profile, onSignOut, onSave }) {
  const [f, setF] = useState({
    display_name: (profile && profile.display_name) || "",
    dob: "", role_title: "", location: "",
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.display_name.trim() && f.dob && f.role_title.trim() && f.location.trim();
  async function go() {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    await onSave({
      display_name: f.display_name.trim(), dob: f.dob,
      role_title: f.role_title.trim(), location: f.location.trim(),
    });
    setBusy(false);
  }
  const star = <span className="text-red-500"> *</span>;
  const lbl = "mb-1.5 block text-sm font-medium text-stone-700";
  const inp = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,19,13,.6)" }}>
      <div className="bg-paper gold-top w-full max-w-md rounded-2xl p-6 shadow-xl">
        <div className="mb-1 flex items-center gap-3">
          <AuctaMark size={40} />
          <div>
            <h2 style={serif} className="text-ink text-2xl leading-none">Complete your profile</h2>
            <p className="mt-1 text-xs uppercase luxe text-gold">One quick step to get started</p>
          </div>
        </div>
        <p className="mb-5 mt-3 text-sm text-muted">Signed in as {me.email}. The name you choose becomes your username across Aucta.</p>
        <div className="space-y-4">
          <div><label className={lbl}>Name (your username){star}</label><input value={f.display_name} onChange={up("display_name")} placeholder="e.g. Priya Sharma" className={inp} /></div>
          <div><label className={lbl}>Date of birth{star}</label><input type="date" value={f.dob} onChange={up("dob")} className={inp} /></div>
          <div><label className={lbl}>Current role{star}</label><input value={f.role_title} onChange={up("role_title")} placeholder="e.g. Student, Designer, Business owner" className={inp} /></div>
          <div><label className={lbl}>Current location{star}</label><input value={f.location} onChange={up("location")} placeholder="e.g. Bengaluru, India" className={inp} /></div>
          {touched && !valid && <p className="text-sm font-medium text-red-600">Please complete every field — they're all required.</p>}
          <button onClick={go} disabled={busy} className="btn-ink w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60">{busy ? "Saving…" : "Save & continue"}</button>
          <button onClick={onSignOut} className="w-full text-center text-xs text-muted hover:text-ink">Sign out</button>
        </div>
      </div>
    </div>
  );
}

function LoginModal({ onClose, onGoogle }) {
  return (
    <Shell title="Welcome to Aucta" onClose={onClose}>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-stone-50 p-3">
        <AuctaMark size={40} />
        <div className="text-sm text-muted">Verified lots. Transparent live auctions. <span className="text-gold font-medium">Bid with confidence.</span></div>
      </div>
      <button onClick={onGoogle} className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
        <GoogleG /> Continue with Google
      </button>
      <p className="mt-3 text-center text-xs text-stone-400">We use your Google account to secure your bids and listings.</p>
    </Shell>
  );
}

function SellModal({ onClose, onSubmit }) {
  const empty = { title: "", category: "Electronics", condition: "Good", basePrice: "", description: "" };
  const [f, setF] = useState(empty);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.title.trim() && file && f.basePrice && f.description.trim();
  function onFile(e) {
    const fl = e.target.files && e.target.files[0];
    if (!fl) return;
    setFile(fl); setPreview(URL.createObjectURL(fl));
  }
  async function go() {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    await onSubmit({ ...f, file });
    setBusy(false);
  }
  const star = <span className="text-red-500"> *</span>;
  const lbl = "mb-1.5 block text-sm font-medium text-stone-700";
  const inp = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900";
  return (
    <Shell title="List an item" onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <label className={lbl}>Photo{star}</label>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="preview" className="h-40 w-full rounded-lg object-cover" />
              <button onClick={() => { setFile(null); setPreview(""); }} className="absolute right-2 top-2 rounded-full bg-stone-900/70 p-1.5 text-white hover:bg-stone-900"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 text-sm text-stone-500 hover:border-stone-500">
              <Plus className="h-5 w-5" /> Upload a photo of your item
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          )}
        </div>
        <div><label className={lbl}>Item title{star}</label><input value={f.title} onChange={up("title")} placeholder="e.g. MacBook Air M1" className={inp} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Category{star}</label><select value={f.category} onChange={up("category")} className={inp}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={lbl}>Condition{star}</label><select value={f.condition} onChange={up("condition")} className={inp}>{["Like new", "Good", "Fair", "For parts"].map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div><label className={lbl}>Base price (₹){star}</label><input type="number" value={f.basePrice} onChange={up("basePrice")} placeholder="25000" className={inp} /></div>
        <div><label className={lbl}>Description{star}</label><textarea value={f.description} onChange={up("description")} rows={3} placeholder="Condition details, accessories, age, any flaws…" className={"resize-none " + inp} /></div>
        {touched && !valid && <p className="text-sm font-medium text-red-600">Please complete every field — they're all required.</p>}
        <button onClick={go} disabled={busy} className="btn-ink w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60">{busy ? "Uploading…" : "Submit for verification"}</button>
        <p className="text-center text-xs text-stone-400">Our team verifies your item and schedules it into an auction for you.</p>
      </div>
    </Shell>
  );
}

/* ============================== admin ============================== */
function AdminConsole(p) {
  const { session, listings, auctions, now, theme, ready, onToggleTheme, onExit, onSignOut,
    onApprove, onReject, onReturn, onMove, onStatus, onCreate, onReschedule, onDelete, onDeleteAll } = p;
  const [tab, setTab] = useState("review");
  const pending = listings.filter((l) => l.status === "pending");
  const liveCount = listings.filter((l) => l.status === "live").length;
  return (
    <>
      <header className="sticky top-0 z-30 glass backdrop-blur" style={{ borderBottom: "1px solid rgba(22,19,13,.10)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <AuctaMark size={42} />
            <div className="leading-none"><div style={serif} className="text-2xl tracking-tight text-ink">Aucta</div><div className="mt-1 text-[10px] uppercase luxe text-gold">Admin console</div></div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button onClick={onExit} className="inline-flex items-center gap-1.5 rounded-full border-hair px-3 py-1.5 text-muted hover:text-ink"><Gavel className="h-4 w-4" /> Storefront</button>
            <span className="inline-flex items-center gap-1.5 text-muted"><ShieldCheck className="h-4 w-4 text-gold" /> {who(session?.email)}</span>
            <button onClick={onSignOut} className="border-hair inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted hover:text-ink"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {!ready ? <p className="text-muted">Loading…</p> : (
          <>
            <div className="mb-8 grid grid-cols-3 gap-4">
              <Stat label="Awaiting verification" value={pending.length} icon={<Inbox className="h-4 w-4" />} />
              <Stat label="On the block" value={liveCount} icon={<Gavel className="h-4 w-4" />} />
              <Stat label="Total listings" value={listings.length} icon={<Package className="h-4 w-4" />} />
            </div>
            <div className="mb-8 flex gap-1" style={{ borderBottom: "1px solid rgba(22,19,13,.10)" }}>
              {[["review", "Verification queue", <Inbox className="h-4 w-4" />], ["auctions", "Run auctions", <Calendar className="h-4 w-4" />], ["all", "All items", <Layers className="h-4 w-4" />]].map(([k, l, ic]) => (
                <button key={k} onClick={() => setTab(k)} style={tab === k ? { borderBottomColor: "#C2A14E" } : {}}
                  className={"flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition " + (tab === k ? "text-ink" : "border-transparent text-muted hover:text-ink")}>{ic}{l}</button>
              ))}
            </div>
            {tab === "review" && <ReviewQueue pending={pending} auctions={auctions} onApprove={onApprove} onReject={onReject} />}
            {tab === "auctions" && <AuctionManager auctions={auctions} listings={listings} now={now} onStatus={onStatus} onCreate={onCreate} onReturn={onReturn} onReschedule={onReschedule} onMove={onMove} onDelete={onDelete} onDeleteAll={onDeleteAll} />}
            {tab === "all" && <AllItems listings={listings} auctions={auctions} />}
          </>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, icon }) {
  return <div className="bg-paper border-hair rounded-2xl p-4"><div className="flex items-center gap-2 text-gold">{icon}<span className="text-xs uppercase luxe text-muted">{label}</span></div><p style={serif} className="text-ink mt-1 text-4xl">{value}</p></div>;
}

function ReviewQueue({ pending, auctions, onApprove, onReject }) {
  const targets = auctions.filter((a) => a.status === "scheduled" || a.status === "live");
  if (pending.length === 0) return <p className="border-hair text-muted rounded-xl border-dashed px-4 py-12 text-center text-sm">Nothing waiting. New submissions land here.</p>;
  return <div className="space-y-4">{pending.map((it) => <ReviewCard key={it.id} item={it} targets={targets} onApprove={onApprove} onReject={onReject} />)}</div>;
}
function ReviewCard({ item, targets, onApprove, onReject }) {
  const [aid, setAid] = useState(targets[0] ? targets[0].id : "");
  return (
    <div className="flex gap-4 rounded-xl border border-hair bg-paper p-4">
      <div className="h-28 w-36 shrink-0 overflow-hidden rounded-lg"><ItemImage item={item} className="h-28" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-medium text-ink">{item.title}</p><p className="mt-0.5 text-sm text-stone-500">{item.category} · {item.condition} · base {inr(item.basePrice)} · by {who(item.sellerName)}</p></div>
          <StatusBadge status={item.status} />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-stone-600">{item.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          <span className="text-sm text-stone-500">Place on</span>
          <select value={aid} onChange={(e) => setAid(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-stone-900">{targets.map((a) => <option key={a.id} value={a.id}>{a.dateLabel} ({a.status})</option>)}</select>
          <div className="ml-auto flex gap-2">
            <button onClick={() => onReject(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-hair px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"><XCircle className="h-4 w-4" /> Reject</button>
            <button onClick={() => aid && onApprove(item.id, aid)} className="btn-ink inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" /> Verify &amp; list</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmButton({ label, icon, onConfirm }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return (
    <button onClick={() => { if (armed) { onConfirm(); setArmed(false); } else setArmed(true); }}
      className={"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition " + (armed ? "" : "border border-hair text-stone-500 hover:text-stone-700")}
      style={armed ? { background: "#7C2D12", color: "#FECACA" } : {}}>
      {icon}{armed ? "Confirm delete?" : label}
    </button>
  );
}

function AuctionManager({ auctions, listings, now, onStatus, onCreate, onReturn, onReschedule, onMove, onDelete, onDeleteAll }) {
  const [name, setName] = useState("The Weekly Auction");
  const [when, setWhen] = useState("");
  const [auto, setAuto] = useState(true);
  const scheduledTargets = auctions.filter((a) => a.status === "scheduled");
  const endedCount = auctions.filter((a) => a.status === "ended").length;
  function add() { if (!name.trim() || !when) return; onCreate(name.trim(), new Date(when).getTime(), auto); setWhen(""); }
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-hair bg-paper p-5">
        <h3 className="mb-3 text-sm font-semibold text-stone-700">Schedule a new auction</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-stone-900" /> Auto-start</label>
          <button onClick={add} className="btn-ink inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Add</button>
        </div>
        <p className="mt-2 text-xs text-stone-400">With auto-start on, the room opens by itself at the chosen time (server-scheduled). Otherwise open it with “Go live”.</p>
      </div>

      {(endedCount > 0 || scheduledTargets.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hair bg-paper px-4 py-3">
          <span className="text-xs uppercase luxe text-muted">Bulk cleanup</span>
          {scheduledTargets.length > 0 && <ConfirmButton label={`Clear all upcoming (${scheduledTargets.length})`} icon={<Trash2 className="h-3.5 w-3.5" />} onConfirm={() => onDeleteAll("scheduled")} />}
          {endedCount > 0 && <ConfirmButton label={`Clear all closed (${endedCount})`} icon={<Trash2 className="h-3.5 w-3.5" />} onConfirm={() => onDeleteAll("ended")} />}
        </div>
      )}

      {auctions.map((au) => {
        const items = listings.filter((l) => l.auctionId === au.id);
        const liveN = items.filter((i) => i.status === "live").length;
        return (
          <div key={au.id} className="rounded-xl border border-hair bg-paper p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h3 style={serif} className="text-lg text-ink">{au.name}</h3>
                  {au.status === "live" ? <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Live</span> : au.status === "ended" ? <span className="rounded-full bg-stone-800 px-3 py-1 text-xs font-semibold text-white">Ended</span> : <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">Scheduled</span>}
                  {au.status === "scheduled" && au.autoStart && au.startAt && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"><Clock className="h-3 w-3" /> Auto-start</span>}
                </div>
                <p className="mt-0.5 text-sm text-stone-500">{au.dateLabel} · {liveN} lots ready · {au.participantCount} in the room</p>
              </div>
              <div className="flex items-center gap-2">
                {au.status === "live" && au.endsAt && <TimerBadge endsAt={au.endsAt} now={now} />}
                {au.status === "scheduled" && <button onClick={() => onStatus(au.id, "live")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><PlayCircle className="h-4 w-4" /> Go live</button>}
                {au.status === "live" && <button onClick={() => onStatus(au.id, "ended")} className="btn-ink inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"><StopCircle className="h-4 w-4" /> End now</button>}
                {au.status !== "live" && <ConfirmButton label="Delete" icon={<Trash2 className="h-3.5 w-3.5" />} onConfirm={() => onDelete(au.id)} />}
              </div>
            </div>
            {au.status !== "ended" && <ReschedulePanel auction={au} onReschedule={onReschedule} />}
            {items.length > 0 && (
              <div className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
                {items.map((it) => <LotRow key={it.id} item={it} onReturn={onReturn} onMove={onMove} scheduledTargets={scheduledTargets} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReschedulePanel({ auction, onReschedule }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [auto, setAuto] = useState(auction.autoStart || false);
  const live = auction.status === "live";
  function save() { if (!when) return; onReschedule(auction.id, new Date(when).getTime(), auto); setOpen(false); }
  return (
    <div className="mt-3">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-ink"><Clock className="h-3.5 w-3.5" /> {live ? "Pull back & reschedule" : "Change date & time"}</button>
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-3">
          {live && <p className="w-full text-xs text-stone-500">This takes the live room offline and moves it to a new time.</p>}
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-stone-900" /> Auto-start</label>
          <button onClick={save} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold">Save schedule</button>
        </div>
      )}
    </div>
  );
}

function LotRow({ item, onReturn, onMove, scheduledTargets = [] }) {
  const [open, setOpen] = useState(false);
  const [moveTo, setMoveTo] = useState(scheduledTargets[0] ? scheduledTargets[0].id : "");
  const buyer = item.bidCount > 0 ? item.highBidder : null;
  const rows = [
    ["Seller", who(item.sellerName)],
    ["Buyer", buyer ? who(buyer) : "— no bids"],
    ["Base price", inr(item.basePrice)],
    [item.currentBid != null ? "Final bid" : "Top bid", item.currentBid != null ? inr(item.currentBid) : "—"],
    ["Bids placed", String(item.bidCount)],
    ["Category", item.category],
    ["Condition", item.condition],
    ["Status", item.status],
  ];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-2 text-left text-stone-700">
          <ChevronRight className={"h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform " + (open ? "rotate-90" : "")} /><span className="truncate">{item.title}</span>
        </button>
        <span className="flex shrink-0 items-center gap-3 text-stone-500">
          {item.currentBid != null ? <span className="tabular-nums">{inr(item.currentBid)} · {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}</span> : <span className="text-stone-400">base {inr(item.basePrice)}</span>}
          <StatusBadge status={item.status} />
          {item.status === "live" && <button onClick={() => onReturn(item.id)} title="Return to verification queue" className="inline-flex items-center gap-1 rounded-md border border-hair px-2 py-1 text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-700"><RotateCcw className="h-3 w-3" /> Unverify</button>}
        </span>
      </div>
      {open && (
        <div className="mb-3 flex flex-col gap-4 rounded-lg bg-stone-50 p-4 sm:flex-row">
          <div className="h-28 w-40 shrink-0 overflow-hidden rounded-lg"><ItemImage item={item} className="h-28" /></div>
          <div className="min-w-0 flex-1">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              {rows.map(([k, v]) => (
                <div key={k}><dt className="text-xs uppercase tracking-wide text-stone-400">{k}</dt><dd className={"mt-0.5 text-sm text-stone-800 " + (k.includes("price") || k.includes("bid") ? "tabular-nums" : "") + (k === "Status" ? " capitalize" : "")}>{v}</dd></div>
              ))}
            </dl>
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(22,19,13,.10)" }}>
              <dt className="text-xs uppercase tracking-wide text-stone-400">Product details</dt>
              <dd className="mt-1 text-sm text-stone-600">{item.description || "—"}</dd>
            </div>
            {item.status === "unsold" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: "1px solid rgba(22,19,13,.10)" }}>
                <span className="text-xs uppercase tracking-wide text-gold">Change auction</span>
                {scheduledTargets.length === 0 ? (
                  <span className="text-sm text-stone-500">Schedule a future auction first — unsold lots can only move to an upcoming sale.</span>
                ) : (
                  <>
                    <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-stone-900">{scheduledTargets.map((a) => <option key={a.id} value={a.id}>{a.dateLabel}</option>)}</select>
                    <button onClick={() => moveTo && onMove(item.id, moveTo)} className="btn-ink inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"><RotateCcw className="h-3.5 w-3.5" /> Re-list in this auction</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AllItems({ listings, auctions }) {
  const aName = (id) => { const a = auctions.find((x) => x.id === id); return a ? a.dateLabel.split(" · ")[0] : "—"; };
  if (listings.length === 0) return <p className="text-sm text-muted">No listings yet.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-hair bg-paper">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-400" style={{ borderBottom: "1px solid rgba(22,19,13,.12)" }}>
          <tr><th className="px-4 py-3 font-medium">Item</th><th className="px-4 py-3 font-medium">Seller</th><th className="px-4 py-3 font-medium">Auction</th><th className="px-4 py-3 font-medium">Price / bid</th><th className="px-4 py-3 font-medium">Status</th></tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {listings.map((it) => (
            <tr key={it.id}>
              <td className="px-4 py-3"><div className="font-medium text-stone-800">{it.title}</div><div className="text-xs text-stone-400">{it.category} · {it.condition}</div></td>
              <td className="px-4 py-3 text-stone-600">{who(it.sellerName)}</td>
              <td className="px-4 py-3 text-stone-600">{it.auctionId ? aName(it.auctionId) : "—"}</td>
              <td className="px-4 py-3 tabular-nums text-stone-600">{it.currentBid != null ? inr(it.currentBid) : inr(it.basePrice)}</td>
              <td className="px-4 py-3"><StatusBadge status={it.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
