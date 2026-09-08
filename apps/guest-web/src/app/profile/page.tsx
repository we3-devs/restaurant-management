"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, UserRound } from "lucide-react";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { authFetch, readError } from "@/lib/api";
import { setCustomerName } from "@/lib/guest-auth";

type Profile = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  dateOfBirth: string | null;
};

type FormValues = {
  name: string;
  email: string;
  address: string;
  dateOfBirth: string;
};

export default function ProfilePage() {
  const { isAuthenticated, signOut } = useGuestAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormValues>({ name: "", email: "", address: "", dateOfBirth: "" });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    void (async () => {
      const response = await authFetch("/customer-portal/profile");
      if (!response.ok) {
        setError(await readError(response, "Unable to load your profile."));
        return;
      }
      const data = (await response.json()) as Profile;
      setProfile(data);
      setForm({
        name: data.name ?? "",
        email: data.email ?? "",
        address: data.address ?? "",
        dateOfBirth: data.dateOfBirth?.slice(0, 10) ?? "",
      });
    })();
  }, [isAuthenticated]);

  function beginEditing() {
    if (!profile) return;
    setForm({
      name: profile.name ?? "",
      email: profile.email ?? "",
      address: profile.address ?? "",
      dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? "",
    });
    setNotice(null);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await authFetch("/customer-portal/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to save your profile."));
      const updated = (await response.json()) as Profile;
      setProfile(updated);
      setCustomerName(updated.name);
      setEditing(false);
      setNotice("Your profile was updated.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to save your profile.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <p className="font-semibold text-slate-900">Please log in to view your profile.</p>
          <a href="/" className="mt-3 inline-block text-sm text-brand-700">Back to menu</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-lg">
        <a href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-slate-600">
          <ArrowLeft size={16} /> Back to menu
        </a>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-100 p-3 text-brand-700"><UserRound size={22} /></div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Profile</h1>
              <p className="text-sm text-slate-500">Manage your customer information</p>
            </div>
            {!editing && profile && (
              <button onClick={beginEditing} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                <Pencil size={15} /> Edit info
              </button>
            )}
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
          {!profile && !error && <p className="mt-8 text-center text-sm text-slate-500">Loading profile…</p>}

          {profile && editing && (
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600" /></label>
              <label className="block text-sm font-medium text-slate-700">Phone number<p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-slate-500">{profile.phone || "Not provided"}</p><span className="mt-1 block text-xs font-normal text-slate-400">Your verified number cannot be changed.</span></label>
              <label className="block text-sm font-medium text-slate-700">Email<input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600" /></label>
              <label className="block text-sm font-medium text-slate-700">Address<textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600" /></label>
              <label className="block text-sm font-medium text-slate-700">Date of birth<input type="date" value={form.dateOfBirth ?? ""} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600" /></label>
              <div className="flex justify-end gap-2 pt-2"><button onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600">Cancel</button><button onClick={save} disabled={busy || form.name.trim().length < 2} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button></div>
            </div>
          )}

          {profile && !editing && (
            <dl className="mt-6 divide-y divide-slate-100">
              {[["Name", profile.name], ["Phone number", profile.phone || "Not provided"], ["Email", profile.email || "Not provided"], ["Address", profile.address || "Not provided"], ["Date of birth", profile.dateOfBirth?.slice(0, 10) || "Not provided"]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-900">{value}</dd></div>)}
            </dl>
          )}
          <button onClick={signOut} className="mt-6 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Log out</button>
        </section>
      </div>
    </main>
  );
}
