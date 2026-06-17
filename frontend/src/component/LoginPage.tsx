"use client";

import React, { useState } from "react";
import { useMigration } from "@/context/MigrationContext";

export default function LoginPage() {
  const { setCurrentUser } = useMigration();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        // Set authenticated user in context
        setCurrentUser(data.user);
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("12345678");
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 relative overflow-hidden select-none font-sans">
      
      {/* Background Animated Gradient Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#002BFF]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full mx-4 relative z-10">
        
        {/* Logo and Brand */}
        <div className="text-center mb-8 space-y-2.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#002BFF] to-purple-600 shadow-xl shadow-blue-500/25 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v8" />
              <path d="M9 11h6" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            AI Migrate
          </h1>
          <p className="text-[13.5px] font-bold text-slate-400">
            Salesforce Migration Lifecycle Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-950/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h2 className="text-xl font-extrabold text-white">Sign In</h2>
            <p className="text-xs font-bold text-slate-500">
              Enter your credentials to enter the workspace.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-extrabold flex items-center gap-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="amit@mail.com"
                className="w-full h-12 px-4 rounded-xl bg-slate-900 border border-slate-800 text-white text-[14px] font-bold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/35 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 px-4 rounded-xl bg-slate-900 border border-slate-800 text-white text-[14px] font-bold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/35 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-[#002BFF] hover:bg-blue-700 text-white text-[14px] font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2.5 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Quick Demo Logins Section */}
          <div className="pt-5 border-t border-slate-800/80 space-y-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block text-center">
              Quick Test Profiles
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { name: "Amit", email: "amit@mail.com" },
                { name: "Arthita", email: "arthita@mail.com" },
                { name: "Priyanshu", email: "priyanshu@mail.com" }
              ].map((user) => (
                <button
                  key={user.name}
                  type="button"
                  onClick={() => handleFillDemo(user.email)}
                  className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[12px] font-bold transition-all text-center truncate cursor-pointer select-none"
                >
                  {user.name}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
