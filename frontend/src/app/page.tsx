"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
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
  // Fix for Hydration Error: Ensure component is mounted before rendering dynamic styles
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="text-[#1A1B4B] bg-card scroll-smooth selection:bg-[#2D31FA] selection:text-white">
      {/* 1. Navigation Bar - Refined for secondary prominence */}
      <header className="bg-[#1A1B4B] text-white sticky top-0 z-50 shadow-sm">
        <div className="w-full flex items-center justify-between px-8 py-5">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/icon-192x192.png"
              alt="ForeTrack Logo"
              width={44}
              height={44}
              className="object-contain rounded-xl bg-white/10"
              priority
            />
            <span className="text-2xl font-black tracking-tighter text-white">
              ForeTrack
            </span>
          </div>

          {/* Right: Nav Links + Buttons */}
          <div className="flex items-center gap-10">
            <nav className="hidden xl:flex items-center gap-10 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <a
                href="#features"
                className="hover:text-white transition-colors duration-300"
              >
                Features
              </a>
              <a
                href="#insights"
                className="hover:text-white transition-colors duration-300"
              >
                Operational Insights
              </a>
            </nav>

            <div className="flex items-center gap-4 border-l border-white/10 pl-10">
              <Link href="/login">
                <button className="px-6 py-2.5 rounded-xl border border-white/10 hover:border-white/40 hover:bg-white/5 transition-all font-bold text-[11px] uppercase tracking-widest text-slate-300 hover:text-white">
                  Login
                </button>
              </Link>
              <Link href="/register">
                <button className="px-6 py-2.5 rounded-xl bg-[#2D31FA] hover:bg-[#1A1EDB] transition-all font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#2D31FA]/20">
                  Register
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Refined Animation & Balance */}
      <section className="bg-gradient-to-br from-[#F8FAFF] to-white py-24 lg:py-36 relative overflow-hidden">
        {/* Animated Background Blobs for Depth */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#2D31FA]/10 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 -left-20 w-72 h-72 bg-[#1A1B4B]/5 blur-[100px] rounded-full animate-pulse-slow delay-700"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Side: Primary Focal Point */}
          <div className="text-center lg:text-left">
            <h1 className="text-6xl md:text-[5.5rem] font-black leading-[0.95] tracking-[-0.05em] mb-8 text-[#1A1B4B]">
              Control Stock. <br />
              <span className="text-[#2D31FA]">Predict Demand.</span>
            </h1>

            <p className="text-slate-500 text-xl md:text-2xl max-w-xl mx-auto lg:mx-0 mb-12 leading-relaxed font-medium tracking-tight opacity-90">
              Stop reacting to stockouts. ForeTrack uses smart analytics to help
              you manage inventory with total precision and grow your business
              with confidence.
            </p>

            <div className="flex justify-center lg:justify-start">
              <Link href="/register">
                <button className="bg-[#2D31FA] text-white px-12 py-6 rounded-2xl text-lg font-black uppercase tracking-widest hover:bg-[#1A1B4B] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_50px_-10px_rgba(45,49,250,0.4)] flex items-center gap-4">
                  Get Started <ArrowRight size={22} />
                </button>
              </Link>
            </div>
          </div>

          {/* Right Side: Enhanced Interactive Visualization */}
          <div className="relative h-[600px] flex items-center justify-center lg:scale-110 perspective-1000">
            {/* Animation 1: Floating "Top Selling" Card (High Layer) */}
            <div className="absolute -top-4 right-0 md:right-4 w-72 md:w-80 p-6 bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_40px_100px_-15px_rgba(26,27,75,0.12)] border border-white z-30 animate-float-refined">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-[#2D31FA] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#2D31FA]/20">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                      Top Selling
                    </p>
                    <p className="text-sm font-black text-[#1A1B4B]">
                      Premium Goods
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-green-600 bg-green-100 px-2 py-1 rounded-lg">
                  TRENDING
                </span>
              </div>

              <div className="h-20 flex items-end gap-1.5 mb-4 px-1">
                {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-slate-100/50 rounded-t-md relative overflow-hidden h-full"
                  >
                    <div
                      className="absolute bottom-0 w-full bg-[#2D31FA] rounded-t-md animate-grow-bar"
                      style={{
                        height: mounted ? `${h}%` : "0%",
                        animationDelay: `${i * 0.1}s`,
                      }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <div className="flex gap-1">
                  <div className="h-1.5 w-8 bg-[#2D31FA]/20 rounded-full"></div>
                  <div className="h-1.5 w-4 bg-slate-100 rounded-full"></div>
                </div>
                <div className="text-[10px] font-bold text-slate-400">
                  LIVE FEED
                </div>
              </div>
            </div>

            {/* Animation 2: Deep "Forecast Engine" Card (Low Layer) */}
            <div className="absolute bottom-10 left-0 md:left-4 w-72 md:w-80 p-6 bg-[#1A1B4B] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] z-20 animate-float-delayed-refined">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
                    Forecast Engine
                  </p>
                  <p className="text-sm font-black text-white">
                    Demand Prediction
                  </p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <LineChart size={20} className="text-[#2D31FA]" />
                </div>
              </div>

              <div className="space-y-5">
                <div className="relative group">
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] font-bold text-white/30">
                      Confidence Score
                    </span>
                    <span className="text-[10px] font-bold text-[#2D31FA]">
                      98.2%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#2D31FA] to-[#4F52FF] w-4/5 animate-shimmer-fast"></div>
                  </div>
                </div>

                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                    <div className="h-1 w-24 bg-white/10 rounded-full"></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#2D31FA] animate-pulse delay-150"></div>
                    <div className="h-1 w-36 bg-white/10 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Anchor: Static background ring */}
            <div className="absolute w-[450px] h-[450px] border border-[#2D31FA]/5 rounded-full -z-10 animate-spin-slow"></div>
          </div>
        </div>

        <style jsx>{`
          @keyframes floatRefined {
            0%,
            100% {
              transform: translate(0, 0) rotate(0deg);
            }
            33% {
              transform: translate(10px, -20px) rotate(1deg);
            }
            66% {
              transform: translate(-5px, -10px) rotate(-0.5deg);
            }
          }
          @keyframes floatDelayedRefined {
            0%,
            100% {
              transform: translate(0, 0) rotate(0deg);
            }
            50% {
              transform: translate(-15px, 20px) rotate(-1.5deg);
            }
          }
          @keyframes growBar {
            from {
              height: 0;
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes shimmerFast {
            0% {
              transform: translateX(-150%);
            }
            100% {
              transform: translateX(150%);
            }
          }
          @keyframes spinSlow {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          @keyframes pulseSlow {
            0%,
            100% {
              opacity: 0.5;
              transform: scale(1);
            }
            50% {
              opacity: 0.8;
              transform: scale(1.1);
            }
          }
          .animate-float-refined {
            animation: floatRefined 8s ease-in-out infinite;
          }
          .animate-float-delayed-refined {
            animation: floatDelayedRefined 10s ease-in-out infinite;
          }
          .animate-grow-bar {
            animation: growBar 1.5s cubic-bezier(0.17, 0.67, 0.83, 0.67) forwards;
          }
          .animate-shimmer-fast {
            animation: shimmerFast 2.5s infinite linear;
          }
          .animate-spin-slow {
            animation: spinSlow 30s linear infinite;
          }
          .animate-pulse-slow {
            animation: pulseSlow 6s ease-in-out infinite;
          }
          .perspective-1000 {
            perspective: 1000px;
          }
        `}</style>
      </section>

      {/* 2. Key Features Section - Grid Alignment & Scanability */}
      <section id="features" className="py-32 bg-[#F8FAFC] px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24">
            <h3 className="text-4xl md:text-5xl font-black tracking-tight text-[#1A1B4B]">
              Key System Features
            </h3>
            <div className="h-1.5 w-16 bg-[#2D31FA] mt-6 rounded-full"></div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <LineChart size={28} />,
                title: "Demand Intelligence",
                desc: "Understand exactly what your customers want. Use historical sales data to forecast future needs and optimize your reorder points.",
              },
              {
                icon: <ShieldAlert size={28} />,
                title: "Stock Accuracy",
                desc: "Eliminate discrepancies. Real-time tracking and anomaly detection ensure your physical stock always matches your digital records.",
              },
              {
                icon: <Layers size={28} />,
                title: "Enterprise Multi-Tenancy",
                desc: "Manage multiple store locations within a single interface while maintaining absolute data isolation for each tenant.",
              },
              {
                icon: <Zap size={28} />,
                title: "Instant Threshold Alerts",
                desc: "Get notified the moment stock levels dip. Automated alerts ensure you never miss a replenishment window or lose a sale.",
              },
              {
                icon: <Users size={28} />,
                title: "Internal Accountability",
                desc: "Assign specific roles to your team. Staff record daily sales while managers oversee inventory and approve purchases.",
              },
              {
                icon: <BarChart3 size={28} />,
                title: "Profitability Analysis",
                desc: "Identify your top-performing products instantly. Comprehensive reports help you focus on the stock that drives your revenue.",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white p-10 rounded-[2.5rem] border border-slate-100/60 hover:border-[#2D31FA]/20 hover:shadow-[0_30px_60px_-20px_rgba(26,27,75,0.05)] transition-all duration-500 group"
              >
                <div className="text-[#2D31FA] mb-8 bg-[#F0F2FF] w-fit p-4 rounded-2xl group-hover:bg-[#2D31FA] group-hover:text-white transition-all duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-black mb-4 uppercase tracking-tight text-[#1A1B4B]">
                  {feature.title}
                </h3>
                <p className="text-slate-500 text-[15px] leading-relaxed font-medium">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Operational Insights - Refined Typography & Balanced Alignment */}
      <section id="insights" className="py-32 bg-white px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-[#1A1B4B] tracking-tight uppercase">
              Operational Insights
            </h2>
            <p className="text-slate-400 font-bold text-xs md:text-sm tracking-[0.3em] uppercase mt-4 opacity-80">
              Understanding how ForeTrack powers your enterprise
            </p>
            <div className="h-1 w-12 bg-[#2D31FA]/20 mx-auto mt-8 rounded-full"></div>
          </div>

          <div className="grid gap-4">
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
                className="group bg-slate-50/50 rounded-[2rem] px-8 md:px-12 py-8 transition-all duration-500 hover:bg-slate-50 border border-transparent hover:border-slate-100"
              >
                <summary className="flex justify-between items-center cursor-pointer list-none gap-6">
                  <span className="text-xl md:text-2xl font-black text-[#1A1B4B] group-open:text-[#2D31FA] transition-colors duration-300 tracking-tight leading-snug">
                    {item.q}
                  </span>
                  <div className="flex-shrink-0 bg-white shadow-sm border border-slate-100 group-open:bg-[#2D31FA] group-open:border-[#2D31FA] p-3 rounded-full transition-all duration-300">
                    <ChevronDown className="w-5 h-5 text-[#2D31FA] group-open:text-white group-open:rotate-180 transition-transform duration-300" />
                  </div>
                </summary>
                <div className="overflow-hidden">
                  <p className="pt-6 text-slate-500 text-lg leading-relaxed font-medium max-w-2xl group-open:animate-fade-in-down">
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer - Minimalist & Stable */}
      <footer className="bg-[#1A1B4B] text-white py-20 px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-3">
            <Image
              src="/icon-192x192.png"
              alt="ForeTrack Logo"
              width={40}
              height={40}
              className="object-contain rounded-lg opacity-80"
              priority
            />
            <span className="text-xl font-black tracking-tighter text-white opacity-90">
              ForeTrack
            </span>
          </div>

          <p className="text-xs font-bold text-slate-500 tracking-wide">
            © 2026 ForeTrack Systems. All rights reserved.
          </p>

          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
            <span className="hover:text-[#2D31FA] transition-colors cursor-default">
              Secure
            </span>
            <span className="hover:text-[#2D31FA] transition-colors cursor-default">
              Scalable
            </span>
            <span className="hover:text-[#2D31FA] transition-colors cursor-default">
              Intelligent
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}