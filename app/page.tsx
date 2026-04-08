"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoFirm, setDemoFirm] = useState("");
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [scrolled, setScrolled] = useState(false);
  const [showcaseTab, setShowcaseTab] = useState("Client View");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  async function handleDemoRequest(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: demoName, email: demoEmail, firm: demoFirm }),
      });
    } catch {}
    setDemoSubmitted(true);
  }

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage }),
      });
    } catch {}
    setContactSubmitted(true);
  }

  const plans = [
    {
      name: "Starter",
      price: billingInterval === "annual" ? "$41" : "$49",
      period: "/mo",
      description: "Perfect for small firms getting started",
      clients: "Up to 5 clients",
      users: "1 accountant seat",
      features: [
        "Unlimited receipts",
        "AI categorization & OCR",
        "Tax code mapping (GST/HST/PST)",
        "Project folders",
        "Email receipt forwarding",
        "SMS purpose collection",
        "CSV export",
        "In-app AI support chat",
      ],
      cta: "Get Started",
      highlighted: false,
    },
    {
      name: "Professional",
      price: billingInterval === "annual" ? "$166" : "$199",
      period: "/mo",
      description: "For growing firms with more clients",
      clients: "Up to 20 clients",
      users: "3 accountant seats",
      features: [
        "Everything in Starter",
        "Advanced reports & edit history",
        "Budget tracking & alerts",
        "Monthly client reports",
        "Business card fraud detection",
        "Client detail profiles",
        "Multi-user collaboration",
        "Receipt edit tracking",
      ],
      cta: "Get Started",
      highlighted: true,
      badge: "Most Popular",
    },
    {
      name: "Enterprise",
      price: billingInterval === "annual" ? "$291" : "$349",
      period: "/mo",
      description: "For large firms with complex needs",
      clients: "Unlimited clients",
      users: "Unlimited accountant seats",
      features: [
        "Everything in Professional",
        "Unlimited clients & users",
        "Training & onboarding modules",
        "Priority onboarding call with founder",
        "Custom feature requests",
        "SLA guarantee",
        "Dedicated support channel",
      ],
      cta: "Contact Us",
      highlighted: false,
    },
  ];

  const steps = [
    {
      number: "01",
      role: "Client",
      icon: "📸",
      title: "Snap & Submit",
      description: "Clients photograph receipts with their phone or forward email receipts. Takes seconds — no app download required.",
      color: "from-blue-500 to-blue-600",
    },
    {
      number: "02",
      role: "AI",
      icon: "🤖",
      title: "AI Extracts Everything",
      description: "Our AI reads vendor, amount, date, line items, and HST automatically. A text message asks the client for the expense purpose.",
      color: "from-purple-500 to-purple-600",
    },
    {
      number: "03",
      role: "Accountant",
      icon: "✅",
      title: "Review & Categorize",
      description: "Accountants see organized receipts with AI-suggested categories. Review flags, approve categories, and export for tax season.",
      color: "from-green-500 to-green-600",
    },
  ];

  const features = [
    { icon: "📱", title: "SMS Purpose Collection", desc: "Clients get a text asking for the expense purpose. They reply in seconds. No app needed." },
    { icon: "🤖", title: "AI-Powered OCR", desc: "Extracts vendor, amount, date, line items, and tax from any receipt photo or forwarded email." },
    { icon: "🗂️", title: "Tax Code Mapping", desc: "Every receipt is automatically mapped to the correct CRA line — T2125, T776, or T2200." },
    { icon: "🚩", title: "Smart Flagging", desc: "Automatically flags personal cards, duplicate receipts, and category mismatches for review." },
    { icon: "📊", title: "Monthly Reports", desc: "Auto-generated monthly expense reports per client, ready for tax prep or review meetings." },
    { icon: "📧", title: "Email Forwarding", desc: "Clients forward Amazon, Meta, or any digital receipt to their unique inbox address." },
    { icon: "💬", title: "In-App Messaging", desc: "Direct messaging between clients and accountants — no more email chains for receipt questions." },
    { icon: "📥", title: "QuickBooks Export", desc: "One-click CSV export in QuickBooks-compatible format for seamless accounting workflow." },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@700;800&display=swap');

        * { box-sizing: border-box; }

        .hero-gradient {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
        }

        .accent { color: #3b82f6; }
        .accent-bg { background: #3b82f6; }

        .glass {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.12);
        }

        .step-line {
          background: linear-gradient(90deg, #3b82f6, transparent);
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .float { animation: float 4s ease-in-out infinite; }
        .float-delay { animation: float 4s ease-in-out 1.5s infinite; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .fade-up-delay { animation: fadeUp 0.6s ease 0.2s forwards; opacity: 0; }
        .fade-up-delay-2 { animation: fadeUp 0.6s ease 0.4s forwards; opacity: 0; }

        .nav-blur {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .pricing-highlight {
          background: linear-gradient(135deg, #1e3a5f, #2563eb);
          transform: scale(1.05);
        }

        .dot-pattern {
          background-image: radial-gradient(circle, #e2e8f0 1px, transparent 1px);
          background-size: 24px 24px;
        }
      `}</style>

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 nav-blur transition-all duration-300 ${scrolled ? "bg-white/90 shadow-sm border-b border-gray-100" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className={`text-xl font-bold ${scrolled ? "text-gray-900" : "text-white"}`} style={{ fontFamily: "'Playfair Display', serif" }}>
              Receipture
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
{["Features", "How It Works", "Pricing", "Contact"].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                                className={`text-sm font-medium transition-colors hover:text-blue-500 ${scrolled ? "text-gray-600" : "text-white/80"}`}
              >
                {item}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${scrolled ? "text-gray-700 hover:bg-gray-100" : "text-white hover:bg-white/10"}`}
            >
              Sign In
            </Link>
            <a
              href="#demo"
              className="text-sm font-semibold px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg shadow-blue-600/30"
            >
              Request Demo
            </a>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            <span className={scrolled ? "text-gray-900" : "text-white"}>☰</span>
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
            {["Features", "How It Works", "Pricing", "Contact"].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`} className="block text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>
                {item}
              </a>
            ))}
            <Link href="/login" className="block text-gray-700 font-medium">Sign In</Link>
            <a href="#demo" className="block bg-blue-600 text-white text-center py-2 rounded-xl font-semibold" onClick={() => setMenuOpen(false)}>
              Request Demo
            </a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="hero-gradient min-h-screen flex items-center relative overflow-hidden">
        {/* Background dots */}
        <div className="absolute inset-0 opacity-10">
          <div className="dot-pattern w-full h-full" />
        </div>
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 pt-32 pb-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-blue-300 text-sm font-medium mb-8 fade-up">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Now accepting accounting firms across Canada
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 fade-up-delay leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Your accountant called.
              <br />
              <span className="text-blue-400">They want your receipts.</span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100/70 mb-10 max-w-2xl mx-auto fade-up-delay-2 font-light">
              Receipts in. Tax season out.
            </p>

            <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto fade-up-delay-2">
              AI-powered receipt management for Canadian accounting firms. Clients snap photos, 
              our AI extracts everything, accountants review in minutes — not hours.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center fade-up-delay-2">
              <a
                href="#demo"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl transition-all shadow-2xl shadow-blue-600/40 text-lg"
              >
                Request a Demo →
              </a>
              <a
                href="#how-it-works"
                className="px-8 py-4 glass text-white font-semibold rounded-2xl transition-all hover:bg-white/10 text-lg"
              >
                See How It Works
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-20 max-w-2xl mx-auto">
              {[
                { value: "5 min", label: "Daily client check-in" },
                { value: "100%", label: "Canadian tax compliant" },
                { value: "3 roles", label: "Client, Accountant, Admin" },
              ].map((stat) => (
                <div key={stat.label} className="glass rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-xs text-white/50">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-sm flex flex-col items-center gap-2">
          <span>Scroll</span>
          <div className="w-px h-8 bg-white/20" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">The Process</div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Three steps. That&apos;s it.
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              From receipt photo to tax-ready record in under 5 minutes — without bothering your clients.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-px step-line z-10" style={{ width: "calc(100% - 2rem)" }} />
                )}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 card-hover">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-2xl mb-6 shadow-lg`}>
                    {step.icon}
                  </div>
                  <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">{step.role}</div>
                  <div className="text-4xl font-bold text-gray-100 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{step.number}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Time savings callout */}
          <div className="mt-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-8 md:p-12 text-white text-center">
            <div className="text-5xl mb-4">⏱️</div>
            <h3 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
              5–10 minutes a day keeps tax season stress away.
            </h3>
            <p className="text-blue-100 text-lg max-w-2xl mx-auto">
              Clients spend 30 seconds uploading receipts. Accountants spend 5 minutes reviewing. 
              No more scrambling at year-end — everything is organized as it happens.
            </p>
          </div>
        </div>
      </section>

      {/* PRODUCT SHOWCASE - Add this between How It Works and Features sections */}
<section id="showcase" className="py-24 bg-white overflow-hidden">
  <div className="max-w-7xl mx-auto px-6">
    <div className="text-center mb-16">
      <div className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">The Product</div>
      <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
        Built for the real world.
      </h2>
      <p className="text-lg text-gray-500 max-w-xl mx-auto">
        Three different views. One seamless workflow.
      </p>
    </div>

    {/* Tab switcher */}
    <div className="flex justify-center mb-10">
      <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
        {["Client View", "Accountant View", "Firm Admin View"].map((tab) => (
          <button
            key={tab}
            onClick={() => setShowcaseTab(tab)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              showcaseTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>

    {/* Client View */}
    {showcaseTab === "Client View" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold mb-6">
            👤 Client Experience
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            30 seconds to submit a receipt.
          </h3>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Clients open the app, tap upload, take a photo. Our AI does the rest — extracting vendor, amount, date, and tax automatically. A simple text message asks for the expense purpose.
          </p>
          <ul className="space-y-3">
            {["No app download required — works in any browser", "Photo, PDF, or forwarded email receipts", "SMS follow-up for expense purpose", "Real-time budget tracking"].map(item => (
              <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Phone frame */}
            <div className="w-72 bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
              <div className="bg-white rounded-[2.5rem] overflow-hidden" style={{ height: "580px" }}>
                {/* Status bar */}
                <div className="bg-white px-6 pt-4 pb-2 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-900">9:41</span>
                  <div className="w-24 h-5 bg-gray-900 rounded-full" />
                  <div className="flex gap-1">
                    <div className="w-4 h-3 bg-gray-900 rounded-sm opacity-80" />
                  </div>
                </div>

                {/* App header */}
                <div className="bg-blue-600 px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-blue-200 text-xs">Good afternoon,</p>
                      <p className="text-white font-bold text-lg">Piccinin 👋</p>
                    </div>
                    <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">BP</span>
                    </div>
                  </div>
                </div>

                {/* Upload button */}
                <div className="px-4 pt-4">
                  <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl p-5 text-center mb-4">
                    <div className="text-2xl mb-1">📸</div>
                    <p className="text-blue-700 font-semibold text-sm">Upload Receipt</p>
                    <p className="text-blue-400 text-xs mt-1">Tap to take a photo</p>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[["19", "Total"], ["7", "This Month"], ["84%", "Categorized"]].map(([val, label]) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-2 text-center">
                        <p className="font-bold text-gray-900 text-sm">{val}</p>
                        <p className="text-gray-400 text-xs">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recent receipts */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Receipts</p>
                  {[
                    { vendor: "Harvey's", amount: "$37.26", cat: "Meals", color: "bg-green-100 text-green-700" },
                    { vendor: "Fortinos", amount: "$21.44", cat: "Groceries", color: "bg-blue-100 text-blue-700" },
                    { vendor: "Shell", amount: "$89.50", cat: "Fuel", color: "bg-amber-100 text-amber-700" },
                  ].map((r) => (
                    <div key={r.vendor} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.vendor}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.color}`}>{r.cat}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{r.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SMS bubble floating */}
            <div className="absolute -right-8 top-20 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-52">
              <p className="text-xs text-gray-500 mb-1">📱 Text message</p>
              <p className="text-xs text-gray-800 leading-relaxed">
                "Hi Piccinin! We received your Harvey's receipt for $37.26. What was the purpose?
                <br/><br/>1. Business meal<br/>2. Team lunch<br/>3. Client entertainment"
              </p>
              <div className="mt-2 bg-blue-600 rounded-xl px-3 py-1.5 text-center">
                <p className="text-white text-xs font-medium">Reply: "1"</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Accountant View */}
    {showcaseTab === "Accountant View" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold mb-6">
            💼 Accountant Experience
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Review. Categorize. Export.
          </h3>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Accountants see every receipt organized by client, with AI-suggested categories and flags for anything that needs attention. What used to take hours now takes minutes.
          </p>
          <ul className="space-y-3">
            {["AI pre-categorizes every receipt automatically", "Flags personal cards, duplicates, mismatches", "Edit history tracks every change made", "One-click QuickBooks CSV export", "Direct messaging with clients in-app"].map(item => (
              <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Desktop mockup */}
        <div className="bg-gray-100 rounded-2xl p-4 shadow-xl">
          {/* Browser bar */}
          <div className="bg-white rounded-xl mb-3 px-4 py-2 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-gray-100 rounded-lg px-3 py-1 text-xs text-gray-400">
              receipture.ca/dashboard/receipts
            </div>
          </div>

          {/* Dashboard */}
          <div className="bg-white rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Receipts</p>
                <p className="text-xs text-gray-400">19 total receipts</p>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">📥 Export CSV</div>
              </div>
            </div>

            {/* Client cards */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Client View</p>
              <div className="flex gap-2">
                {[
                  { name: "J. Test", flags: 4, color: "border-orange-300 bg-orange-50" },
                  { name: "Malina P.", flags: 2, color: "border-blue-200 bg-blue-50" },
                  { name: "Bran T.", flags: 0, color: "border-gray-200 bg-white" },
                ].map(c => (
                  <div key={c.name} className={`border rounded-xl px-3 py-2 text-xs ${c.color}`}>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    {c.flags > 0 && <p className="text-orange-600">{c.flags} flags</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Receipt rows */}
            <div className="divide-y divide-gray-50">
              {[
                { vendor: "Harvey's", date: "Apr 4", amount: "$37.26", cat: "Meals & Ent.", status: "approved", flag: false },
                { vendor: "Fortinos", date: "Apr 3", amount: "$21.44", cat: "Groceries", status: "pending", flag: false },
                { vendor: "Shoppers", date: "Apr 3", amount: "$30.83", cat: "Uncategorized", status: "review", flag: true },
              ].map(r => (
                <div key={r.vendor} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">🧾</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.vendor}</p>
                      <p className="text-xs text-gray-400">{r.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.flag && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">🚩 Flag</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "approved" ? "bg-green-50 text-green-600" :
                      r.status === "review" ? "bg-yellow-50 text-yellow-600" :
                      "bg-blue-50 text-blue-600"
                    }`}>{r.cat}</span>
                    <span className="text-sm font-bold text-gray-900">{r.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Firm Admin View */}
    {showcaseTab === "Firm Admin View" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold mb-6">
            🏢 Firm Admin Experience
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your whole firm. One dashboard.
          </h3>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Firm admins see everything — all clients, all accountants, firm-wide analytics, and billing. Assign clients to accountants, monitor activity, and manage your subscription.
          </p>
          <ul className="space-y-3">
            {["Manage multiple accountants and their clients", "Firm-wide receipt and flag analytics", "Assign clients to accountants easily", "Training modules for new staff onboarding", "Subscription and billing management"].map(item => (
              <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Admin dashboard mockup */}
        <div className="bg-gray-100 rounded-2xl p-4 shadow-xl">
          <div className="bg-white rounded-xl mb-3 px-4 py-2 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-gray-100 rounded-lg px-3 py-1 text-xs text-gray-400">
              receipture.ca/dashboard
            </div>
          </div>

          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-gray-900 text-sm">Firm Overview</p>
              <p className="text-xs text-gray-400">Piccinin Accounting</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100 border-b border-gray-100">
              {[["47", "Receipts"], ["3", "Flags"], ["89%", "Categorized"], ["7", "Clients"]].map(([val, label]) => (
                <div key={label} className="px-3 py-3 text-center">
                  <p className="font-bold text-gray-900 text-lg">{val}</p>
                  <p className="text-gray-400 text-xs">{label}</p>
                </div>
              ))}
            </div>

            {/* Accountant filter */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">👤 Accountant:</p>
                <div className="bg-gray-100 rounded-lg px-3 py-1 text-xs text-gray-700 font-medium">Accountant 1 ▾</div>
              </div>
            </div>

            {/* Team table */}
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Team</p>
              {[
                { name: "Accountant 1", clients: 4, receipts: 31, status: "Active" },
                { name: "Accountant 2", clients: 3, receipts: 16, status: "Active" },
              ].map(a => (
                <div key={a.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 text-xs font-bold">{a.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.clients} clients · {a.receipts} receipts</p>
                    </div>
                  </div>
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
</section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Features</div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Built for Canadian accounting firms.
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Every feature designed around how your firm actually works — not how software companies think you work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all card-hover">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Role breakdown */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                role: "For Clients",
                icon: "👤",
                color: "bg-blue-50 border-blue-100",
                headerColor: "text-blue-700",
                points: [
                  "Snap a photo — done in 30 seconds",
                  "Reply to a text with the expense purpose",
                  "Forward email receipts automatically",
                  "See spending vs. budget in real time",
                  "No app download required",
                ],
              },
              {
                role: "For Accountants",
                icon: "💼",
                color: "bg-green-50 border-green-100",
                headerColor: "text-green-700",
                points: [
                  "AI pre-categorizes every receipt",
                  "Review flags and approve categories",
                  "Edit history tracks every change",
                  "Export QuickBooks-ready CSV",
                  "Message clients directly in-app",
                ],
              },
              {
                role: "For Firm Admins",
                icon: "🏢",
                color: "bg-purple-50 border-purple-100",
                headerColor: "text-purple-700",
                points: [
                  "Manage multiple accountants and clients",
                  "Assign clients to accountants",
                  "Firm-wide analytics and reporting",
                  "Training modules for new staff",
                  "Subscription and billing management",
                ],
              },
            ].map((role) => (
              <div key={role.role} className={`rounded-3xl border p-8 ${role.color}`}>
                <div className="text-4xl mb-4">{role.icon}</div>
                <h3 className={`text-xl font-bold mb-4 ${role.headerColor}`} style={{ fontFamily: "'Playfair Display', serif" }}>
                  {role.role}
                </h3>
                <ul className="space-y-2">
                  {role.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 bg-gray-50 dot-pattern">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Pricing</div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Simple, transparent pricing.
            </h2>
            <p className="text-lg text-gray-500 mb-8">No per-user fees. No surprise charges. Cancel anytime.</p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-1 bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
              <button
                onClick={() => setBillingInterval("monthly")}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billingInterval === "monthly" ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("annual")}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billingInterval === "annual" ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
              >
                Annual <span className="text-green-500 font-bold ml-1">−17%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl p-8 relative ${plan.highlighted ? "pricing-highlight text-white shadow-2xl shadow-blue-600/30" : "bg-white border border-gray-100 shadow-sm"}`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    {plan.badge}
                  </div>
                )}
                <div className={`text-sm font-semibold uppercase tracking-widest mb-2 ${plan.highlighted ? "text-blue-200" : "text-blue-600"}`}>
                  {plan.name}
                </div>
<div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  {billingInterval === "annual" && (
                    <span className={`text-2xl font-medium line-through ${plan.highlighted ? "text-blue-300" : "text-gray-400"}`}>
                      {plan.name === "Starter" ? "$49" : plan.name === "Professional" ? "$199" : "$349"}
                    </span>
                  )}
                  <span className={`text-5xl font-bold ${plan.highlighted ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'Playfair Display', serif" }}>
                    {plan.price}
                  </span>
                  <span className={`text-lg ${plan.highlighted ? "text-blue-200" : "text-gray-400"}`}>{plan.period}</span>
                </div>
                {billingInterval === "annual" && (
                  <div className={`text-xs font-medium mb-1 ${plan.highlighted ? "text-green-300" : "text-green-600"}`}>
                    Save ${plan.name === "Starter" ? "96" : plan.name === "Professional" ? "396" : "696"}/year
                  </div>
                )}
                                <p className={`text-sm mb-2 ${plan.highlighted ? "text-blue-100" : "text-gray-500"}`}>{plan.description}</p>
                <div className={`text-xs font-medium mb-1 ${plan.highlighted ? "text-blue-200" : "text-blue-600"}`}>{plan.clients}</div>
                <div className={`text-xs font-medium mb-6 ${plan.highlighted ? "text-blue-200" : "text-blue-600"}`}>{plan.users}</div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlighted ? "text-blue-50" : "text-gray-600"}`}>
                      <span className={`mt-0.5 flex-shrink-0 ${plan.highlighted ? "text-green-300" : "text-green-500"}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.cta === "Contact Us" ? "#contact" : "#demo"}
                  className={`block text-center py-3 rounded-xl font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* DEMO REQUEST */}
      <section id="demo" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Request a Demo</div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              See Receipture in action.
            </h2>
            <p className="text-lg text-gray-500">
              We&apos;ll walk you through the full workflow — from client photo to accountant review — in a live demo tailored to your firm.
            </p>
          </div>

          {demoSubmitted ? (
            <div className="bg-green-50 border border-green-200 rounded-3xl p-12 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-green-800 mb-2">Request received!</h3>
              <p className="text-green-600">We&apos;ll be in touch within 24 hours to schedule your demo.</p>
            </div>
          ) : (
            <form onSubmit={handleDemoRequest} className="bg-gray-50 rounded-3xl p-8 border border-gray-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    placeholder="jane@smithcpa.ca"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name</label>
                <input
                  type="text"
                  required
                  value={demoFirm}
                  onChange={(e) => setDemoFirm(e.target.value)}
                  placeholder="Smith & Associates CPA"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-lg shadow-lg shadow-blue-600/30"
              >
                Request My Demo →
              </button>
              <p className="text-xs text-gray-400 text-center">We typically respond within 24 hours. No spam, ever.</p>
            </form>
          )}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Contact Us</div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Have a question?
            </h2>
            <p className="text-lg text-gray-500">
              We&apos;re a small Canadian team. Real humans respond to every message.
            </p>
          </div>

          {contactSubmitted ? (
            <div className="bg-green-50 border border-green-200 rounded-3xl p-12 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-green-800 mb-2">Message sent!</h3>
              <p className="text-green-600">We&apos;ll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleContact} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors"
              >
                Send Message →
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📄</span>
                <span className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Receipture</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                AI-powered receipt management for Canadian accounting firms. Built to save time for clients, accountants, and firm admins.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-widest text-gray-400 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-widest text-gray-400 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#demo" className="hover:text-white transition-colors">Request Demo</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="mailto:branpicc2@gmail.com" className="hover:text-white transition-colors">branpicc2@gmail.com</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} Receipture. All rights reserved. Made in Canada 🍁</p>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}