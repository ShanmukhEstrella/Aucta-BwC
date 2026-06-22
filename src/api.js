import { supabase } from "./supabaseClient";

/* ---------- formatting helpers (shared) ---------- */
export function fmtWhen(ms) {
  if (!ms) return "Time to be set";
  const d = new Date(ms);
  return (
    d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

/* ---------- row → UI shape mappers ---------- */
const mapAuction = (a) => ({
  id: a.id,
  name: a.name,
  startAt: a.start_at ? +new Date(a.start_at) : null,
  autoStart: a.auto_start,
  status: a.status,
  endsAt: a.ends_at ? +new Date(a.ends_at) : null,
  dateLabel: a.start_at ? fmtWhen(+new Date(a.start_at)) : "Time to be set",
});

const mapListing = (l) => ({
  id: l.id,
  sellerName: l.seller_name || (l.seller_email ? l.seller_email.split("@")[0] : ""),
  sellerId: l.seller_id,
  title: l.title,
  category: l.category,
  condition: l.condition,
  description: l.description,
  basePrice: Number(l.base_price),
  image: l.image_url,
  status: l.status,
  auctionId: l.auction_id,
  currentBid: l.current_bid == null ? null : Number(l.current_bid),
  highBidder: l.high_bidder_name || (l.high_bidder_email ? l.high_bidder_email.split("@")[0] : ""),
  highBidderId: l.high_bidder_id,
  bidCount: l.bid_count,
});

const mapNotif = (n) => ({
  id: n.id,
  user: n.user_email,
  kind: n.kind,
  itemTitle: n.item_title,
  auctionName: n.auction_name,
  amount: n.amount == null ? null : Number(n.amount),
  buyer: n.counterparty,
  seller: n.counterparty,
  ts: +new Date(n.created_at),
});

/* ---------- bulk fetch + derived structures ---------- */
export async function fetchAll(uid) {
  const [au, li, parts, notifs, watch, bids] = await Promise.all([
    supabase.from("auctions").select("*"),
    supabase.from("listings").select("*"),
    supabase.from("participants").select("auction_id,user_id"),
    uid
      ? supabase.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    uid ? supabase.from("watchlists").select("listing_id").eq("user_id", uid) : Promise.resolve({ data: [] }),
    uid ? supabase.from("bids").select("listing_id").eq("bidder_id", uid) : Promise.resolve({ data: [] }),
  ]);

  const participants = parts.data || [];
  const auctions = (au.data || [])
    .map((a) => ({ ...mapAuction(a), participantCount: participants.filter((p) => p.auction_id === a.id).length }))
    .sort((x, y) => (x.startAt || 0) - (y.startAt || 0));
  const listings = (li.data || []).map(mapListing);
  const joinedSet = new Set(participants.filter((p) => p.user_id === uid).map((p) => p.auction_id));
  const watchSet = new Set((watch.data || []).map((w) => w.listing_id));
  const bidSet = new Set((bids.data || []).map((b) => b.listing_id));
  const notifications = (notifs.data || []).map(mapNotif);

  return { auctions, listings, joinedSet, watchSet, bidSet, notifications };
}

/* ---------- image resize + upload ---------- */
export function resizeToBlob(file, max = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        let { width, height } = im;
        if (width > height && width > max) { height = Math.round((height * max) / width); width = max; }
        else if (height >= width && height > max) { width = Math.round((width * max) / height); height = max; }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        c.getContext("2d").drawImage(im, 0, 0, width, height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Image processing failed"))), "image/jpeg", quality);
      };
      im.onerror = reject;
      im.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(user, file) {
  const blob = await resizeToBlob(file);
  const path = `${user.id}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("lot-images").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("lot-images").getPublicUrl(path).data.publicUrl;
}

/* ---------- actions ---------- */
export const createListing = (user, profile, f) =>
  supabase.from("listings").insert({
    seller_id: user.id, seller_email: user.email,
    seller_name: (profile && profile.display_name) || user.email.split("@")[0],
    title: f.title, category: f.category, condition: f.condition,
    description: f.description, base_price: Number(f.basePrice), image_url: f.image,
    status: "pending", auction_id: null,
  });

export const saveProfile = (uid, fields) =>
  supabase.from("profiles").update({
    display_name: fields.display_name,
    dob: fields.dob || null,
    role_title: fields.role_title,
    location: fields.location,
    onboarded: true,
  }).eq("id", uid);

export const verifyListing   = (id, auctionId) => supabase.rpc("verify_listing", { p_listing_id: id, p_auction_id: auctionId });
export const rejectListing   = (id)            => supabase.rpc("reject_listing", { p_listing_id: id });
export const returnToReview  = (id)            => supabase.rpc("return_to_review", { p_listing_id: id });
export const moveUnsold      = (id, auctionId) => supabase.rpc("move_unsold", { p_listing_id: id, p_auction_id: auctionId });
export const createAuction   = (name, startAt, auto) => supabase.rpc("create_auction", { p_name: name, p_start_at: new Date(startAt).toISOString(), p_auto: auto });
export const rescheduleAuction = (id, startAt, auto) => supabase.rpc("reschedule_auction", { p_id: id, p_start_at: new Date(startAt).toISOString(), p_auto: auto });
export const startAuction    = (id) => supabase.rpc("start_auction", { p_id: id });
export const endAuction      = (id) => supabase.rpc("end_auction", { p_id: id });
export const deleteAuction   = (id) => supabase.rpc("delete_auction", { p_id: id });
export const deleteAllByStatus = (status) => supabase.rpc("delete_auctions_by_status", { p_status: status });
export const placeBid        = (id, amount) => supabase.rpc("place_bid", { p_listing_id: id, p_amount: amount });

export const joinAuction = (user, auctionId) =>
  supabase.from("participants").upsert({ auction_id: auctionId, user_id: user.id, email: user.email });

export const addWatch    = (user, listingId) => supabase.from("watchlists").insert({ user_id: user.id, listing_id: listingId });
export const removeWatch = (user, listingId) => supabase.from("watchlists").delete().eq("user_id", user.id).eq("listing_id", listingId);

export const dismissNotif    = (id)  => supabase.from("notifications").delete().eq("id", id);
export const dismissAllNotifs = (uid) => supabase.from("notifications").delete().eq("user_id", uid);
