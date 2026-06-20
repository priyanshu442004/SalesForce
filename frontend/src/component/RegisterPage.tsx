"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMigration } from "@/context/MigrationContext";

declare global {
  interface Window {
    google?: any;
  }
}

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

export default function RegisterPage({ onNavigateToLogin }: RegisterPageProps) {
  const { setCurrentUser } = useMigration();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Google Identity Services script
    let script = document.getElementById("google-gis-script") as HTMLScriptElement;

    const initializeGoogleRegister = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "20399312144-s8o42220q34kt2mfckvmfiuaser2450e.apps.googleusercontent.com",
        callback: async (response: any) => {
          if (response.credential) {
            setError(null);
            setIsSubmitting(true);
            try {
              const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: response.credential })
              });
              const data = await res.json();
              if (data.success) {
                setCurrentUser(data.user);
              } else {
                setError(data.error || "Google authentication failed");
              }
            } catch (err: any) {
              console.error(err);
              setError("An unexpected error occurred during Google sign-in.");
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "dark",
          size: "large",
          width: 382,
          text: "signup_with",
          logo_alignment: "left"
        });
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.id = "google-gis-script";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleRegister;
      document.body.appendChild(script);
    } else {
      setTimeout(initializeGoogleRegister, 100);
    }
  }, [setCurrentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();

      if (data.success) {
        setCurrentUser(data.user);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
            Data Migrate
          </h1>
          <p className="text-[13.5px] font-bold text-slate-400">
            Salesforce Migration Lifecycle Platform
          </p>
        </div>

        {/* Register Card */}
        <div className="bg-slate-950/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h2 className="text-xl font-extrabold text-white">Create Account</h2>
            <p className="text-xs font-bold text-slate-500">
              Register a new account to enter the workspace.
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
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Amit Sharma"
                className="w-full h-12 px-4 rounded-xl bg-slate-900 border border-slate-800 text-white text-[14px] font-bold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/35 transition-all"
              />
            </div>

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
                "Sign Up"
              )}
            </button>
          </form>

          {/* Google Register Button */}
          <div className="space-y-3 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <span className="relative px-3 bg-[#0d1527] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                or
              </span>
            </div>
            <div className="flex justify-center w-full min-h-[44px]">
              <div ref={googleBtnRef} className="w-full max-w-[382px] flex justify-center" />
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs font-bold text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-blue-500 hover:text-blue-400 transition-colors focus:outline-none font-black cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
