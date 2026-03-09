"use client";

import Link from "next/link";
import {
  BarChart3,
  ShieldCheck,
  Users,
  Zap,
  PackageSearch,
  ChevronDown,
  ArrowRight,
  Database,
  LineChart,
  ShieldAlert,
  Layers,
} from "lucide-react";

export default function ForeTrackLanding() {
  return (
    <div className="text-[#1A1B4B] bg-card scroll-smooth selection:bg-[#2D31FA] selection:text-white">
      {/* 1. Navigation Bar - All links and buttons to the far right */}
      <header className="bg-[#1A1B4B] text-white sticky top-0 z-50 shadow-md">
        <div className="w-full flex items-center justify-between px-8 py-5">
          {/* Left: Logo only */}
          <div className="flex items-center gap-3">
            <div className="bg-[#2D31FA] p-2 rounded-xl">
              <PackageSearch size={26} className="text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">
              ForeTrack
            </span>
          </div>

          {/* Right: Nav Links + Buttons */}
          <div className="flex items-center gap-10">
            <nav className="hidden xl:flex items-center gap-10 text-xs font-bold uppercase tracking-[0.15em] text-slate-300">
              <a
                href="#features"
                className="hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#insights"
                className="hover:text-white transition-colors"
              >
                Operational Insights
              </a>
            </nav>

            <div className="flex items-center gap-4 border-l border-white/10 pl-10">
              <Link href="/login">
                <button className="px-6 py-2.5 rounded-xl border border-white/20 hover:bg-card hover:text-[#1A1B4B] transition-all font-black text-xs uppercase tracking-widest">
                  Login
                </button>
              </Link>
              <Link href="/register">
                <button className="px-6 py-2.5 rounded-xl bg-[#2D31FA] hover:bg-[#1A1EDB] transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-[#2D31FA]/20">
                  Register
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#F8FAFF] to-white py-28 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <span className="inline-block bg-[#EEF2FF] text-[#2D31FA] px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-10">
            Inventory Management System for Retail Growth
          </span>

          <h1 className="text-6xl md:text-8xl font-black leading-[1] tracking-[-0.04em] mb-10 text-[#1A1B4B]">
            Control Stock. <br />
            <span className="text-[#2D31FA]">Predict Demand.</span>
          </h1>

          <p className="text-muted-foreground text-xl md:text-2xl max-w-2xl mx-auto mb-14 leading-relaxed font-medium tracking-tight">
            Stop reacting to stockouts. ForeTrack uses smart analytics to help
            you manage inventory with total precision and grow your business
            with confidence.
          </p>

          <div className="flex justify-center">
            <Link href="/register">
              <button className="bg-[#2D31FA] text-white px-12 py-6 rounded-[2rem] text-lg font-black uppercase tracking-widest hover:bg-[#1A1B4B] transition-all shadow-2xl shadow-[#2D31FA]/40 flex items-center gap-4">
                Get Started <ArrowRight size={22} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Key Features Section - Focused on Value */}
      <section id="features" className="py-28 bg-[#F8FAFC] px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-4xl font-black tracking-tighter uppercase text-[#1A1B4B]">
              Key System Features
            </h2>
            <div className="h-2 w-20 bg-[#2D31FA] mt-4 rounded-full"></div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[
              {
                icon: <LineChart size={32} />,
                title: "Demand Intelligence",
                desc: "Understand exactly what your customers want. Use historical sales data to forecast future needs and optimize your reorder points.",
              },
              {
                icon: <ShieldAlert size={32} />,
                title: "Stock Accuracy",
                desc: "Eliminate discrepancies. Real-time tracking and anomaly detection ensure your physical stock always matches your digital records.",
              },
              {
                icon: <Layers size={32} />,
                title: "Enterprise Multi-Tenancy",
                desc: "Manage multiple store locations within a single interface while maintaining absolute data isolation for each tenant.",
              },
              {
                icon: <Zap size={32} />,
                title: "Instant Threshold Alerts",
                desc: "Get notified the moment stock levels dip. Automated alerts ensure you never miss a replenishment window or lose a sale.",
              },
              {
                icon: <Users size={32} />,
                title: "Internal Accountability",
                desc: "Assign specific roles to your team. Staff record daily sales while managers oversee inventory and approve purchases.",
              },
              {
                icon: <BarChart3 size={32} />,
                title: "Profitability Analysis",
                desc: "Identify your top-performing products instantly. Comprehensive reports help you focus on the stock that drives your revenue.",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-card p-12 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group"
              >
                <div className="text-[#2D31FA] mb-8 bg-[#2D31FA]/5 w-fit p-5 rounded-2xl group-hover:bg-[#2D31FA] group-hover:text-white transition-colors duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black mb-4 uppercase tracking-tighter text-[#1A1B4B]">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-base leading-relaxed font-medium">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Operational Insights - Strategy & Data Management */}
      <section id="insights" className="py-28 bg-card px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black text-[#1A1B4B] tracking-tight uppercase">
              Operational Insights
            </h2>
            <p className="text-muted-foreground font-medium text-lg mt-4">
              Understanding how ForeTrack powers your enterprise.
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                q: "How does the system securely manage and store my business data?",
                a: "Data integrity is our priority. ForeTrack uses a modular architecture where each store's records are strictly filtered at the database level. Your inventory, financial history, and user logs are encrypted and completely isolated from any other organization on the platform.",
              },
              {
                q: "How does the optimization logic help prevent capital waste?",
                a: "By analyzing your sales turnover, the system identifies reorder points that prevent you from tying up capital in slow-moving stock, while simultaneously ensuring high-demand items never run out.",
              },
              {
                q: "What measures ensure staff accountability in the system?",
                a: "Role-Based Access Control (RBAC) creates a clear audit trail. Every sale recorded or stock adjustment made is tagged to the specific staff member, while sensitive financial approvals remain restricted to managers.",
              },
              {
                q: "How does the system handle rapid demand surges?",
                a: "We utilize high-speed caching and background processing to manage surges in data. This ensures that even during your busiest sales hours, the system remains responsive and stock updates happen in real-time.",
              },
            ].map((item, i) => (
              <details
                key={i}
                className="group py-8 border-b border-slate-100 last:border-0 transition-all duration-300"
              >
                <summary className="flex justify-between items-center cursor-pointer list-none">
                  <span className="text-2xl font-bold text-[#1A1B4B] group-open:text-[#2D31FA] transition-colors duration-300 pr-6 tracking-tight">
                    {item.q}
                  </span>
                  <div className="flex-shrink-0 bg-muted group-open:bg-[#2D31FA]/10 p-3 rounded-full transition-colors duration-300">
                    <ChevronDown className="w-6 h-6 text-[#1A1B4B] group-open:text-[#2D31FA] group-open:rotate-180 transition-transform duration-300" />
                  </div>
                </summary>
                <div className="overflow-hidden">
                  <p className="pt-8 pb-4 text-muted-foreground text-xl leading-relaxed font-medium max-w-3xl">
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A1B4B] text-white py-16 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3">
            <PackageSearch size={30} className="text-[#2D31FA]" />
            <span className="text-2xl font-black tracking-tight text-white">
              ForeTrack
            </span>
          </div>
          <p className="text-sm font-medium text-slate-400">
            © 2026 ForeTrack Systems. Optimized SME Management.
          </p>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <span>Secure</span>
            <span>Scalable</span>
            <span>Intelligent</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
