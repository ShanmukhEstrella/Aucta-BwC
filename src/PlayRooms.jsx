import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Trophy, Users, Copy, Check, LogOut, Sun, Moon, Plus, Wallet, ChevronLeft, Crown,
  Volume2, VolumeX, ChevronDown, Globe, ShieldCheck, StopCircle, CheckCircle2, Bell, SkipForward, Video, BookOpen, X,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  fmtCr, FRANCHISES, franchiseColor, BUILTIN_ROSTER, DEFAULT_PURSE, MAX_SQUAD, MIN_SQUAD, MAX_OVERSEAS,
  SET_ORDER, orderBySet, nextRoomBid, createRoom, joinRoom, startRoom, bidRoom, skipRoomLot, advanceRoom, fetchRoom,
  fetchRoomPreview, requestEndRoom, agreeEndRoom,
} from "./playApi";

const serif = { fontFamily: 'Fraunces, Georgia, "Times New Roman", serif' };
const RKEY = "aucta-play-room";
const ROLE_SLOTS = [
  { key: "Batter", label: "Batters", match: (p) => p.role === "Batter" },
  { key: "WK-Batter", label: "WK", match: (p) => p.role === "WK-Batter" },
  { key: "All-rounder", label: "All-rounders", match: (p) => p.role === "All-rounder" },
  { key: "Bowler", label: "Bowlers", match: (p) => p.role === "Bowler" || (p.set_name || "").includes("Bowler") || (p.set_name || "").includes("Spinner") },
];
const categoryForRole = (role) => role === "Bowler" ? "Bowlers" : role === "All-rounder" ? "All-rounders" : role === "WK-Batter" ? "Wicket-keepers" : "Batters";
const fmtElapsed = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
const FLAGS = {
  India: "🇮🇳", Australia: "🇦🇺", England: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", "New Zealand": "🇳🇿", "South Africa": "🇿🇦",
  Pakistan: "🇵🇰", "West Indies": "WI", "Sri Lanka": "🇱🇰", Afghanistan: "🇦🇫", Bangladesh: "🇧🇩",
  Ireland: "🇮🇪", Zimbabwe: "🇿🇼", Netherlands: "🇳🇱", Scotland: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", USA: "🇺🇸",
  "United States": "🇺🇸", Nepal: "🇳🇵", Namibia: "🇳🇦", Oman: "🇴🇲", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪",
  Canada: "🇨🇦", Kenya: "🇰🇪", Uganda: "🇺🇬", Jersey: "🇯🇪", Guernsey: "🇬🇬", Bermuda: "🇧🇲",
  Malaysia: "🇲🇾", Singapore: "🇸🇬", HongKong: "🇭🇰", "Hong Kong": "🇭🇰", Thailand: "🇹🇭", Indonesia: "🇮🇩",
  PapuaNewGuinea: "🇵🇬", "Papua New Guinea": "🇵🇬", PNG: "🇵🇬", Vanuatu: "🇻🇺", Samoa: "🇼🇸", Fiji: "🇫🇯",
  Italy: "🇮🇹", Germany: "🇩🇪", Denmark: "🇩🇰", Norway: "🇳🇴", Sweden: "🇸🇪", Finland: "🇫🇮",
  Spain: "🇪🇸", Portugal: "🇵🇹", France: "🇫🇷", Austria: "🇦🇹", Belgium: "🇧🇪", Switzerland: "🇨🇭",
  Qatar: "🇶🇦", Kuwait: "🇰🇼", Bahrain: "🇧🇭", SaudiArabia: "🇸🇦", "Saudi Arabia": "🇸🇦",
  Tanzania: "🇹🇿", Rwanda: "🇷🇼", Nigeria: "🇳🇬", Ghana: "🇬🇭", Malawi: "🇲🇼", Botswana: "🇧🇼",
  "Sierra Leone": "🇸🇱", Mozambique: "🇲🇿", Japan: "🇯🇵", China: "🇨🇳", Philippines: "🇵🇭",
  "Cook Islands": "🇨🇰", Argentina: "🇦🇷", Brazil: "🇧🇷", Mexico: "🇲🇽", Chile: "🇨🇱", Peru: "🇵🇪",
  Overseas: "🌍",
};
const flagFor = (country) => FLAGS[country] || "🌍";
const isWestIndies = (country) => country === "West Indies";
const voiceLine = (text) => {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices?.() || [];
  const preferred = voices.find((v) => /female|samantha|zira|victoria|google uk english female|karen/i.test(v.name))
    || voices.find((v) => /english|en-/i.test(v.lang));
  if (preferred) u.voice = preferred;
  u.rate = 0.92;
  u.pitch = 1.18;
  u.volume = 1;
  window.speechSynthesis.speak(u);
};

/* ---- in-browser sound (no files); needs a user gesture to start ---- */
const SFX = (() => {
  let ctx;
  const ensure = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const tone = (freq, dur, type = "sine", gain = 0.16, when = 0) => {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
    const t = c.currentTime + when;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  };
  return {
    enable: ensure,
    tick: () => tone(900, 0.06, "square", 0.06),
    siren: () => { tone(1480, 0.1, "square", 0.18); tone(520, 0.12, "sawtooth", 0.16, 0.1); tone(1480, 0.1, "square", 0.16, 0.22); },
    speak: voiceLine,
    start: () => { tone(330, 0.12, "triangle", 0.14); tone(494, 0.14, "triangle", 0.14, 0.12); tone(740, 0.22, "triangle", 0.16, 0.25); },
    set: () => { tone(196, 0.12, "sawtooth", 0.16); tone(392, 0.2, "triangle", 0.14, 0.08); tone(784, 0.32, "sine", 0.13, 0.22); },
    bid: () => { tone(740, 0.07, "square", 0.08); tone(988, 0.09, "square", 0.07, 0.08); },
    once: () => { tone(880, 0.16, "square", 0.18); tone(660, 0.16, "square", 0.15, 0.18); tone(880, 0.18, "square", 0.14, 0.36); },
    twice: () => { tone(1046, 0.12, "sawtooth", 0.2); tone(784, 0.14, "sawtooth", 0.18, 0.13); tone(523, 0.24, "square", 0.17, 0.3); },
    alarm: () => { tone(1480, 0.08, "square", 0.18); tone(420, 0.12, "sawtooth", 0.15, 0.08); tone(980, 0.08, "square", 0.14, 0.2); },
    sold: () => { tone(300, 0.22, "sawtooth", 0.22); tone(150, 0.42, "sawtooth", 0.2, 0.07); },
  };
})();

const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function useAuctionVideo(roomId, me, enabled, onError) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const channelRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  const closePeer = useCallback((peerId) => {
    peersRef.current[peerId]?.close();
    delete peersRef.current[peerId];
    setRemoteStreams((streams) => {
      const next = { ...streams };
      delete next[peerId];
      return next;
    });
  }, []);

  const sendSignal = useCallback((payload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "video-signal",
      payload: { ...payload, from: me.id },
    });
  }, [me.id]);

  const ensurePeer = useCallback((peerId) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];
    const pc = new RTCPeerConnection(RTC_CONFIG);
    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal({ kind: "ice", to: peerId, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) setRemoteStreams((streams) => ({ ...streams, [peerId]: stream }));
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) closePeer(peerId);
    };
    peersRef.current[peerId] = pc;
    return pc;
  }, [closePeer, sendSignal]);

  useEffect(() => {
    if (!enabled) {
      channelRef.current?.send({ type: "broadcast", event: "video-signal", payload: { kind: "leave", from: me.id } });
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      Object.keys(peersRef.current).forEach(closePeer);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStreams({});
      return;
    }

    let cancelled = false;
    let channel;
    async function startVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        channel = supabase.channel("auction-video-" + roomId);
        channelRef.current = channel;
        channel.on("broadcast", { event: "video-signal" }, async ({ payload }) => {
          if (!payload || payload.from === me.id) return;
          if (payload.to && payload.to !== me.id) return;

          try {
            if (payload.kind === "join") {
              const pc = ensurePeer(payload.from);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendSignal({ kind: "offer", to: payload.from, description: pc.localDescription });
            } else if (payload.kind === "offer") {
              const pc = ensurePeer(payload.from);
              await pc.setRemoteDescription(payload.description);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendSignal({ kind: "answer", to: payload.from, description: pc.localDescription });
            } else if (payload.kind === "answer") {
              const pc = peersRef.current[payload.from];
              if (pc && !pc.currentRemoteDescription) await pc.setRemoteDescription(payload.description);
            } else if (payload.kind === "ice") {
              const pc = peersRef.current[payload.from];
              if (pc && payload.candidate) await pc.addIceCandidate(payload.candidate);
            } else if (payload.kind === "leave") {
              closePeer(payload.from);
            }
          } catch (err) {
            onError?.(err);
          }
        });
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") sendSignal({ kind: "join" });
        });
      } catch (err) {
        onError?.(err);
      }
    }

    startVideo();
    return () => {
      cancelled = true;
      channelRef.current?.send({ type: "broadcast", event: "video-signal", payload: { kind: "leave", from: me.id } });
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      Object.keys(peersRef.current).forEach(closePeer);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStreams({});
    };
  }, [enabled, roomId, me.id, closePeer, ensurePeer, sendSignal, onError]);

  return { localStream, remoteStreams };
}

function VideoThumb({ stream, muted = false, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.srcObject !== stream) {
      ref.current.srcObject = stream || null;
    }
  }, [stream]);
  if (!stream) return null;
  return (
    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-gold/40 bg-black">
      <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" style={{ display: 'block' }} />
      {label && <span className="absolute bottom-0 left-0 right-0 bg-black/45 px-1 py-0.5 text-[8px] font-semibold text-white">{label}</span>}
    </div>
  );
}

function PlayStyle() {
  return (
    <style>{`
      @keyframes stampIn{0%{transform:scale(2.6) rotate(-18deg);opacity:0}55%{transform:scale(.9) rotate(-12deg);opacity:1}100%{transform:scale(1) rotate(-12deg)}}
      .sold-stamp{animation:stampIn .5s cubic-bezier(.2,1.4,.4,1) both}
      @keyframes callSlide{0%{opacity:0;transform:translateY(-12px) scale(.98)}35%{opacity:1;transform:none}100%{opacity:1;transform:none}}
      .call-ribbon{animation:callSlide .35s cubic-bezier(.2,1,.2,1) both}
      @keyframes callGlow{0%,100%{box-shadow:0 0 0 rgba(231,199,107,0)}50%{box-shadow:0 0 24px rgba(231,199,107,.26)}}
      .call-glow{animation:callGlow 1.1s ease-in-out infinite}
      @keyframes alarmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
      .alarm-pulse{animation:alarmPulse .65s ease-in-out infinite}
      @keyframes flash{0%{opacity:.55}100%{opacity:0}}
      .flash{animation:flash .6s ease-out both}
      @keyframes rise2{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .rise2{animation:rise2 .35s ease both}
      @keyframes setPanel{0%{opacity:0;transform:translateY(18px) scale(.98)}16%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-10px) scale(1.01)}}
      .set-panel{animation:setPanel 2.3s cubic-bezier(.2,1,.2,1) both}
      @keyframes setShine{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
      .set-shine{animation:setShine 1.55s ease-in-out .18s both}
      @keyframes setBar{0%{transform:scaleX(0)}20%{transform:scaleX(1)}80%{transform:scaleX(1)}100%{transform:scaleX(0)}}
      .set-bar{animation:setBar 2.1s ease both;transform-origin:center}
      @keyframes barflash{0%,100%{box-shadow:0 0 0 0 rgba(231,199,107,0)}50%{box-shadow:0 0 0 3px rgba(231,199,107,.5)}}
      .bg-gold{background:#C2A14E}
      .wi-flag{position:relative;display:inline-flex;align-items:center;justify-content:center;width:2.05em;height:1.34em;overflow:hidden;border-radius:.22rem;background:#7A1026;vertical-align:-.12em;box-shadow:0 0 0 1px rgba(255,255,255,.28) inset,0 1px 2px rgba(0,0,0,.22)}
      .wi-flag:before{content:"";position:absolute;left:0;right:0;top:48%;height:.24em;background:linear-gradient(180deg,#fff 0 42%,#0B7A4B 42% 72%,#7A1026 72% 100%);opacity:.95}
      .wi-flag-sun{position:absolute;left:.58em;top:.34em;width:.48em;height:.48em;border-radius:50%;background:#F4C542}
      .wi-flag-palm{position:absolute;left:.72em;top:.26em;width:.1em;height:.62em;background:#2F7D32;transform:rotate(7deg);box-shadow:.16em .1em 0 -.03em #2F7D32,-.14em .1em 0 -.03em #2F7D32}
      .wi-flag-stumps{position:absolute;right:.54em;bottom:.28em;width:.08em;height:.38em;background:#F7E7B1;box-shadow:.13em 0 0 #F7E7B1,.26em 0 0 #F7E7B1}
      .slot-danger{background:#FFF1F2;border-color:#FECDD3;color:#BE123C}
      .slot-safe{background:#ECFDF5;border-color:#A7F3D0;color:#047857}
      .squad-surface{background:linear-gradient(135deg,rgba(255,253,247,.96),rgba(245,237,216,.92));border:1px solid rgba(154,122,44,.28);box-shadow:0 10px 24px rgba(22,19,13,.08)}
      .squad-soft{background:rgba(255,253,247,.88);border:1px solid rgba(154,122,44,.22)}
      .squad-slot{background:linear-gradient(180deg,rgba(255,253,247,.96),rgba(248,242,226,.96));border:1px solid rgba(154,122,44,.22)}
      .app-root[data-theme="dark"] .squad-surface{background:linear-gradient(135deg,rgba(31,26,16,.98),rgba(19,16,10,.96));border-color:rgba(220,189,106,.34);box-shadow:0 12px 30px rgba(0,0,0,.32)}
      .app-root[data-theme="dark"] .squad-soft{background:rgba(24,20,13,.92);border-color:rgba(220,189,106,.26)}
      .app-root[data-theme="dark"] .squad-slot{background:linear-gradient(180deg,rgba(35,29,18,.98),rgba(22,19,13,.96));border-color:rgba(220,189,106,.24)}
      .app-root[data-theme="dark"] .slot-danger{background:rgba(127,29,29,.34);border-color:rgba(251,113,133,.36);color:#FDA4AF}
      .app-root[data-theme="dark"] .slot-safe{background:rgba(6,78,59,.32);border-color:rgba(52,211,153,.3);color:#6EE7B7}
      .app-root[data-theme="dark"] .bg-rose-50{background:rgba(127,29,29,.28)}
      .app-root[data-theme="dark"] .text-rose-600{color:#FDA4AF}
      .app-root[data-theme="dark"] .border-rose-200{border-color:rgba(251,113,133,.36)}
      .app-root[data-theme="dark"] .border-stone-200{border-color:rgba(220,189,106,.18)}
    `}</style>
  );
}

export default function PlayRooms({ me, profile, theme, onToggleTheme, onExit }) {
  const [roomId, setRoomId] = useState(() => localStorage.getItem(RKEY) || null);
  const [notice, setNotice] = useState(null);
  const flash = (type, msg) => { setNotice({ type, msg }); setTimeout(() => setNotice(null), 3500); };
  const enter = (id) => { localStorage.setItem(RKEY, id); setRoomId(id); };
  const leave = () => { localStorage.removeItem(RKEY); setRoomId(null); };

  return (
    <>
      <PlayStyle />
      <header className="sticky top-0 z-30 glass" style={{ borderBottom: "1px solid rgba(22,19,13,.10)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={onExit} className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" /> Back to Aucta</button>
          <div className="flex items-center gap-2" style={serif}><Trophy className="h-5 w-5 text-gold" /><span className="text-ink text-xl">Play with Friends</span></div>
          <button onClick={onToggleTheme} className="inline-flex h-9 w-9 items-center justify-center rounded-full border-hair text-muted hover:text-ink">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {roomId ? <AuctionRoom me={me} roomId={roomId} onLeave={leave} flash={flash} /> : <Lobby me={me} profile={profile} onEnter={enter} flash={flash} />}
      </main>
      {notice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-full px-5 py-2.5 text-sm font-medium shadow-lg"
            style={notice.type === "err" ? { background: "#7C2D12", color: "#FECACA" } : { background: "#16130D", color: "#E7C76B" }}>{notice.msg}</div>
        </div>
      )}
    </>
  );
}

/* ---------------- Lobby ---------------- */
function Lobby({ me, profile, onEnter, flash }) {
  const [mode, setMode] = useState("create");
  const [name, setName] = useState((profile?.display_name || "My") + "'s IPL Auction");
  const [team, setTeam] = useState(FRANCHISES[0]);
  const [code, setCode] = useState("");
  const [roster, setRoster] = useState(BUILTIN_ROSTER.map((r) => ({ ...r, on: true })));
  const [cName, setCName] = useState(""); const [cRole, setCRole] = useState("Batter"); const [cBase, setCBase] = useState(100); const [cOS, setCOS] = useState(false);
  const [cTier, setCTier] = useState("Tier-3");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState({ room: null, members: [] });

  useEffect(() => {
    if (mode !== "join" || code.trim().length < 5) { setPreview({ room: null, members: [] }); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const data = await fetchRoomPreview(code);
      if (alive) setPreview(data);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [mode, code]);

  function addCustom() {
    if (!cName.trim()) return;
    const category = categoryForRole(cRole);
    setRoster((r) => [...r, { name: cName.trim(), role: cRole, country: cOS ? "Overseas" : "India", overseas: cOS, base: Number(cBase) || 20, tier: cTier, category, set: `${cTier} ${category}`, stats: { m: 0, runs: 0, wkts: 0, avg: 0, sr: 0 }, on: true, custom: true }]);
    setCName(""); setCBase(100); setCOS(false);
  }
  async function doCreate() {
    const lots = orderBySet(roster.filter((r) => r.on)).map((r) => ({ name: r.name, role: r.role, country: r.country, overseas: !!r.overseas, base: r.base, set: r.set, tier: r.tier, category: r.category || categoryForRole(r.role), stats: r.stats || null }));
    if (lots.length === 0) return flash("err", "Add at least one player to the pool.");
    SFX.enable();
    setBusy(true);
    const { data, error } = await createRoom(name.trim(), DEFAULT_PURSE, team.name, team.short, lots);
    setBusy(false);
    if (error) return flash("err", error.message);
    onEnter(data);
  }
  async function doJoin() {
    if (!code.trim()) return flash("err", "Enter a room code.");
    if (takenShorts.has(team.short)) return flash("err", `${team.short} is already taken in this room.`);
    SFX.enable();
    setBusy(true);
    const { data, error } = await joinRoom(code.trim(), team.name, team.short);
    setBusy(false);
    if (error) return flash("err", error.message);
    onEnter(data);
  }

  const grouped = SET_ORDER.map((s) => ({ set: s, items: roster.map((r, i) => ({ ...r, i })).filter((r) => r.set === s) })).filter((g) => g.items.length);
  const takenShorts = new Set(preview.members.map((m) => m.team_short).filter(Boolean));

  return (
    <div className="rise2 space-y-6">
      <div className="hero-grad gold-top overflow-hidden rounded-3xl px-8 py-10 text-cream">
        <h1 style={serif} className="text-4xl leading-tight sm:text-5xl">Build your dream squad.</h1>
        <p className="mt-3 max-w-xl text-sm text-cream-dim">Create a private room, invite friends, and bid for real IPL stars with a {fmtCr(DEFAULT_PURSE)} purse. The auctioneer is automated — squad rules apply: {MIN_SQUAD}–{MAX_SQUAD} players, max {MAX_OVERSEAS} overseas.</p>
      </div>

      <div className="flex gap-1" style={{ borderBottom: "1px solid rgba(22,19,13,.10)" }}>
        {[["create", "Create a room"], ["join", "Join with a code"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={mode === k ? { borderBottomColor: "#C2A14E" } : {}}
            className={"border-b-2 px-4 py-2.5 text-sm font-medium transition " + (mode === k ? "text-ink" : "border-transparent text-muted hover:text-ink")}>{l}</button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Pick your franchise</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FRANCHISES.map((f) => {
            const on = team.short === f.short;
            const taken = mode === "join" && takenShorts.has(f.short);
            return (
              <button key={f.short} disabled={taken} onClick={() => setTeam(f)} className={"rounded-xl px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 " + (on && !taken ? "ring-2" : "border-hair")}
                style={on && !taken ? { background: f.color, color: f.ink, boxShadow: "0 8px 24px rgba(0,0,0,.18)" } : {}}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold" style={serif}>{f.short}</span>
                  {taken && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">Taken</span>}
                </div>
                <div className={"mt-0.5 text-[11px] leading-tight " + (on && !taken ? "" : "text-muted")}>{f.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {mode === "create" ? (
        <div className="space-y-5">
          <div className="bg-paper border-hair rounded-2xl p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-sm font-medium text-stone-700">Room name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
              </div>
              <button onClick={doCreate} disabled={busy} className="btn-gold shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60">{busy ? "Creating…" : `Create room as ${team.short}`}</button>
            </div>
          </div>
          <div className="bg-paper border-hair rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Player pool ({roster.filter((r) => r.on).length}) — by set</h3>
              <span className="text-xs text-stone-400">Tap to include / exclude</span>
            </div>
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.set}>
                  <p className="mb-1.5 text-[11px] uppercase luxe text-gold">{g.set}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {g.items.map((r) => (
                      <button key={r.i} onClick={() => setRoster((list) => list.map((x, j) => j === r.i ? { ...x, on: !x.on } : x))}
                        className={"flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition " + (r.on ? "btn-ink" : "border-hair text-muted")}>
                        <span className="min-w-0 truncate">{r.overseas && <Globe className="mr-1 inline h-3 w-3" />}<span className="font-medium">{r.name}</span> <span className={r.on ? "text-cream-dim" : ""}>· {r.role}</span></span>
                        <span className="shrink-0 tabular-nums">{fmtCr(r.base)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4">
              <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Add a player" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
              <select value={cTier} onChange={(e) => setCTier(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none">{["Tier-1", "Tier-2", "Tier-3"].map((x) => <option key={x}>{x}</option>)}</select>
              <select value={cRole} onChange={(e) => setCRole(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none">{["Batter", "Bowler", "All-rounder", "WK-Batter"].map((x) => <option key={x}>{x}</option>)}</select>
              <input type="number" value={cBase} onChange={(e) => setCBase(e.target.value)} placeholder="Base (L)" className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600"><input type="checkbox" checked={cOS} onChange={(e) => setCOS(e.target.checked)} className="h-4 w-4 accent-stone-900" /> Overseas</label>
              <button onClick={addCustom} className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Add</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-paper border-hair rounded-2xl p-5">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Room code</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7F3A9" maxLength={6}
            className="w-full rounded-lg border border-stone-300 px-3 py-3 text-center text-2xl font-bold tracking-[.3em] outline-none focus:border-stone-900" style={serif} />
          {preview.room && (
            <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
              <div className="font-semibold text-ink">{preview.room.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {preview.members.length ? preview.members.map((m) => <span key={m.team_short} className="rounded-full bg-stone-100 px-2 py-0.5">{m.team_short} taken</span>) : <span>No teams picked yet</span>}
              </div>
            </div>
          )}
          <button onClick={doJoin} disabled={busy || takenShorts.has(team.short)} className="btn-ink mt-4 w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60">{busy ? "Joining…" : takenShorts.has(team.short) ? `${team.short} already taken` : `Join as ${team.short}`}</button>
          <p className="mt-2 text-center text-xs text-stone-400">Taken franchises are locked for everyone in the room.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Auction room ---------------- */
function AuctionRoom({ me, roomId, onLeave, flash }) {
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [lots, setLots] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [bidBusy, setBidBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const reloadT = useRef(null);
  const prevStage = useRef(0);
  const lastTick = useRef(null);
  const lastAlarm = useRef(null);
  const prevEndRequest = useRef(null);
  const spokenLot = useRef(null);
  const prevSet = useRef(null);
  const advanceRef = useRef({ key: null, busy: false });
  const [setBanner, setSetBanner] = useState(null);
  const onVideoError = useCallback((err) => {
    flash("err", err?.message || "Could not start video.");
    setVideoEnabled(false);
  }, [flash]);
  const { localStream, remoteStreams } = useAuctionVideo(roomId, me, videoEnabled, onVideoError);

  const load = useCallback(async () => {
    const d = await fetchRoom(roomId);
    if (!d.room) { flash("err", "Room not found."); onLeave(); return; }
    setRoom(d.room); setMembers(d.members); setLots(d.lots);
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  const scheduleReload = useCallback(() => { if (reloadT.current) clearTimeout(reloadT.current); reloadT.current = setTimeout(load, 180); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("play-" + roomId)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms", filter: "id=eq." + roomId }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: "room_id=eq." + roomId }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_lots", filter: "room_id=eq." + roomId }, scheduleReload)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [roomId, scheduleReload]);

  useEffect(() => {
    if (soundOn) SFX.enable();
  }, [soundOn]);

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 400); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (room?.status !== "running" || !room.call_deadline) {
      advanceRef.current = { key: null, busy: false };
      return;
    }

    const deadlineMs = Date.parse(room.call_deadline);
    if (!Number.isFinite(deadlineMs) || now < deadlineMs) return;

    const key = `${room.id}:${room.current_lot_id || "none"}:${room.call_stage}:${room.call_deadline}`;
    if (advanceRef.current.busy || advanceRef.current.key === key) return;

    advanceRef.current = { key, busy: true };
    advanceRoom(roomId)
      .then(load)
      .catch(() => {
        advanceRef.current.key = null;
      })
      .finally(() => {
        advanceRef.current.busy = false;
      });
  }, [now, room, roomId, load]);

  // sound: stage transitions + last-5s tick
  useEffect(() => {
    if (!room || room.status !== "running") { prevStage.current = room?.call_stage ?? 0; return; }
    if (room.call_stage !== prevStage.current) {
      if (soundOn) {
        if (room.call_stage === 1) { SFX.once(); SFX.speak("Going once."); }
        else if (room.call_stage === 2) { SFX.twice(); SFX.speak("Going twice."); }
        else if (room.call_stage === 3) SFX.sold();
      }
      prevStage.current = room.call_stage;
    }
    const secs = Math.max(0, Math.ceil((Date.parse(room.call_deadline) - now) / 1000));
    if (soundOn && room.call_stage === 0 && secs > 0 && secs <= 5 && lastTick.current !== secs) { SFX.tick(); lastTick.current = secs; }
    if (soundOn && (room.call_stage === 1 || room.call_stage === 2) && secs > 0 && lastAlarm.current !== secs) { SFX.alarm(); lastAlarm.current = secs; }
    if (secs > 5) lastTick.current = null;
    if (room.call_stage === 0) lastAlarm.current = null;
  }, [now, room, soundOn]);

  useEffect(() => {
    const lot = lots.find((l) => l.id === room?.current_lot_id);
    if (!soundOn || !room || room.status !== "running" || room.call_stage !== 0 || !lot) return;
    if (spokenLot.current === lot.id) return;
    spokenLot.current = lot.id;
    SFX.speak(`${lot.player_name}. ${lot.country}. ${lot.role}. Base price ${fmtCr(lot.base_price)}.`);
  }, [room?.current_lot_id, room?.status, room?.call_stage, lots, soundOn]);

  useEffect(() => {
    if (!room?.end_requested_at) { prevEndRequest.current = null; return; }
    if (prevEndRequest.current === room.end_requested_at) return;
    prevEndRequest.current = room.end_requested_at;
    if (room.end_requested_by && room.end_requested_by !== me.id) {
      flash("ok", "Host requested to end the auction. Please vote.");
      if (soundOn) SFX.alarm();
    }
  }, [room?.end_requested_at, room?.end_requested_by, me.id, soundOn]);

  useEffect(() => {
    const lot = lots.find((l) => l.id === room?.current_lot_id);
    if (!room || room.status !== "running" || !lot) return;
    const key = lot.set_name || `${lot.tier || "Tier"} ${lot.category || categoryForRole(lot.role)}`;
    if (prevSet.current === key) return;
    prevSet.current = key;
    setSetBanner({ key, tier: lot.tier || key.split(" ")[0], category: lot.category || categoryForRole(lot.role) });
    if (soundOn) SFX.set();
    const t = setTimeout(() => setSetBanner(null), 2300);
    return () => clearTimeout(t);
  }, [room?.current_lot_id, room?.status, lots, soundOn]);

  if (!room) return <p className="text-muted">Loading the room…</p>;

  const me_m = members.find((m) => m.user_id === me.id);
  const isHost = room.host_id === me.id;
  const lot = lots.find((l) => l.id === room.current_lot_id);
  const sold = lots.filter((l) => l.status === "sold");
  const queuedCount = lots.filter((l) => l.status === "queued").length;
  const mySold = sold.filter((l) => l.sold_to === me.id);
  const myCounts = { squad: mySold.length, overseas: mySold.filter((l) => l.overseas).length };
  const startedMs = Date.parse(room.started_at || room.created_at || "");
  const elapsed = room.status === "running" && Number.isFinite(startedMs) ? fmtElapsed(now - startedMs) : null;
  const endAgreeIds = room.end_agree_ids || [];
  const hasEndRequest = !!room.end_requested_at && room.status !== "done";
  const iAgreedEnd = endAgreeIds.includes(me.id);
  const skipVoteIds = room.skip_lot_id === room.current_lot_id ? (room.skip_vote_ids || []) : [];
  const skipCount = skipVoteIds.filter((id) => members.some((m) => m.user_id === id)).length;
  const iSkipped = skipVoteIds.includes(me.id);

  function copyCode() { navigator.clipboard?.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  function toggleSound() { const next = !soundOn; setSoundOn(next); if (next) { SFX.enable(); SFX.tick(); } }

  return (
    <div className="rise2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 style={serif} className="text-ink text-2xl sm:text-3xl">{room.name}</h1>
          <button onClick={copyCode} className="mt-1 inline-flex items-center gap-2 rounded-full border-hair px-2.5 py-1 sm:px-3 text-xs sm:text-sm text-muted hover:text-ink">
            Code <span className="font-bold tracking-widest text-ink text-xs sm:text-sm" style={serif}>{room.code}</span>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
          </button>
        </div>
        <button onClick={() => setShowRules(true)} className="inline-flex items-center gap-2 rounded-full border-hair px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-gold hover:text-ink transition bg-gold/10 border-gold/30"><BookOpen className="h-4 w-4 sm:h-5 sm:w-5" /> Rules</button>
        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          {elapsed && <span className="inline-flex items-center rounded-full border-hair px-1.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm font-semibold tabular-nums text-ink">Elapsed <span className="sm:hidden ml-1">{elapsed}</span><span className="hidden sm:inline ml-1.5">{elapsed}</span></span>}
          <button onClick={toggleSound} title={soundOn ? "Turn sound off" : "Turn sound on"} className={"inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full border-hair px-1.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm font-semibold hover:text-ink " + (soundOn ? "text-gold" : "text-muted")}>
            {soundOn ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />}
            <span className="hidden sm:inline">{soundOn ? "Sound on" : "Sound off"}</span><span className="sm:hidden">{soundOn ? "On" : "Off"}</span>
          </button>
          {me_m && <span className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full px-1.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm font-semibold text-white whitespace-nowrap" style={{ background: franchiseColor(me_m.team_name) }}><Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="hidden sm:inline">{fmtCr(me_m.purse_remaining)}</span><span className="sm:hidden text-[10px]">{fmtCr(me_m.purse_remaining).slice(0, 3)}</span></span>}
          <button disabled title="Video coming soon" className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full border-hair px-1.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm font-semibold text-muted opacity-50 cursor-not-allowed">
            <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="hidden sm:inline">Video</span><span className="sm:hidden">V</span>
          </button>
          {isHost && room.status !== "done" && <button onClick={async () => { const { error } = await requestEndRoom(roomId); if (error) flash("err", error.message); }} className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full border border-rose-300/70 px-1.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 whitespace-nowrap"><StopCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="hidden sm:inline">End</span></button>}
          <button onClick={onLeave} className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full border-hair px-1.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-sm text-muted hover:text-ink"><LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="hidden sm:inline">Leave</span></button>
        </div>
      </div>
      {hasEndRequest && (
        <EndAuctionBanner members={members} agreeIds={endAgreeIds} iAgreed={iAgreedEnd}
          onAgree={async () => { const { error } = await agreeEndRoom(roomId); if (error) flash("err", error.message); }} />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,.9fr)]">
        <div>
          {room.status === "lobby" && <Lobbyview room={room} members={members} isHost={isHost} lots={lots} onStart={async () => { SFX.enable(); SFX.start(); const { error } = await startRoom(roomId); if (error) flash("err", error.message); }} onCopy={copyCode} copied={copied} />}
          {room.status === "running" && <Stage room={room} lot={lot} me={me} me_m={me_m} now={now} bidBusy={bidBusy} myCounts={myCounts} setBanner={setBanner}
            skipCount={skipCount} memberCount={members.length} iSkipped={iSkipped}
            onSkip={async () => { SFX.enable(); const { error } = await skipRoomLot(roomId, lot.id); if (error) flash("err", error.message); }}
            onBid={async (amt) => { SFX.enable(); setBidBusy(true); const { error } = await bidRoom(roomId, lot.id, amt); setBidBusy(false); if (error) flash("err", error.message); else SFX.bid(); }} queuedCount={queuedCount} />}
          {room.status === "done" && <Results room={room} members={members} lots={lots} />}
        </div>
        <TeamRail members={members} lot={lot} room={room} meId={me.id} sold={sold} localStream={localStream} remoteStreams={remoteStreams} />
      </div>
      {showRules && <RulesModal room={room} onClose={() => setShowRules(false)} />}
    </div>
  );
}

function Lobbyview({ room, members, isHost, lots, onStart, onCopy, copied }) {
  const taken = new Set(members.map((m) => m.team_short));
  return (
    <div className="hero-grad gold-top rounded-3xl px-8 py-10 text-center text-cream">
      <p className="text-[11px] uppercase luxe text-gold">Invite your friends</p>
      <button onClick={onCopy} className="mt-3 inline-flex items-center gap-3 rounded-2xl px-6 py-4" style={{ background: "rgba(231,199,107,.12)" }}>
        <span style={serif} className="text-5xl tracking-[.2em] text-cream">{room.code}</span>
        {copied ? <Check className="h-6 w-6 text-emerald-400" /> : <Copy className="h-6 w-6 text-gold" />}
      </button>
      <p className="mt-4 text-sm text-cream-dim">{members.length} team{members.length === 1 ? "" : "s"} joined · {lots.length} players · sets: {SET_ORDER.join(" → ")}</p>
      <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2">
        {members.map((m) => <span key={m.user_id} className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: franchiseColor(m.team_name) }}>{m.team_short} · {m.display_name || (m.user_email || "").split("@")[0]}</span>)}
      </div>
      {isHost ? <button onClick={onStart} className="btn-gold mt-6 rounded-full px-8 py-3 text-sm font-semibold">Start the auction</button>
              : <p className="mt-6 text-sm text-cream-dim">Waiting for the host to start…</p>}
    </div>
  );
}

function Stage({ room, lot, me, me_m, now, onBid, onSkip, bidBusy, queuedCount, myCounts, setBanner, skipCount, memberCount, iSkipped }) {
  const min = nextRoomBid(lot);
  const [amt, setAmt] = useState(min);
  useEffect(() => { setAmt(min); }, [min, lot?.id, lot?.cur_bid]);
  if (!lot) return <p className="text-muted">Bringing up the next player…</p>;

  const stage = room.call_stage;
  const iLead = lot.high_bidder_id === me.id;
  const overPurse = me_m && min > me_m.purse_remaining;
  const squadFull = myCounts.squad >= room.max_squad;
  const overseasFull = lot.overseas && myCounts.overseas >= room.max_overseas;
  const blocked = squadFull ? `Squad full (max ${room.max_squad})` : overseasFull ? `Overseas quota full (max ${room.max_overseas})` : null;
  const canBid = stage < 3 && !iLead && me_m && !overPurse && !blocked;
  const canSkip = stage === 0 && !lot.high_bidder_id && !iSkipped;
  const secs = Math.max(0, Math.ceil((Date.parse(room.call_deadline) - now) / 1000));
  const callLeft = Math.max(0, Date.parse(room.call_deadline) - now);
  const callProgress = stage === 1 || stage === 2 ? 1 - Math.min(callLeft, 3000) / 3000 : 0;
  const stampLabel = room.last_status === "sold" ? "Sold" : room.last_status === "skipped" ? "Skipped" : "Unsold";

  return (
    <div className="space-y-3">
      {setBanner && <SetIntro banner={setBanner} />}
      {(stage === 1 || stage === 2) && <CallBanner stage={stage} progress={callProgress} secs={Math.ceil(callLeft / 1000)} />}
      <div className="hero-grad gold-top relative overflow-hidden rounded-3xl p-8 text-cream">
      {stage === 3 && <div className="pointer-events-none absolute inset-0 flash" style={{ background: room.last_status === "sold" ? "rgba(52,211,153,.5)" : "rgba(244,63,94,.4)" }} />}
      {stage === 3 && (
        <div className="sold-stamp absolute right-6 top-6 z-10 rounded-xl border-4 px-4 py-2 text-3xl font-black uppercase"
          style={{ borderColor: room.last_status === "sold" ? "#34d399" : "#fca5a5", color: room.last_status === "sold" ? "#34d399" : "#fca5a5", transform: "rotate(-12deg)" }}>
          {stampLabel}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase luxe text-gold" style={{ background: "rgba(231,199,107,.12)" }}>{lot.tier || "Tier"} · {lot.category || lot.set_name || "Lot"} · {queuedCount} left</span>
        {stage === 0 && (
          <div className={"shrink-0 rounded-2xl border px-5 py-3 text-center tabular-nums " + (secs <= 5 ? "border-rose-400/50 text-rose-200 alarm-pulse" : "border-white/15 text-cream")}
            style={{ background: secs <= 5 ? "rgba(190,18,60,.28)" : "rgba(0,0,0,.34)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-cream-dim">Timer</div>
            <div style={serif} className="text-4xl leading-none">{secs}s</div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 style={serif} className="flex items-center gap-2 sm:gap-3 text-3xl sm:text-5xl leading-none flex-wrap"><CountryFlag country={lot.country} /><span>{lot.player_name}</span></h2>
          {stage < 3 && (
            <button onClick={onSkip} disabled={!canSkip}
              title={lot.high_bidder_id ? "Bidding has started" : iSkipped ? "You chose to skip this player" : "Vote to skip this player"}
              className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs sm:px-3 transition disabled:cursor-not-allowed disabled:opacity-60 font-semibold " + (iSkipped ? "border-amber-300/50 bg-amber-300/15 text-gold" : "border-white/20 bg-white/10 text-cream hover:bg-white/15")}>
              <SkipForward className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">{iSkipped ? "Skipped" : "Skip"}</span><span className="sm:hidden">{iSkipped ? "Skip" : "S"}</span> {skipCount}/{memberCount}
            </button>
          )}
          {lot.overseas && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-cream-dim"><Globe className="h-3 w-3 shrink-0" /> Overseas</span>}
        </div>
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-cream-dim">{lot.role} · {lot.country} · base {fmtCr(lot.base_price)}{room.last_status === "skipped" ? " · skipped unsold" : ""}</p>
      </div>

      <div className="mt-6 sm:mt-8 flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-[10px] sm:text-[11px] uppercase luxe text-cream-dim">{lot.cur_bid != null ? "Current bid" : "No bids yet"}</p>
          <p style={serif} className="text-3xl sm:text-5xl tabular-nums text-gold leading-none">{lot.cur_bid != null ? fmtCr(lot.cur_bid) : fmtCr(lot.base_price)}</p>
          {lot.high_team && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 sm:px-3 text-xs sm:text-xs font-semibold text-white whitespace-nowrap" style={{ background: franchiseColor(lot.high_team) }}><Crown className="h-3.5 w-3.5 shrink-0" /> {iLead ? "You lead" : lot.high_team}</span>}
        </div>

        {stage < 3 && (
          <div className="w-full sm:w-auto sm:max-w-xs">
            {iLead ? <p className="rounded-xl bg-emerald-500/15 py-2.5 sm:py-3 px-2 sm:px-3 text-center text-xs sm:text-sm font-semibold text-emerald-300">You're the top bidder</p>
              : blocked ? <p className="rounded-xl bg-rose-500/15 py-2.5 sm:py-3 px-2 sm:px-3 text-center text-xs sm:text-sm font-semibold text-rose-300">{blocked}</p>
              : overPurse ? <p className="rounded-xl bg-rose-500/15 py-2.5 sm:py-3 px-2 sm:px-3 text-center text-xs sm:text-sm font-semibold text-rose-300">Next bid is over your purse</p>
              : (
                <>
                  <div className="flex gap-2">
                    <input type="number" value={amt} min={min} step={10} onChange={(e) => setAmt(Number(e.target.value))}
                      className="w-full rounded-full border border-white/20 bg-black/20 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm tabular-nums text-cream outline-none" />
                    <button disabled={!canBid || bidBusy} onClick={() => onBid(Math.max(min, Number(amt)))} className="btn-gold shrink-0 rounded-full px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold disabled:opacity-60 whitespace-nowrap">Bid</button>
                  </div>
                  <p className="mt-2 text-center text-[10px] sm:text-xs text-cream-dim">Min {fmtCr(min)} · purse {fmtCr(me_m?.purse_remaining)} · squad {myCounts.squad}/{room.max_squad}</p>
                </>
              )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function SetIntro({ banner }) {
  return (
    <div className="set-panel relative overflow-hidden rounded-2xl border border-amber-300/50 px-5 py-5 text-cream shadow-xl"
      style={{ background: "linear-gradient(135deg,#16130D 0%,#2B2212 54%,#17130C 100%)" }}>
      <div className="set-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 skew-x-[-18deg]" style={{ background: "linear-gradient(90deg,transparent,rgba(231,199,107,.22),transparent)" }} />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase luxe text-gold">Now entering</p>
          <h3 style={serif} className="mt-1 text-4xl leading-none sm:text-5xl">{banner.tier}</h3>
        </div>
        <div className="text-left sm:text-right">
          <p style={serif} className="text-3xl leading-none text-gold sm:text-4xl">{banner.category}</p>
          <p className="mt-2 text-xs uppercase tracking-[.24em] text-cream-dim">Auction set</p>
        </div>
      </div>
      <div className="set-bar relative mt-4 h-1 rounded-full bg-gold" />
    </div>
  );
}

function CallBanner({ stage, progress, secs }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const stroke = c * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <div className="call-ribbon call-glow alarm-pulse rounded-2xl border px-6 py-4"
      style={{ background: stage === 1 ? "rgba(231,199,107,.16)" : "rgba(190,18,60,.13)", borderColor: stage === 1 ? "rgba(194,161,78,.55)" : "rgba(251,113,133,.45)" }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase luxe text-muted">Auctioneer call</span>
          <p style={serif} className={"mt-1 text-4xl leading-none sm:text-5xl " + (stage === 1 ? "text-gold" : "text-rose-500")}>{stage === 1 ? "Going once" : "Going twice"}</p>
        </div>
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(22,19,13,.14)" strokeWidth="6" />
            <circle cx="36" cy="36" r={r} fill="none" stroke={stage === 1 ? "#C2A14E" : "#E11D48"} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={stroke} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-black tabular-nums text-ink">{Math.max(0, secs)}</span>
        </div>
      </div>
    </div>
  );
}

function EndAuctionBanner({ members, agreeIds, iAgreed, onAgree }) {
  const agreed = members.filter((m) => agreeIds.includes(m.user_id));
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-stone-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 text-gold" />
          <div>
            <p className="text-sm font-semibold">Host requested to end the auction</p>
            <p className="mt-0.5 text-xs text-stone-500">{agreed.length}/{members.length} teams agreed. The auction ends when everyone agrees.</p>
          </div>
        </div>
        <button onClick={onAgree} disabled={iAgreed} className="btn-gold inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60">
          <CheckCircle2 className="h-4 w-4" /> {iAgreed ? "Agreed" : "Agree to end"}
        </button>
      </div>
    </div>
  );
}

function TeamRail({ members, lot, room, meId, sold, localStream, remoteStreams }) {
  const [openTeam, setOpenTeam] = useState(null);
  const ordered = [...members].sort((a, b) => {
    if (a.user_id === meId) return -1;
    if (b.user_id === meId) return 1;
    return b.purse_remaining - a.purse_remaining;
  });
  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Users className="h-4 w-4 text-gold" /> Squad board ({members.length})</h3>
      </div>
      {ordered.map((m) => {
        const lead = lot && lot.high_team === m.team_name;
        const squad = sold.filter((s) => s.sold_to === m.user_id);
        const overseas = squad.filter((s) => s.overseas).length;
        const domestic = squad.length - overseas;
        const spent = squad.reduce((t, s) => t + (s.sold_price || 0), 0);
        const squadLeft = Math.max(0, room.max_squad - squad.length);
        const overseasLeft = Math.max(0, room.max_overseas - overseas);
        const minNeeded = Math.max(0, room.min_squad - squad.length);
        const open = openTeam === m.user_id;
        const roleGroups = ROLE_SLOTS.map((slot) => ({ ...slot, players: squad.filter(slot.match) }));
        const videoStream = m.user_id === meId ? localStream : remoteStreams[m.user_id];
        return (
          <div key={m.user_id} className={"bg-paper rounded-xl p-3 " + (lead ? "ring-2" : "border-hair")} style={lead ? { boxShadow: "0 0 0 2px " + franchiseColor(m.team_name) } : {}}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-white" style={{ background: franchiseColor(m.team_name) }}>{m.team_short}</span>
                {videoStream && <VideoThumb stream={videoStream} muted={m.user_id === meId} label={m.user_id === meId ? "You" : m.team_short} />}
                <div className="min-w-0">
                  <span className="text-ink text-sm font-medium">{m.display_name || (m.user_email || "").split("@")[0]}{m.user_id === meId ? " (you)" : ""}</span>
                  <p className="text-[11px] text-muted">{m.team_short} · spent {fmtCr(spent)}</p>
                </div>
              </div>
              <span className="text-gold text-sm font-semibold tabular-nums">{fmtCr(m.purse_remaining)}</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <LimitCard label="Squad" count={squad.length} max={room.max_squad} left={squadLeft} footer={minNeeded ? `${minNeeded} to min` : "min met"} good={!minNeeded} />
              <LimitCard label="Domestic" count={domestic} max={room.max_squad} left={squadLeft} footer={`${domestic} local`} />
              <LimitCard label="Foreign" count={overseas} max={room.max_overseas} left={overseasLeft} footer={`${overseasLeft} slots`} warn={overseas >= room.max_overseas} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {squad.length > 0 ? squad.map((p) => (
                <span key={p.id} className="max-w-full truncate rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-600">
                  <CountryFlag country={p.country} /> {p.player_name}
                </span>
              )) : <span className="rounded-full bg-stone-50 px-2 py-1 text-[11px] text-muted">No players yet</span>}
            </div>

            <button onClick={() => setOpenTeam(open ? null : m.user_id)}
              className="mt-3 flex w-full items-center justify-between rounded-lg border border-stone-200 px-2.5 py-2 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-stone-50">
              <span>View squad</span>
              <ChevronDown className={"h-4 w-4 transition-transform shrink-0 " + (open ? "rotate-180" : "")} />
            </button>

            {open && (
              <div className="squad-surface mt-3 space-y-3 rounded-xl p-3">
                <div className="squad-soft rounded-xl p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-gold">Roster health</span>
                    <span className={"rounded-full border px-2 py-0.5 text-[10px] font-bold " + (minNeeded ? "slot-danger" : "slot-safe")}>
                      {minNeeded ? `${minNeeded} short of min` : "minimum reached"}
                    </span>
                  </div>
                  <SlotTrack count={squad.length} max={room.max_squad} min={room.min_squad} />
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <TinyMetric label="Bought" value={squad.length} />
                    <TinyMetric label="Need min" value={minNeeded} warn={!!minNeeded} />
                    <TinyMetric label="Open" value={squadLeft} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <SlotMeter label="Squad slots" count={squad.length} max={room.max_squad} min={room.min_squad} />
                  <SlotMeter label="Foreign slots" count={overseas} max={room.max_overseas} cap />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <SlotDetail label="Domestic" count={domestic} max={room.max_squad} left={squadLeft} />
                  <SlotDetail label="Foreign" count={overseas} max={room.max_overseas} left={overseasLeft} warn={overseas >= room.max_overseas} />
                </div>
                <div className="space-y-2">
                  {roleGroups.map((group) => (
                    <div key={group.key} className="squad-slot rounded-xl p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold">{group.label}</span>
                        <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold tabular-nums text-ink">{group.players.length}</span>
                      </div>
                      {group.players.length > 0 ? (
                        <div className="grid gap-1.5">
                          {group.players.map((p) => <SquadPlayerCard key={p.id} player={p} />)}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-stone-300 bg-paper/70 px-2 py-3 text-center text-[11px] font-medium text-muted">Open role slot</div>
                      )}
                    </div>
                  ))}
                  {squad.length >= room.max_squad && (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-rose-500"><ShieldCheck className="h-3.5 w-3.5" /> Squad size cap reached</p>
                  )}
                  {overseas >= room.max_overseas && (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-rose-500"><Globe className="h-3.5 w-3.5" /> Foreign player cap reached</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LimitCard({ label, count, max, left, footer, warn, good }) {
  return (
    <div className={"rounded-lg border px-2 py-2 " + (warn ? "border-rose-200 bg-rose-50 text-rose-500" : good ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-paper text-stone-600")}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium">{label}</span>
        <span className="text-[10px] text-muted">{left} left</span>
      </div>
      <div className="mt-1 font-semibold tabular-nums text-ink">{count}/{max}</div>
      <div className="mt-1 h-1 rounded-full bg-stone-200">
        <div className={(warn ? "bg-rose-500" : good ? "bg-emerald-500" : "bg-gold") + " h-1 rounded-full"} style={{ width: `${Math.min(100, (count / Math.max(1, max)) * 100)}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-muted">{footer || `${left} left`}</div>
    </div>
  );
}

function SlotDetail({ label, count, max, left, warn }) {
  return (
    <div className={"rounded-lg border px-2 py-2 " + (warn ? "border-rose-200 bg-rose-50 text-rose-500" : "border-stone-200 bg-paper text-stone-600")}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{count}/{max}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted">{left} slots left</p>
    </div>
  );
}

function SlotMeter({ label, count, max, min, cap }) {
  const filled = Math.min(count, max);
  const ok = cap ? count < max : count >= min;
  const left = Math.max(0, max - count);
  return (
    <div className="rounded-lg border border-stone-200 bg-paper px-2 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-stone-600">{label}</span>
        <span className={(ok ? "text-emerald-600" : "text-rose-500") + " font-semibold tabular-nums"}>{count}/{max}</span>
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(max, 25)}, minmax(0, 1fr))` }}>
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} className={"h-1.5 rounded-full " + (i < filled ? (cap ? "bg-gold" : "bg-emerald-500") : "bg-stone-200")} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-stone-400">{cap ? `${left} foreign slots left` : `min ${min} · ${left} open`}</p>
    </div>
  );
}

function SquadPlayerCard({ player }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-paper px-2.5 py-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink"><CountryFlag country={player.country} /> {player.player_name}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted">{player.role} · {player.country}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className={"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold " + (player.overseas ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
            {player.overseas && <Globe className="h-2.5 w-2.5" />}{player.overseas ? "FOR" : "DOM"}
          </span>
          <p className="mt-1 text-[10px] font-semibold tabular-nums text-gold">{fmtCr(player.sold_price)}</p>
        </div>
      </div>
    </div>
  );
}

function TinyMetric({ label, value, warn }) {
  return (
    <div className={"rounded-lg border px-2 py-2 " + (warn ? "slot-danger" : "border-stone-200 bg-paper text-stone-600")}>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div style={serif} className="mt-0.5 text-lg leading-none tabular-nums text-ink">{value}</div>
    </div>
  );
}

function CountryFlag({ country }) {
  if (isWestIndies(country)) {
    return (
      <span className="wi-flag" title="West Indies">
        <span className="wi-flag-sun" />
        <span className="wi-flag-palm" />
        <span className="wi-flag-stumps" />
      </span>
    );
  }
  return <span>{flagFor(country)}</span>;
}

function SlotTrack({ count, max, min }) {
  const filled = Math.min(count, max);
  const minMark = `${Math.min(100, (min / Math.max(1, max)) * 100)}%`;
  return (
    <div>
      <div className="relative h-3 rounded-full bg-stone-200">
        <div className="h-3 rounded-full bg-gold" style={{ width: `${Math.min(100, (filled / Math.max(1, max)) * 100)}%` }} />
        <span className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink" style={{ left: minMark }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-stone-400">
        <span>0</span>
        <span>min {min}</span>
        <span>max {max}</span>
      </div>
    </div>
  );
}

function Results({ room, members, lots }) {
  const sold = lots.filter((l) => l.status === "sold");
  const ordered = [...members].map((m) => {
    const squad = sold.filter((s) => s.sold_to === m.user_id);
    return { ...m, squad, spent: squad.reduce((t, s) => t + (s.sold_price || 0), 0), overseas: squad.filter((s) => s.overseas).length };
  }).sort((a, b) => b.squad.length - a.squad.length || b.spent - a.spent);
  return (
    <div className="space-y-5">
      <div className="hero-grad gold-top rounded-3xl px-8 py-8 text-center text-cream">
        <Trophy className="mx-auto h-8 w-8 text-gold" />
        <h2 style={serif} className="mt-3 text-4xl">Auction complete</h2>
        <p className="mt-2 text-sm text-cream-dim">{sold.length} sold · {lots.filter((l) => l.status === "unsold").length} unsold</p>
      </div>
      {ordered.map((m) => (
        <div key={m.user_id} className="bg-paper border-hair rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: franchiseColor(m.team_name) }}>{m.team_short}</span>
              <span style={serif} className="text-ink text-xl">{m.team_name}</span>
            </div>
            <div className="text-right text-sm">
              <span className={"font-medium " + (m.squad.length >= room.min_squad ? "text-emerald-600" : "text-rose-500")}>{m.squad.length}/{room.max_squad} players</span>
              <span className="text-muted"> · {m.overseas} overseas · spent </span><span className="text-ink font-semibold tabular-nums">{fmtCr(m.spent)}</span>
            </div>
          </div>
          {m.squad.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {m.squad.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
                  <span className="text-ink"><CountryFlag country={s.country} /> {s.player_name} <span className="text-muted">· {s.role}</span></span>
                  <span className="text-gold font-semibold tabular-nums">{fmtCr(s.sold_price)}</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-muted">No players bought.</p>}
        </div>
      ))}
    </div>
  );
}

function RulesModal({ room, onClose }) {
  const rules = [
    {
      title: "Player Pool & Sets",
      icon: "🎯",
      content: `Players are organized into ${SET_ORDER.length} distinct sets that come up in order: ${SET_ORDER.join(" → ")}. Each set includes players from different roles and tiers. The auctioneer presents players sequentially within their sets.`
    },
    {
      title: "Squad Requirements",
      icon: "👥",
      content: `Each team must have: Minimum ${room.min_squad} players · Maximum ${room.max_squad} players · At most ${room.max_overseas} overseas players. You won't be allowed to bid if these constraints would be violated.`
    },
    {
      title: "Auction Stages",
      icon: "🔨",
      content: `1. Open: First bid can come in. 2. Going once: 3-second call period. 3. Going twice: Final 3-second call. 4. Sold/Unsold: Player status finalized. Bid anytime during "Open" stage to take the lead.`
    },
    {
      title: "Skip Rule",
      icon: "⏭️",
      content: `During the Open stage (before any bid), vote to skip the current player. All members must unanimously agree to skip. A skipped player goes to Unsold and you move to the next lot.`
    },
    {
      title: "Bidding & Purse",
      icon: "💰",
      content: `You start with a purse (pool of money) to spend. Each bid deducts the full amount. You can't bid more than your remaining purse. Once you win a player, their bid amount is locked in your spent total.`
    },
    {
      title: "Winning a Lot",
      icon: "🏆",
      content: `You automatically win when the auctioneer calls "Sold" after no new bids during Going twice. You must have purse remaining and squad slots available. Oversold or squad-full players can't be won.`
    },
    {
      title: "Host Controls",
      icon: "⚙️",
      content: `The host (room creator) can request to end the auction early. All teams must agree to end. Once ended, results are finalized and no more bids are accepted.`
    },
    {
      title: "Sound & Accessibility",
      icon: "🔊",
      content: `Toggle sound on/off to control auctioneer calls and bidding alerts. Sound helps you stay in sync with the auction pacing and stage transitions.`
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0, 0, 0, 0.6)" }} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(28, 26, 19, 0.98), rgba(15, 13, 9, 0.98))", border: "2px solid #DcBd6a" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gold/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(220, 189, 106, 0.15)" }}>
              <BookOpen className="h-5 w-5 text-gold" />
            </div>
            <h2 style={serif} className="text-3xl text-gold">Auction Rules</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-cream hover:text-gold transition">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-4">
          {rules.map((rule, idx) => (
            <div key={idx} className="rounded-xl p-4" style={{ background: "rgba(220, 189, 106, 0.08)", border: "1px solid rgba(220, 189, 106, 0.2)" }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{rule.icon}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gold">{rule.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-dim">{rule.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gold/30 px-6 py-4 bg-black/20">
          <p className="text-center text-xs text-cream-dim">
            <span className="text-gold font-semibold">Pro tip:</span> Keep track of purse remaining and squad slots. Plan your bids wisely!
          </p>
        </div>
      </div>
    </div>
  );
}
