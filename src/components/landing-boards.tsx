import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trophy, FileText, Download, Megaphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadFromUrl, formatBytes } from "@/lib/upload";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getNoticeFileUrl } from "@/lib/notices.functions";

type Achievement = {
  id: string;
  title: string;
  description: string | null;
  student_name: string | null;
  achieved_on: string | null;
};

type Notice = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  notice_date: string;
};

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.25em] font-semibold text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-[1.1]">{title}</h2>
      <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">{subtitle}</p>
    </div>
  );
}

export function AchievementWall() {
  const [items, setItems] = useState<Achievement[] | null>(null);
  useEffect(() => {
    supabase
      .from("achievements" as any)
      .select("id,title,description,student_name,achieved_on")
      .order("sort_order", { ascending: true })
      .order("achieved_on", { ascending: false, nullsFirst: false })
      .then(({ data }) => setItems((data as any) ?? []));
  }, []);

  return (
    <section id="achievements" className="py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Header
          eyebrow="Achievement Wall"
          title="Our students, our pride"
          subtitle="Awards, publications and wins earned by CIC members."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items === null && (
            <div className="col-span-full flex justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin" /></div>
          )}
          {items?.length === 0 && (
            <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
              Achievements will appear here soon.
            </p>
          )}
          {items?.map((a, i) => (
            <motion.article
              key={a.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.05 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-gold/15 text-gold flex items-center justify-center">
                  <Trophy size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-foreground leading-snug break-words">{a.title}</h3>
                  {(a.student_name || a.achieved_on) && (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
                      {[a.student_name, fmtDate(a.achieved_on)].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              {a.description && (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-line break-words">{a.description}</p>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function NoticeDownload({ n }: { n: Notice }) {
  const [pct, setPct] = useState<number | null>(null);
  const getUrl = useServerFn(getNoticeFileUrl);
  async function go() {
    if (!n.file_path) return;
    setPct(0);
    try {
      const { url } = await getUrl({ data: { id: n.id } });
      await downloadFromUrl(url, n.file_name || `${n.title}.pdf`, setPct);
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally {
      setPct(null);
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={pct !== null}
      className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy-deep transition hover:brightness-105 disabled:opacity-70"
    >
      {pct !== null ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {pct !== null ? `Downloading… ${pct}%` : "Download PDF"}
    </button>
  );
}

export function NoticeBoard() {
  const [items, setItems] = useState<Notice[] | null>(null);
  useEffect(() => {
    supabase
      .from("notices" as any)
      .select("id,title,body,category,file_path,file_name,file_size,notice_date")
      .order("notice_date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as any) ?? []));
  }, []);

  return (
    <section id="notices" className="py-16 sm:py-24 bg-muted/40 border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Header
          eyebrow="Notice Board"
          title="Latest notices"
          subtitle="Meetups, events and club updates. Download attached PDFs anytime."
        />
        <div className="mt-10 space-y-4">
          {items === null && (
            <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin" /></div>
          )}
          {items?.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-muted-foreground">
              No notices right now.
            </p>
          )}
          {items?.map((n) => (
            <article key={n.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-navy-deep text-gold flex items-center justify-center">
                    {n.file_path ? <FileText size={20} /> : <Megaphone size={20} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gold">
                      {n.category} · {fmtDate(n.notice_date)}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-foreground leading-snug break-words">{n.title}</h3>
                    {n.body && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line break-words">{n.body}</p>
                    )}
                    {n.file_path && (
                      <p className="mt-2 text-xs text-muted-foreground break-all">
                        {n.file_name} {n.file_size ? `· ${formatBytes(n.file_size)}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                {n.file_path && <div className="shrink-0"><NoticeDownload n={n} /></div>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
