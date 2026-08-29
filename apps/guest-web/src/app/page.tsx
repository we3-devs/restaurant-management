import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QRRedirect({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;

  if (table) {
    redirect(`/table?table=${encodeURIComponent(table)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-gray-600">Invalid QR code.</p>
    </div>
  );
}