import { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  Brain,
  ShieldCheck,
  Sparkles,
  CalendarClock,
  BarChart3,
  Crosshair,
  Download,
  Lock,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Zap,
  Target,
  LineChart,
  Activity,
} from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
  onTryDemo: () => void;
  onSignIn: () => void;
  demoLoading?: boolean;
}

export function LandingPage({ onGetStarted, onTryDemo, onSignIn, demoLoading }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set());
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            setVisibleSections((prev) => new Set(prev).add(idx));
          }
        });
      },
      { threshold: 0.12 }
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isSectionVisible = (idx: number) => visibleSections.has(idx);

  return (
    <div className="min-h-screen bg-base-950 text-base-100">
      {/* ===== Nav ===== */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-base-800 bg-base-950/90 backdrop-blur-lg"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-lg">
              <TrendingUp size={22} />
            </div>
            <span className="text-lg font-bold text-base-50">EdgePilot</span>
          </div>

          <nav className="hidden items-center gap-8 lg:flex">
            <a href="#features" className="text-sm font-medium text-base-300 transition-colors hover:text-base-50">Features</a>
            <a href="#why-edgepilot" className="text-sm font-medium text-base-300 transition-colors hover:text-base-50">Why EdgePilot</a>
            <a href="#how-it-works" className="text-sm font-medium text-base-300 transition-colors hover:text-base-50">How It Works</a>
            <a href="#coach" className="text-sm font-medium text-base-300 transition-colors hover:text-base-50">AI Coach</a>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              onClick={onSignIn}
              className="text-sm font-medium text-base-300 transition-colors hover:text-base-50"
            >
              Sign in
            </button>
            <button
              onClick={onGetStarted}
              className="flex items-center gap-1.5 rounded-lg bg-info-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:bg-info-500 hover:shadow-info-500/20"
            >
              Get Started <ArrowRight size={15} />
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-base-300 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 border-l border-base-800 bg-base-900 p-6 animate-slide-up">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-info-500 to-info-600 text-white">
                  <TrendingUp size={18} />
                </div>
                <span className="font-bold text-base-50">EdgePilot</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-base-400 hover:text-base-200">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {[
                { label: "Features", href: "#features" },
                { label: "Why EdgePilot", href: "#why-edgepilot" },
                { label: "How It Works", href: "#how-it-works" },
                { label: "AI Coach", href: "#coach" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-base-300 transition-colors hover:bg-base-800 hover:text-base-50"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => { setMobileMenuOpen(false); onSignIn(); }}
                className="rounded-lg border border-base-700 py-2.5 text-sm font-medium text-base-200"
              >
                Sign in
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onGetStarted(); }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-info-600 py-2.5 text-sm font-semibold text-white"
              >
                Get Started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Features grid ===== */}
      <section
        id="features"
        ref={(el) => { sectionRefs.current[1] = el; }}
        data-idx="1"
        className="pt-32 py-20 sm:pt-36 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            eyebrow="Features"
            title="Everything a futures trader needs in one place"
            subtitle="From your first trade to your thousandth, EdgePilot grows with you — analyzing, coaching, and keeping you accountable."
            visible={isSectionVisible(1)}
          />

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                visible={isSectionVisible(1)}
                delay={i * 80}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Why EdgePilot (competitive advantages) ===== */}
      <section
        id="why-edgepilot"
        ref={(el) => { sectionRefs.current[2] = el; }}
        data-idx="2"
        className="border-y border-base-800 bg-base-900/30 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            eyebrow="Why EdgePilot"
            title="What sets us apart from every other trading journal"
            subtitle="Most journals stop at pretty charts. EdgePilot goes further — an AI coach with memory, automated edge discovery, discipline gamification, and a plan for tomorrow before you sit down to trade."
            visible={isSectionVisible(2)}
          />

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {ADVANTAGES.map((adv, i) => (
              <AdvantageCard
                key={adv.title}
                advantage={adv}
                visible={isSectionVisible(2)}
                delay={i * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section
        id="how-it-works"
        ref={(el) => { sectionRefs.current[3] = el; }}
        data-idx="3"
        className="py-20 sm:py-28"
      >
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeader
            eyebrow="How It Works"
            title="From zero to your trading edge in three steps"
            subtitle="No spreadsheets, no manual calculations, no guesswork."
            visible={isSectionVisible(3)}
          />

          <div className="mt-14 space-y-6">
            {STEPS.map((step, i) => (
              <StepRow
                key={step.number}
                step={step}
                isLast={i === STEPS.length - 1}
                visible={isSectionVisible(3)}
                delay={i * 120}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI Coach spotlight ===== */}
      <section
        id="coach"
        ref={(el) => { sectionRefs.current[4] = el; }}
        data-idx="4"
        className="border-y border-base-800 bg-gradient-to-b from-base-900/40 to-base-950 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className={`transition-all duration-700 ${isSectionVisible(4) ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"}`}>
              <div className="inline-flex items-center gap-2 rounded-full border border-info-500/20 bg-info-500/10 px-3 py-1 text-xs font-medium text-info-300">
                <Brain size={13} /> AI Coach
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-base-50 sm:text-4xl">
                A coach that actually <span className="text-info-400">remembers</span> your trading
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-base-300">
                Ask it anything. "Why did I lose money today?" "Am I getting better?"
                "What's my best setup?" Every answer is grounded in your verified trade data —
                not generic advice from a chatbot that forgets you by tomorrow.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "Long-term memory — builds a trader profile from your history",
                  "Grounded answers — cites the trades and patterns behind every insight",
                  "Conversation history — picks up where you left off",
                  "Improvement goals — tracks what you should work on next",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-bull-500" />
                    <span className="text-sm text-base-200">{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={onTryDemo}
                disabled={demoLoading}
                className="mt-8 flex items-center gap-2 rounded-xl border border-info-500/30 bg-info-500/10 px-6 py-3 text-sm font-semibold text-info-300 transition-all hover:bg-info-500/15 disabled:opacity-60"
              >
                <Sparkles size={16} /> Try the coach with demo data
              </button>
            </div>

            <div className={`transition-all duration-700 ${isSectionVisible(4) ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}>
              <CoachPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section
        ref={(el) => { sectionRefs.current[5] = el; }}
        data-idx="5"
        className="py-24"
      >
        <div className="mx-auto max-w-3xl px-6">
          <div className={`relative overflow-hidden rounded-3xl border border-base-700 bg-gradient-to-br from-base-850 to-base-900 p-10 text-center transition-all duration-700 sm:p-14 ${
            isSectionVisible(5) ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}>
            <div className="pointer-events-none absolute -top-20 left-1/2 h-60 w-96 -translate-x-1/2 rounded-full bg-info-600/15 blur-[100px]" />
            <div className="relative">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-xl">
                <TrendingUp size={32} />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-base-50 sm:text-4xl">
                Your edge is hiding in your trade history
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-base-300">
                Start free today. Import your trades, meet your AI coach, and discover
                what actually works for you.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  onClick={onGetStarted}
                  className="flex items-center gap-2 rounded-xl bg-info-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-info-600/20 transition-all hover:bg-info-500"
                >
                  Get Started Free <ArrowRight size={18} />
                </button>
                <button
                  onClick={onTryDemo}
                  disabled={demoLoading}
                  className="flex items-center gap-2 rounded-xl border border-base-600 px-8 py-3.5 text-base font-semibold text-base-200 transition-all hover:bg-base-800 disabled:opacity-60"
                >
                  <Sparkles size={18} /> Explore the demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-base-800 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-info-500 to-info-600 text-white">
                <TrendingUp size={18} />
              </div>
              <span className="font-bold text-base-50">EdgePilot</span>
            </div>
            <p className="text-sm text-base-500">
              Discover your trading edge. Built for futures traders.
            </p>
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-base-600">
            EdgePilot is a journaling and analytics tool. It does not provide financial advice,
            trade recommendations, or signals. Trading futures involves substantial risk of loss.
            Past performance is not indicative of future results.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ===== Shared components ===== */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  visible,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  visible: boolean;
}) {
  return (
    <div className={`mx-auto max-w-2xl text-center transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-info-400">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-base-50 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-lg leading-relaxed text-base-300">{subtitle}</p>
    </div>
  );
}

/* ===== Feature card ===== */

interface FeatureDef {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}

const FEATURES: FeatureDef[] = [
  {
    icon: <LineChart size={22} />,
    title: "Performance Dashboard",
    description: "Equity curve, profit factor, expectancy, win rate, R-multiples, streaks, and weekly P&L — all calculated automatically from your trades.",
    accent: "info",
  },
  {
    icon: <Brain size={22} />,
    title: "AI Coach with Memory",
    description: "Ask questions in plain English. Get answers grounded in your actual trade data, with a long-term trader profile that grows with every trade.",
    accent: "info",
  },
  {
    icon: <Sparkles size={22} />,
    title: "Edge Discovery",
    description: "Automatically mines your trade history for repeating patterns — best setups, time windows, instruments — and quantifies each one's edge.",
    accent: "accent",
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "Discipline Scoring",
    description: "Every trade is scored on 10 discipline dimensions. Track consistency over time and unlock achievement badges as you build better habits.",
    accent: "bull",
  },
  {
    icon: <CalendarClock size={22} />,
    title: "Tomorrow's Plan",
    description: "Wake up to a data-driven trading plan: what worked, what to avoid, which setups to watch, and what your coach thinks you should focus on.",
    accent: "info",
  },
  {
    icon: <BarChart3 size={22} />,
    title: "Deep Analytics",
    description: "Break down performance by instrument, session, day of week, strategy tag, and rule compliance. Find where your edge lives — and where it leaks.",
    accent: "accent",
  },
];

function FeatureCard({ feature, visible, delay }: { feature: FeatureDef; visible: boolean; delay: number }) {
  const accentBg =
    feature.accent === "bull" ? "bg-bull-500/15 text-bull-500"
    : feature.accent === "accent" ? "bg-accent-500/15 text-accent-400"
    : "bg-info-500/15 text-info-400";
  return (
    <div
      className={`group rounded-2xl border border-base-700 bg-base-850 p-6 transition-all duration-500 hover:border-base-600 hover:bg-base-800 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${accentBg} transition-transform group-hover:scale-110`}>
        {feature.icon}
      </div>
      <h3 className="text-base font-semibold text-base-50">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-base-400">{feature.description}</p>
    </div>
  );
}

/* ===== Advantage card ===== */

interface AdvantageDef {
  icon: React.ReactNode;
  title: string;
  problem: string;
  solution: string;
}

const ADVANTAGES: AdvantageDef[] = [
  {
    icon: <Brain size={24} />,
    title: "AI coach with long-term memory",
    problem: "Other journals give you charts and leave you to interpret them. Generic chatbots forget your context by the next message.",
    solution: "EdgePilot builds a persistent trader profile — your strengths, weaknesses, risk habits, and improvement goals — so every coaching answer is grounded in your real history.",
  },
  {
    icon: <Crosshair size={24} />,
    title: "Automated edge discovery",
    problem: "Most journals show you what happened. They don't tell you what actually works.",
    solution: "EdgePilot automatically mines your trades for repeating, statistically meaningful patterns and quantifies each one's edge — so you know exactly which setups to double down on.",
  },
  {
    icon: <ShieldCheck size={24} />,
    title: "Discipline as a game, not a guilt trip",
    problem: "Every journal says 'follow your rules.' None of them make it engaging.",
    solution: "Each trade gets a discipline score across 10 dimensions. Track your consistency over time, hit milestones, and unlock achievement badges — bronze through platinum.",
  },
  {
    icon: <CalendarClock size={24} />,
    title: "A plan before you trade",
    problem: "Journals are backward-looking. You review yesterday — but nobody helps you prepare for tomorrow.",
    solution: "EdgePilot generates a personalized trading plan each day: what to watch, what to avoid, and the single highest-impact thing to work on. Walk into the session with intention.",
  },
  {
    icon: <Download size={24} />,
    title: "Tradovate import in one click",
    problem: "Manual trade entry is tedious. Copying from broker statements is error-prone.",
    solution: "Connect your Tradovate account and sync your trades automatically. Or import a CSV. Either way, your journal stays current without retyping a single number.",
  },
  {
    icon: <Lock size={24} />,
    title: "Your data, yours alone",
    problem: "Many 'free' journals monetize your trade data or share it with brokers.",
    solution: "Every trade, rule, and conversation is private to your account — enforced at the database level. No one else can read it, and we never sell it.",
  },
];

function AdvantageCard({ advantage, visible, delay }: { advantage: AdvantageDef; visible: boolean; delay: number }) {
  return (
    <div
      className={`rounded-2xl border border-base-700 bg-base-850 p-6 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-info-500/15 text-info-400">
          {advantage.icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-base-50">{advantage.title}</h3>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-shrink-0 text-xs font-bold uppercase tracking-wider text-bear-500/70">Others</span>
              <p className="text-sm leading-relaxed text-base-400">{advantage.problem}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-shrink-0 text-xs font-bold uppercase tracking-wider text-bull-500/70">EdgePilot</span>
              <p className="text-sm leading-relaxed text-base-200">{advantage.solution}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Step row ===== */

interface StepDef {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const STEPS: StepDef[] = [
  {
    number: "01",
    icon: <Download size={22} />,
    title: "Import or log your trades",
    description: "Sync from Tradovate in one click, upload a CSV, or log trades manually with full context — setup, entry, exit, discipline checks, and notes.",
  },
  {
    number: "02",
    icon: <Sparkles size={22} />,
    title: "EdgePilot analyzes everything",
    description: "Your dashboard, analytics, discipline scores, edge discovery, and trader profile are computed automatically. No spreadsheets, no manual math.",
  },
  {
    number: "03",
    icon: <Target size={22} />,
    title: "Trade with a plan and a coach",
    description: "Check tomorrow's plan before the open. Ask your AI coach why a setup failed. Track your discipline streak. Iterate. Improve. Find your edge.",
  },
];

function StepRow({ step, isLast, visible, delay }: { step: StepDef; visible: boolean; isLast: boolean; delay: number }) {
  return (
    <div
      className={`flex gap-6 transition-all duration-600 ${visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex flex-col items-center">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-info-500/20 bg-info-500/10 text-info-400">
          {step.icon}
        </div>
        {!isLast && <div className="mt-2 h-full w-px flex-1 bg-gradient-to-b from-base-700 to-transparent" />}
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tabular text-base-500">{step.number}</span>
          <h3 className="text-lg font-semibold text-base-50">{step.title}</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-base-400">{step.description}</p>
      </div>
    </div>
  );
}

/* ===== Coach preview ===== */

function CoachPreview() {
  return (
    <div className="rounded-2xl border border-base-700 bg-base-850 p-5 shadow-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-info-500 to-info-700 text-white shadow-md">
          <Brain size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-base-50">AI Coach</h3>
          <p className="text-[10px] text-info-400">142 trades remembered</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* User question */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-base-700/60 px-4 py-2.5 text-sm text-base-100">
            Why did I lose money today?
          </div>
        </div>

        {/* Coach answer */}
        <div className="flex gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-info-500 to-info-700 text-white">
            <Brain size={15} />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-base-700 bg-base-800 px-4 py-3">
            <p className="text-sm leading-relaxed text-base-200">
              You took 3 trades against the trend in the last hour of the session — your
              win rate on counter-trend setups is <strong className="text-base-50">31%</strong> vs
              <strong className="text-base-50"> 68%</strong> with-trend. Your best setups came
              from the London open.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 rounded border border-bull-500/20 bg-bull-500/10 px-1.5 py-0.5 text-[10px] font-medium text-bull-500">
                <CheckCircle2 size={10} /> Verified Data
              </span>
              <span className="flex items-center gap-1 rounded border border-info-500/20 bg-info-500/10 px-1.5 py-0.5 text-[10px] font-medium text-info-400">
                <Activity size={10} /> Strong Pattern
              </span>
            </div>
          </div>
        </div>

        {/* Suggested prompts */}
        <div className="pt-2">
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Target size={14} />, text: "What's my best setup?" },
              { icon: <Zap size={14} />, text: "Am I getting better?" },
            ].map((p) => (
              <div key={p.text} className="flex items-center gap-2 rounded-lg border border-base-700 bg-base-800/50 px-3 py-2">
                <span className="text-base-400">{p.icon}</span>
                <span className="text-xs text-base-300">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-base-700 bg-base-800 p-2.5">
        <span className="flex-1 text-xs text-base-500">Ask your coach anything...</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info-600 text-white">
          <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}
