"use client";

import { useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { API_URL, readError } from "@/lib/api";
import { setSession } from "@/lib/guest-auth";

// Mirrors the backend's PHONE_PATTERN (RequestOtpDto / VerifyOtpDto) so a bad
// number is caught before it costs a round trip.
const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;

const normalisePhone = (value: string) => value.replace(/[\s()-]/g, "");

type Mode = "login" | "signup";

/**
 * Guest sign-in. Logging in takes a number and an OTP; creating an account
 * also takes a name. Both end at the same place — CustomerAuthService issues a
 * customer token and findOrCreateCustomer resolves the phone to a Customer row.
 *
 * The phone is verified by OTP because that is what the backend requires:
 * POST /orders/guest runs requireVerifiedCustomerId and rejects anyone else.
 */
export function GuestAuthSheet({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [stage, setStage] = useState<"identify" | "verify">("identify");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phoneValid = PHONE_PATTERN.test(normalisePhone(phone));
  const nameValid = name.trim().length > 1;
  const canIdentify = phoneValid && (mode === "login" || nameValid) && !busy;
  // Only asked for here if we switched a login into a signup after the code
  // was already sent — re-requesting would hit the 60s resend lock.
  const needsName = mode === "signup" && !nameValid;

  function switchMode(next: Mode) {
    setMode(next);
    setStage("identify");
    setError(null);
    setNotice(null);
    setCode("");
  }

  async function requestOtp() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/customer-auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalisePhone(phone) }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to send code"));
      const body = await res.json();
      setDevCode(body.devCode ?? null);

      // The code is out and locked for 60s either way, so a wrong tab flips the
      // mode and carries on rather than sending the guest back to wait it out.
      if (mode === "login" && body.registered === false) {
        setMode("signup");
        setNotice("Looks like you're new here — add your name to finish.");
      } else if (mode === "signup" && body.registered === true) {
        setMode("login");
        setNotice("This number already has an account — just verify to log in.");
      }

      setStage("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/customer-auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalisePhone(phone),
          code,
          // Only sent when registering — for an existing customer the backend
          // ignores it, and omitting it keeps the intent honest.
          ...(mode === "signup" && nameValid ? { name: name.trim() } : {}),
        }),
      });
      if (!res.ok)
        throw new Error(await readError(res, "Invalid or expired code"));
      const body = await res.json();
      setSession(body.accessToken, body.customer?.name ?? name.trim());
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            {stage === "verify" && (
              <button
                onClick={() => setStage("identify")}
                aria-label="Back"
                className="-ml-1 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900">
                {stage === "verify"
                  ? "Enter your code"
                  : mode === "login"
                    ? "Log in"
                    : "Create account"}
              </h2>
              <p className="truncate text-xs text-slate-500">
                {stage === "verify"
                  ? `Sent to ${normalisePhone(phone)}`
                  : "Needed so your order reaches your table"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {stage === "identify" && (
          <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition ${
                  mode === m
                    ? "border-brand-600 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 p-4">
          {notice && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
              {notice}
            </p>
          )}

          {stage === "identify" ? (
            <>
              {mode === "signup" && (
                <div>
                  <label
                    htmlFor="guest-name"
                    className="mb-1.5 block text-xs font-medium text-slate-600"
                  >
                    Your name
                  </label>
                  <input
                    id="guest-name"
                    value={name}
                    autoComplete="name"
                    placeholder="e.g. Ujwal"
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="guest-phone"
                  className="mb-1.5 block text-xs font-medium text-slate-600"
                >
                  Phone number
                </label>
                <input
                  id="guest-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  placeholder="9800000000"
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
                {phone.length > 0 && !phoneValid && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Enter a valid number, without a leading zero.
                  </p>
                )}
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                onClick={requestOtp}
                disabled={!canIdentify}
                className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? "Sending…" : "Send code"}
              </button>
            </>
          ) : (
            <>
              {/* TEMPORARY: the API echoes the code in every environment because
                  SMS delivery isn't confirmed yet (CustomerAuthService.requestOtp).
                  Remove alongside the backend's devCode. */}
              {devCode && (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                  Your code is{" "}
                  <span className="font-mono font-semibold text-slate-900">
                    {devCode}
                  </span>
                </p>
              )}

              {needsName && (
                <input
                  value={name}
                  autoComplete="name"
                  placeholder="Your name"
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              )}

              <input
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-center font-mono text-lg tracking-[0.4em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                onClick={verifyOtp}
                disabled={code.length !== 6 || needsName || busy}
                className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? "Verifying…" : mode === "signup" ? "Create account" : "Log in"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
