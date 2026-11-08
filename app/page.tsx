"use client";

import { useEffect, useState } from "react";
import { Manrope } from "next/font/google";
import { supabase, type Link } from "@/lib/supabase";

const manrope = Manrope({ subsets: ["latin"] });

const TINTS = [
  "bg-amber-400/10 text-amber-200/80 border-amber-300/10",
  "bg-sky-400/10 text-sky-200/80 border-sky-300/10",
  "bg-fuchsia-400/10 text-fuchsia-200/80 border-fuchsia-300/10",
  "bg-teal-400/10 text-teal-200/80 border-teal-300/10",
  "bg-rose-400/10 text-rose-200/80 border-rose-300/10",
  "bg-violet-400/10 text-violet-200/80 border-violet-300/10",
];
const tint = (name: string) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % TINTS.length;
  return TINTS[h];
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d: string) =>
  Math.round((new Date(d).getTime() - new Date(todayStr()).getTime()) / 86400000);
const domain = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
};

function dueChip(due: string | null) {
  if (!due) return null;
  const n = daysUntil(due);
  if (n < 0) return { text: `${-n}d overdue`, style: "bg-rose-400/15 text-rose-200 border-rose-300/10" };
  if (n === 0) return { text: "Due today", style: "bg-amber-400/15 text-amber-200 border-amber-300/10" };
  if (n <= 3) return { text: `Due in ${n}d`, style: "bg-amber-400/10 text-amber-200/80 border-amber-300/10" };
  return { text: `Due ${due}`, style: "bg-white/5 text-white/50 border-white/10" };
}

type View = "open" | "soon" | "closed";

const Icon = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const ICON = {
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

const field =
  "w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-300/60 [color-scheme:dark]";

export default function Home() {
  const [links, setLinks] = useState<Link[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [newCat, setNewCat] = useState("");
  const [due, setDue] = useState("");
  const [view, setView] = useState<View>("open");
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setLinks(data as Link[]);
  }
  useEffect(() => { load(); }, []);

  const categories = Array.from(new Set(["General", ...links.map((l) => l.category)])).sort();

  async function addLink() {
    if (!url.trim()) return;
    const clean = url.startsWith("http") ? url.trim() : `https://${url.trim()}`;
    const finalCategory = category === "__new" ? newCat.trim() || "General" : category;
    const { error } = await supabase.from("links").insert({
      url: clean,
      title: title.trim() || domain(clean),
      category: finalCategory,
      due_date: due || null,
    });
    if (error) return setError(error.message);
    setUrl(""); setTitle(""); setDue(""); setNewCat("");
    setCategory(finalCategory); setError(""); setShowAdd(false);
    load();
  }

  async function toggle(l: Link) {
    await supabase.from("links").update({ status: l.status === "todo" ? "done" : "todo" }).eq("id", l.id);
    load();
  }
  async function remove(id: string) {
    await supabase.from("links").delete().eq("id", id);
    load();
  }

  const open = links.filter((l) => l.status === "todo");
  const overdue = open.filter((l) => l.due_date && daysUntil(l.due_date) < 0);
  const inView = links.filter((l) => {
    if (view === "closed") return l.status === "done";
    if (l.status !== "todo") return false;
    if (view === "soon") return !!l.due_date && daysUntil(l.due_date) <= 7;
    return true;
  });
  const visible = inView.filter((l) => filter === "all" || l.category === filter);

  const heading = { open: "Open links", soon: "Due soon", closed: "Closed links" }[view];
  const empty = {
    open: "Nothing open. Add a link when something comes up.",
    soon: "Nothing due in the next 7 days.",
    closed: "Nothing closed yet.",
  }[view];

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "open", label: "Open", count: open.length },
    { id: "soon", label: "Due soon" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <main
      className={`${manrope.className} min-h-screen px-5 py-12 text-white sm:px-10`}
      style={{
        background:
          "radial-gradient(900px 500px at 15% 0%, rgba(120,80,200,0.22), transparent 60%), radial-gradient(700px 500px at 100% 100%, rgba(90,50,160,0.18), transparent 60%), #120c1f",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/60">YOUR ACTION QUEUE</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl">
          Finish what <span className="text-violet-300">you open.</span>
        </h1>

        {/* Summary */}
        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Open", n: open.length, note: "links waiting", icon: ICON.link, box: "bg-violet-400/20 text-violet-200" },
            { label: "Overdue", n: overdue.length, note: "needs attention", icon: ICON.clock, box: "bg-rose-400/15 text-rose-200" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 ${s.box}`}>
                <Icon d={s.icon} />
              </div>
              <div>
                <p className="text-sm text-white/60">{s.label}</p>
                <p className="text-4xl font-semibold">{s.n}</p>
              </div>
              <p className="ml-auto text-sm text-white/40">{s.note}</p>
            </div>
          ))}
        </section>

        {/* Main panel */}
        <section className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex rounded-2xl border border-white/10 bg-black/20 p-1">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setView(t.id)}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm transition ${view === t.id ? "bg-white/10 font-semibold text-white" : "text-white/50 hover:text-white/80"}`}>
                  {t.label}
                  {t.count !== undefined && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{t.count}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="flex flex-wrap gap-2">
              {["all", ...categories].map((c) => (
                <button key={c} onClick={() => setFilter(c)}
                  className={`rounded-full px-4 py-2 text-sm transition ${filter === c ? "bg-violet-300 font-semibold text-[#1f1247]" : "border border-white/10 text-white/60 hover:text-white"}`}>
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <h2 className="font-semibold">{heading}</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/40">{visible.length} {visible.length === 1 ? "item" : "items"}</span>
              <button onClick={() => setShowAdd(!showAdd)}
                className="rounded-full bg-violet-300 px-4 py-1.5 text-sm font-semibold text-[#1f1247] hover:bg-violet-200">
                {showAdd ? "Cancel" : "Add link"}
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="mt-4 space-y-2.5 rounded-3xl border border-white/10 bg-black/20 p-4">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link" className={field} />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (optional)" className={field} />
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} flex-1`}>
                  {categories.map((c) => <option key={c} value={c} className="bg-[#1f1247]">{c}</option>)}
                  <option value="__new" className="bg-[#1f1247]">New category...</option>
                </select>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${field} flex-1`} />
              </div>
              {category === "__new" && (
                <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" className={field} />
              )}
              <button onClick={addLink} className="w-full rounded-xl bg-violet-300 p-3 text-sm font-semibold text-[#1f1247] hover:bg-violet-200">
                Save link
              </button>
              {error && <p className="text-sm text-rose-300">{error}</p>}
            </div>
          )}

          {visible.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-white/10 bg-black/10 p-8 text-center text-white/40">{empty}</p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {visible.map((l) => {
                const d = l.status === "todo" ? dueChip(l.due_date) : null;
                return (
                  <li key={l.id} className="flex flex-col rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={`rounded-lg border px-3 py-1.5 ${tint(l.category)}`}>{l.category}</span>
                      {d && <span className={`rounded-lg border px-3 py-1.5 ${d.style}`}>{d.text}</span>}
                      {l.status === "done" && (
                        <span className="flex items-center gap-1.5 rounded-lg border border-teal-300/10 bg-teal-400/10 px-3 py-1.5 text-teal-200/80">
                          <Icon d={ICON.check} className="h-3.5 w-3.5" /> Completed
                        </span>
                      )}
                    </div>
                    <h3 className={`mt-5 text-2xl font-medium tracking-tight ${l.status === "done" ? "text-white/60" : ""}`}>{l.title}</h3>
                    <a href={l.url} target="_blank" rel="noreferrer"
                      className="mt-2 flex items-center gap-2 text-white/45 hover:text-white/80">
                      {domain(l.url)} <Icon d={ICON.arrow} className="h-4 w-4" />
                    </a>
                    <div className="mt-5 flex gap-4 text-sm text-white/40">
                      <button onClick={() => toggle(l)} className="hover:text-teal-200">
                        {l.status === "todo" ? "Mark done" : "Reopen"}
                      </button>
                      <button onClick={() => remove(l.id)} className="hover:text-rose-300">Remove</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}