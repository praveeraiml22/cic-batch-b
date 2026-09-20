import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { sendContactMessage } from "@/lib/contact.functions";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Lightbulb,
  Target,
  Trophy,
  GraduationCap,
  Mail,
  MapPin,
  Linkedin,
  Instagram,
  Twitter,
  Menu,
  X,
  Sparkles,
  HardHat,
  Microscope,
  Send,
} from "lucide-react";
// Served from /public so it works on both Lovable and Netlify deploys.
const cicLogo = { url: "/cic-logo.png" };
import bridgeBg from "@/assets/bridge-bg.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Civil Innovation Club (CIC) | MNNIT Allahabad" },
      {
        name: "description",
        content:
          "Civil Innovation Club, MNNIT Allahabad. A student-led platform innovating infrastructure through research, workshops, and collaborative engineering projects.",
      },
    ],
  }),
});

function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <Hero />
      <About />
      <Coordinators />
      <Contact />
      <Footer />
    </main>
  );
}

/* ---------- NAV ---------- */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "About", href: "#about" },
    { label: "Team", href: "#team" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-navy-deep/85 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 h-20 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3 group">
          <div className="h-11 w-11 rounded-xl bg-white p-1.5 shadow-gold ring-1 ring-gold/40">
            <img src={cicLogo.url} alt="CIC Logo" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-white font-display text-lg font-semibold tracking-tight">CIC</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">MNNIT Allahabad</p>
          </div>
        </a>

        <ul className="hidden lg:flex items-center gap-9">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm font-medium text-white/80 hover:text-gold transition-colors"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            to="/auth"
            className="px-4 py-2 text-sm font-medium text-white/85 hover:text-white transition"
          >
            Login
          </Link>
          <Link
            to="/auth"
            className="px-5 py-2.5 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] text-navy-deep text-sm font-semibold shadow-gold hover:brightness-110 transition"
          >
            Join CIC
          </Link>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
          className="lg:hidden h-10 w-10 grid place-items-center rounded-md text-white/90 hover:bg-white/10"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="lg:hidden bg-navy-deep/95 backdrop-blur-xl border-t border-white/10">
          <ul className="px-6 py-6 space-y-4">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  onClick={() => setOpen(false)}
                  href={l.href}
                  className="block text-white/85 font-medium"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="inline-block mt-2 px-5 py-2.5 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] text-navy-deep text-sm font-semibold"
              >
                Member Login
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

/* ---------- HERO ---------- */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-36 bg-navy-deep">
      {/* Bridge architectural background */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${bridgeBg})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.18 0.05 260 / 0.6) 0%, oklch(0.13 0.04 260 / 0.85) 100%)",
        }}
      />
      {/* Glow blobs */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4 }}
        className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-gold/15 blur-3xl"
      />
      <motion.div
        aria-hidden
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-gold/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-gold-soft backdrop-blur"
          >
            <Sparkles size={14} />
            MNNIT Allahabad · Est. Civil Dept.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-6 font-display text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight"
          >
            Civil <span className="text-gradient-gold italic">Innovation</span>
            <br />
            Club
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 font-display italic text-xl text-white/85"
          >
            Innovating Infrastructure, Building the Future.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-4 max-w-xl text-base text-white/65 leading-relaxed"
          >
            A student-driven hub at Motilal Nehru National Institute of
            Technology where curiosity meets concrete — research, workshops, and
            projects that shape tomorrow's built environment.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] px-7 py-3.5 text-sm font-semibold text-navy-deep shadow-gold hover:brightness-110 transition"
            >
              Member Login
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#about"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition backdrop-blur"
            >
              Learn More
            </a>
          </motion.div>
        </div>

        {/* Square logo showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="relative mx-auto"
        >
          <div className="absolute -inset-10 bg-gold/15 blur-3xl rounded-3xl" />
          <div className="relative h-72 w-72 sm:h-80 sm:w-80 lg:h-[26rem] lg:w-[26rem] rounded-2xl bg-white p-8 shadow-elegant ring-1 ring-gold/40">
            <img
              src={cicLogo.url}
              alt="CIC official logo"
              className="h-full w-full object-contain"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- ABOUT ---------- */
function About() {
  const pillars = [
    {
      icon: Target,
      title: "Mission",
      body: "To cultivate an ecosystem where civil engineering students transform classroom theory into real-world innovation — through research, prototyping, and industry collaboration.",
    },
    {
      icon: Lightbulb,
      title: "Vision",
      body: "To position MNNIT as a national leader in sustainable infrastructure thinking, producing engineers who design the cities, systems, and structures of tomorrow.",
    },
    {
      icon: Building2,
      title: "Objectives",
      body: "Foster interdisciplinary projects, conduct technical workshops, host expert lectures, and create a thriving community around modern civil engineering practice.",
    },
  ];
  const activities = [
    { icon: Microscope, label: "Research & Prototyping" },
    { icon: HardHat, label: "Field Studies & Site Visits" },
    { icon: GraduationCap, label: "Skill-Building Workshops" },
    { icon: Trophy, label: "Hackathons & Competitions" },
  ];

  return (
    <section id="about" className="py-16 sm:py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <SectionHeader
          eyebrow="About CIC"
          title="Where civil engineering meets innovation"
          subtitle="The Civil Innovation Club is the flagship technical society of the Department of Civil Engineering at MNNIT Allahabad — a launchpad for the next generation of infrastructure thinkers."
        />

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group relative rounded-2xl bg-card border border-border p-6 sm:p-8 hover:border-gold/40 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute top-0 left-8 -translate-y-1/2 h-12 w-12 rounded-xl bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] grid place-items-center shadow-gold">
                <p.icon className="text-navy-deep" size={22} />
              </div>
              <h3 className="mt-4 text-2xl font-display font-semibold text-foreground">{p.title}</h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 rounded-3xl bg-gradient-to-br from-navy to-navy-deep p-6 sm:p-10 lg:p-14 text-white relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative grid lg:grid-cols-[1fr_1.2fr] gap-10 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold-soft">What we do</p>
              <h3 className="mt-3 text-3xl lg:text-4xl font-display font-semibold">
                Innovation in every direction
              </h3>
              <p className="mt-4 text-white/70 leading-relaxed">
                From smart materials to sustainable structures, members explore
                the full spectrum of modern civil engineering through hands-on
                programs.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {activities.map((a) => (
                <div
                  key={a.label}
                  className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur"
                >
                  <div className="h-10 w-10 rounded-lg bg-gold/15 border border-gold/30 grid place-items-center">
                    <a.icon className="text-gold" size={18} />
                  </div>
                  <span className="text-sm font-medium text-white/90">{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- COORDINATORS ---------- */
function Coordinators() {
  const [members, setMembers] = useState<Array<{ id: string; type: string; name: string; designation: string; photo_url: string | null }>>([]);
  useEffect(() => {
    let cancelled = false;
    import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase
        .from("coordinators")
        .select("id,type,name,designation,photo_url")
        .order("sort_order", { ascending: true })
        .then(({ data }) => { if (!cancelled && data) setMembers(data as any); }),
    );
    return () => { cancelled = true; };
  }, []);

  const faculty = members.filter((m) => m.type === "faculty");
  const students = members.filter((m) => m.type === "student");

  return (
    <section id="team" className="py-16 sm:py-24 lg:py-32 bg-muted/40 border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <SectionHeader
          eyebrow="Leadership"
          title="The people behind CIC"
          subtitle="Guided by distinguished faculty and led by a passionate student council."
        />

        {faculty.length > 0 && (
          <div className="mt-16">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-navy mb-6">
              Faculty Coordinators
            </h3>
            <div className="grid sm:grid-cols-2 gap-6">
              {faculty.map((p) => (
                <PersonCard key={p.id} name={p.name} role={p.designation} dept="" photo={p.photo_url} accent />
              ))}
            </div>
          </div>
        )}

        {students.length > 0 && (
          <div className="mt-16">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-navy mb-6">
              Student Coordinators
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {students.map((p) => (
                <PersonCard key={p.id} name={p.name} role={p.designation} dept="" photo={p.photo_url} />
              ))}
            </div>
          </div>
        )}

        {members.length === 0 && (
          <p className="mt-16 text-center text-sm text-muted-foreground">Team members will appear here once added from the Admin Panel.</p>
        )}
      </div>
    </section>
  );
}

function PersonCard({
  name,
  role,
  dept,
  accent,
  photo,
}: {
  name: string;
  role: string;
  dept: string;
  accent?: boolean;
  photo?: string | null;
}) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group rounded-2xl bg-card border border-border p-6 flex items-center gap-5 hover:border-gold/40 hover:shadow-elegant transition-all"
    >
      {photo ? (
        <img src={photo} alt={name} className="h-20 w-20 rounded-full object-cover flex-shrink-0 ring-2 ring-gold/40" />
      ) : (
        <div
          className={`relative h-20 w-20 rounded-full grid place-items-center font-display text-2xl font-semibold flex-shrink-0 ${
            accent
              ? "bg-gradient-to-br from-[oklch(0.86_0.12_90)] to-[oklch(0.7_0.15_75)] text-navy-deep ring-2 ring-gold/40"
              : "bg-navy text-white"
          }`}
        >
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-foreground break-words leading-snug">{name}</p>
        <p className="text-sm font-medium text-navy mt-0.5 break-words">{role}</p>
        <p className="text-xs text-muted-foreground mt-1 break-words">{dept}</p>
      </div>
    </motion.div>
  );
}

/* ---------- CONTACT ---------- */
function Contact() {
  const submitContact = useServerFn(sendContactMessage);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return; // block duplicate submits

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      subject: String(fd.get("subject") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
    };

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      setStatus("error");
      setErrorMessage("Please fill in every field before sending.");
      return;
    }

    setStatus("sending");
    setErrorMessage(null);
    try {
      await submitContact({ data: payload });
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : "We could not send your message. Please try again.",
      );
    }
  };

  return (
    <section id="contact" className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 grid lg:grid-cols-[1fr_1fr] gap-12">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold">Get in touch</p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Have an idea worth building?
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-md">
            Reach out for collaborations, sponsorships, or to join CIC. We're
            always open to engineers, dreamers, and doers.
          </p>

          <ul className="mt-10 space-y-5">
            <li className="flex items-start gap-4">
              <span className="h-11 w-11 rounded-xl bg-navy text-gold grid place-items-center flex-shrink-0">
                <Mail size={18} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
                <a href="mailto:cic@mnnit.ac.in" className="text-foreground font-medium hover:text-navy">
                  cic@mnnit.ac.in
                </a>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="h-11 w-11 rounded-xl bg-navy text-gold grid place-items-center flex-shrink-0">
                <MapPin size={18} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Address</p>
                <p className="text-foreground font-medium">
                  Department of Civil Engineering,<br />
                  MNNIT Allahabad, Prayagraj, Uttar Pradesh — 211004
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-10 flex items-center gap-3">
            {[Linkedin, Instagram, Twitter].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="h-11 w-11 rounded-full border border-border bg-card grid place-items-center text-muted-foreground hover:text-gold hover:border-gold transition"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="rounded-3xl bg-card border border-border p-6 sm:p-8 lg:p-10 shadow-elegant"
        >
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Full Name" placeholder="Aarav Patel" />
            <Field label="Email" type="email" placeholder="you@mnnit.ac.in" />
          </div>
          <div className="mt-5">
            <Field label="Subject" placeholder="Collaboration enquiry" />
          </div>
          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Message
            </label>
            <textarea
              rows={5}
              placeholder="Tell us a bit about your idea..."
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 transition resize-none"
            />
          </div>
          <button
            type="submit"
            className="mt-6 group inline-flex items-center gap-2 rounded-full bg-navy px-7 py-3.5 text-sm font-semibold text-white hover:bg-navy-deep transition w-full sm:w-auto justify-center"
          >
            Send Message
            <Send size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 transition"
      />
    </div>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  return (
    <footer className="bg-navy-deep text-white/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-14 grid md:grid-cols-[1.4fr_1fr_1fr] gap-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white p-1.5 ring-1 ring-gold/40">
              <img src={cicLogo.url} alt="CIC Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-white font-display text-lg font-semibold">Civil Innovation Club</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gold-soft">MNNIT Allahabad</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-relaxed">
            Innovating Infrastructure, Building the Future. A student-led
            initiative of the Department of Civil Engineering, MNNIT Allahabad.
          </p>
        </div>
        <div>
          <p className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Explore</p>
          <ul className="space-y-2.5 text-sm">
            <li><a href="#about" className="hover:text-gold transition">About</a></li>
            <li><a href="#team" className="hover:text-gold transition">Team</a></li>
            <li><a href="#contact" className="hover:text-gold transition">Contact</a></li>
            <li><Link to="/auth" className="hover:text-gold transition">Member Login</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contact</p>
          <ul className="space-y-2.5 text-sm">
            <li>cic@mnnit.ac.in</li>
            <li>MNNIT, Prayagraj — 211004</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} Civil Innovation Club, MNNIT Allahabad. All rights reserved.</p>
          <p className="uppercase tracking-[0.2em] text-gold-soft">Innovating Infrastructure</p>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pb-5 text-xs text-white/50">
          <p>
            Created by: <span className="text-white/80 font-medium">Praveer Pratap (20231074)</span>, CIC Coordinator,
            MNNIT Allahabad
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ---------- SHARED ---------- */
function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-xs uppercase tracking-[0.25em] font-semibold text-gold"
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-[1.1]"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-5 text-lg text-muted-foreground leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
