import { supabase, type Link } from "@/lib/supabase";

// Today's date in your timezone (YYYY-MM-DD). Change if you are not on Eastern time.
const TZ = "America/New_York";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const daysUntil = (d: string) =>
  Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 86400000);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function row(l: Link, label: string, color: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eee">
      <a href="${esc(l.url)}" style="color:#1f1247;font-weight:600;text-decoration:none">${esc(l.title)}</a><br/>
      <span style="font-size:12px;color:#777">${esc(l.category)}</span>
      <span style="font-size:12px;color:${color};font-weight:600"> &middot; ${label}</span>
    </td></tr>`;
}

export async function GET(request: Request) {
  // Only you (or Vercel's cron) can trigger this
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const given =
    request.headers.get("authorization")?.replace("Bearer ", "") || url.searchParams.get("key");
  if (!secret || given !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.DIGEST_TO;
  if (!apiKey || !to) {
    return new Response("Missing RESEND_API_KEY or DIGEST_TO", { status: 500 });
  }

  const { data, error } = await supabase.from("links").select("*").eq("status", "todo");
  if (error) return new Response("Database error: " + error.message, { status: 500 });

  const open = (data || []) as Link[];
  const withDue = open.filter((l) => l.due_date);
  const overdue = withDue
    .filter((l) => daysUntil(l.due_date as string) < 0)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));
  const soon = withDue
    .filter((l) => {
      const n = daysUntil(l.due_date as string);
      return n >= 0 && n <= 7;
    })
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));

  const siteUrl = process.env.SITE_URL || url.origin;

  const overdueRows = overdue
    .map((l) => row(l, `${-daysUntil(l.due_date as string)}d overdue`, "#be123c"))
    .join("");
  const soonRows = soon
    .map((l) => {
      const n = daysUntil(l.due_date as string);
      return row(l, n === 0 ? "due today" : `due in ${n}d`, "#b45309");
    })
    .join("");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f1247">
    <h1 style="font-size:22px;margin:0 0 4px">Your week in Pending</h1>
    <p style="margin:0 0 20px;color:#777">${open.length} open &middot; ${overdue.length} overdue &middot; ${soon.length} due this week</p>
    ${overdue.length ? `<h2 style="font-size:15px;color:#be123c;margin:20px 0 4px">Overdue</h2><table width="100%" cellspacing="0">${overdueRows}</table>` : ""}
    ${soon.length ? `<h2 style="font-size:15px;color:#b45309;margin:20px 0 4px">Due this week</h2><table width="100%" cellspacing="0">${soonRows}</table>` : ""}
    ${!overdue.length && !soon.length ? `<p>Nothing overdue or due this week. Nice work.</p>` : ""}
    <p style="margin-top:28px"><a href="${esc(siteUrl)}" style="background:#c4b5fd;color:#1f1247;padding:10px 18px;border-radius:12px;text-decoration:none;font-weight:600">Open my list</a></p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Pending <onboarding@resend.dev>",
      to: [to],
      subject: overdue.length
        ? `Pending: ${overdue.length} overdue, ${soon.length} due this week`
        : `Pending: ${soon.length} due this week`,
      html,
    }),
  });

  if (!res.ok) return new Response("Email failed: " + (await res.text()), { status: 500 });
  return new Response("Digest sent", { status: 200 });
}