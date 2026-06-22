// Supabase Edge Function: emails the user whenever a notification row is created.
// Deploy:  supabase functions deploy notify-email --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=...  NOTIFY_FROM="Aucta <noreply@yourdomain.com>"
// Then add a Database Webhook (Database → Webhooks): INSERT on public.notifications → this function URL.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM") || "Aucta <onboarding@resend.dev>";

const inr = (n: number | null) =>
  n == null ? "" : "₹" + Number(n).toLocaleString("en-IN");

function compose(n: Record<string, any>) {
  const item = n.item_title || "your item";
  switch (n.kind) {
    case "listed":
      return {
        subject: `Your item is scheduled — ${item}`,
        line: `Good news — “${item}” has been verified and scheduled for ${n.auction_name}. It will go under the hammer when the auction goes live.`,
      };
    case "won":
      return {
        subject: `You won “${item}” on Aucta`,
        line: `Congratulations — you won “${item}” for ${inr(n.amount)}. Collect from seller ${n.counterparty}. We'll share contact details to arrange the handover.`,
      };
    case "sold":
      return {
        subject: `Your item sold — ${item}`,
        line: `“${item}” sold for ${inr(n.amount)} to ${n.counterparty} in ${n.auction_name}. We'll connect you to arrange handover and payment.`,
      };
    case "unsold":
      return {
        subject: `“${item}” didn't sell`,
        line: `“${item}” had no winning bid in ${n.auction_name}. We can re-list it in a future auction for you.`,
      };
    default:
      return { subject: "Aucta update", line: "You have a new update on Aucta." };
  }
}

function html(line: string) {
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#16130D">
    <div style="font-size:22px;font-weight:600;color:#9A7A2C;letter-spacing:.5px">AUCTA</div>
    <p style="font-size:15px;line-height:1.6;margin:18px 0">${line}</p>
    <p style="font-size:12px;color:#8A8273;margin-top:28px">You're receiving this because you have an Aucta account. — Bid with confidence.</p>
  </div>`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record || body; // Supabase webhook puts the row in `record`
    if (!record?.user_email) return new Response("no recipient", { status: 200 });
    if (!RESEND_API_KEY) return new Response("RESEND_API_KEY not set", { status: 500 });

    const { subject, line } = compose(record);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: NOTIFY_FROM, to: record.user_email, subject, html: html(line) }),
    });
    if (!res.ok) return new Response(`email failed: ${await res.text()}`, { status: 500 });
    return new Response("sent", { status: 200 });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 500 });
  }
});
