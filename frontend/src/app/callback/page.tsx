
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMigration } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSfAccessToken, setSfInstanceUrl, setSfRefreshToken, setSfUserEmail } = useMigration();
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received from Salesforce.");
      return;
    }

    (async () => {
      try {
        console.log("[callback] calling /salesforce/callback with code:", code.slice(0, 10) + "…");
        const res = await fetch(
          `${NEXT_PUBLIC_API_URL}/salesforce/callback?code=${encodeURIComponent(code)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail?.message ?? body?.detail ?? "Token exchange failed.");
        }
        const data = await res.json();
        console.log("[callback] received response:", { access_token: data.access_token?.slice(0, 12) + "…", instance_url: data.instance_url, refresh_token: data.refresh_token ? "present" : "absent" });
        setSfAccessToken(data.access_token);
        console.log("[callback] setSfAccessToken called");
        setSfInstanceUrl(data.instance_url);
        console.log("[callback] setSfInstanceUrl called");
        setSfRefreshToken(data.refresh_token);
        console.log("[callback] setSfRefreshToken called");

        try {
          const infoRes = await fetch(
            `${data.instance_url}/services/oauth2/userinfo`,
            { headers: { Authorization: `Bearer ${data.access_token}` } }
          );
          if (infoRes.ok) {
            const info = await infoRes.json();
            setSfUserEmail(info.email ?? null);
          }
        } catch {
          // non-fatal — email is optional display info
        }

        const returnTo = sessionStorage.getItem("sfReturnTo") || "/transformation-workspace";
        sessionStorage.removeItem("sfReturnTo");
        console.log("[callback] calling router.replace(" + returnTo + ")");
        router.replace(returnTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect to Salesforce.");
      }
    })();
  }, [searchParams, setSfAccessToken, setSfInstanceUrl, setSfRefreshToken, setSfUserEmail, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-sm text-center space-y-2">
          <p className="text-sm font-semibold text-rose-600">Connection failed</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm font-medium text-slate-500">Connecting to Salesforce…</p>
    </div>
  );
}
