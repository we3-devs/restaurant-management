"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, Plus, Trash2, Users } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { useBranding } from "@/hooks/use-branding";
import { useTableSession } from "@/hooks/use-table-session";
import { GuestAuthSheet } from "@/components/guest-auth-sheet";
import Skeleton from "@/components/skeleton";

export default function TableContent() {
  const router = useRouter();
  const { tableCode } = useGuestSession();
  const { isAuthenticated, name: customerName } = useGuestAuth();
  const branding = useBranding();
  const { session, members, isLoading, addCompanion, removeCompanion } =
    useTableSession(tableCode);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

  const submit = () => {
    if (!name.trim() || !phone.trim()) return;
    addCompanion.mutate(
      { name: name.trim(), phone: phone.trim() },
      {
        onSuccess: () => {
          setName("");
          setPhone("");
          toast.success("Added to the table");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const goToMenu = () => {
    router.replace(tableCode ? `/menu?table=${tableCode}` : "/menu");
  };

  if (!tableCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">Invalid table code</p>
          <p className="mt-1 text-sm text-slate-500">
            Scan the QR code on your table to start.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="max-w-sm space-y-2">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt=""
              className="mx-auto size-12 rounded-xl object-contain"
            />
          )}
          <p className="text-lg font-semibold text-slate-900">
            {branding.restaurantName ?? "Welcome"}
          </p>
          <p className="text-sm text-slate-500">
            Verify your number to join Table {tableCode} — or use the printed
            menu and order with a server.
          </p>
        </div>
        <GuestAuthSheet onClose={goToMenu} onSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {session?.outletName ?? branding.restaurantName ?? "Your table"}
          </h1>
          <p className="text-xs text-slate-500">
            {session?.diningTableName ?? `Table ${tableCode}`}
            {customerName && ` · ${customerName}`}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 py-6">
        <div className="flex items-start gap-2.5 rounded-xl bg-brand-50 px-3.5 py-3 text-sm text-brand-800">
          <Users size={18} className="mt-0.5 shrink-0" />
          <p>
            Everyone who scans this table&apos;s code joins the same order. Add
            anyone who isn&apos;t scanning themselves.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {m.name}
                  </p>
                  {m.phone && (
                    <p className="truncate text-xs text-slate-500">{m.phone}</p>
                  )}
                </div>
                <button
                  onClick={() => removeCompanion.mutate(m.id)}
                  disabled={removeCompanion.isPending}
                  aria-label={`Remove ${m.name}`}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
          <input
            value={name}
            autoComplete="off"
            placeholder="Friend's name"
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <input
            value={phone}
            type="tel"
            inputMode="tel"
            placeholder="Friend's phone (e.g. 9800000000)"
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className={inputClass}
          />
          <button
            onClick={submit}
            disabled={!name.trim() || !phone.trim() || addCompanion.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            {addCompanion.isPending ? "Adding…" : "Add to table"}
          </button>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-md px-4">
          <button
            onClick={goToMenu}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
          >
            Continue to menu
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
