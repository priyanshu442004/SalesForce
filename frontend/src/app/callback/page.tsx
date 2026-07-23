
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMigration } from "@/context/MigrationContext";
import type { SfConnection, SfRole } from "@/context/MigrationContext";
import { NEXT_PUBLIC_API_URL } from "@/lib/config";

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSourceSf, setMasterSf, setTargetSf } = useMigration();
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

    // The backend encodes state as "{role}|{prod|sandbox}" so we can route
    // the token to the correct connection slot and use the right token URL.
    const rawState = searchParams.get("state") ?? "source|prod";
    const parts = rawState.split("|");
    const role = (parts[0] as SfRole) || "source";
    const isSandbox = parts[1] === "sandbox";

    const setters: Record<SfRole, React.Dispatch<React.SetStateAction<SfConnection>>> = {
      source: setSourceSf,
      master: setMasterSf,
      target: setTargetSf,
    };
    const setConnection = setters[role] ?? setSourceSf;

    (async () => {
      try {
        console.log(`[callback] role=${role} sandbox=${isSandbox} code=${code.slice(0, 10)}…`);
        const callbackUrl = `${NEXT_PUBLIC_API_URL}/salesforce/callback?code=${encodeURIComponent(code)}${isSandbox ? "&sandbox=true" : ""}`;
        const res = await fetch(callbackUrl);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail?.message ?? body?.detail ?? "Token exchange failed.");
        }
        const data = await res.json();
        console.log(`[callback] ${role} connected — instance_url: ${data.instance_url}`);

        // Fetch the authenticated user's email (non-fatal)
        let userEmail: string | null = null;
        try {
          const infoRes = await fetch(
            `${data.instance_url}/services/oauth2/userinfo`,
            { headers: { Authorization: `Bearer ${data.access_token}` } }
          );
          if (infoRes.ok) {
            const info = await infoRes.json();
            userEmail = info.email ?? null;
          }
        } catch {
          // non-fatal — email is optional display info
        }

        setConnection({
          accessToken:  data.access_token,
          instanceUrl:  data.instance_url,
          refreshToken: data.refresh_token ?? null,
          userEmail,
        });

        const returnTo = sessionStorage.getItem("sfReturnTo") || "/transformation-workspace";
        sessionStorage.removeItem("sfReturnTo");
        console.log(`[callback] redirecting to ${returnTo}`);
        router.replace(returnTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect to Salesforce.");
      }
    })();
  }, [searchParams, setSourceSf, setMasterSf, setTargetSf, router]);

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
