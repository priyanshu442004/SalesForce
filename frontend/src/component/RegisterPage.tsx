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
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 select-none font-sans">

      <div className="max-w-md w-full mx-4">

        {/* Logo and Brand */}
        <div className="text-center mb-8 space-y-2.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 shadow-lg mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
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
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Data Migrate
          </h1>
          <p className="text-sm font-medium text-slate-400">
            Salesforce Migration Lifecycle Platform
          </p>
        </div>

        {/* Register Card */}
        <div className="bg-slate-800/50 border border-slate-700/80 backdrop-blur-sm rounded-xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-white">Create Account</h2>
            <p className="text-xs text-slate-400">
              Register a new account to access the workspace.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-medium flex items-center gap-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Amit Sharma"
                className="w-full h-11 px-4 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="amit@mail.com"
                className="w-full h-11 px-4 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          {/* Google Register Button */}
          <div className="space-y-3 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <span className="relative px-3 bg-slate-800/50 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                or
              </span>
            </div>
            <div className="flex justify-center w-full min-h-[44px]">
              <div ref={googleBtnRef} className="w-full max-w-[382px] flex justify-center" />
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-blue-400 hover:text-blue-300 transition-colors focus:outline-none font-semibold cursor-pointer"
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
