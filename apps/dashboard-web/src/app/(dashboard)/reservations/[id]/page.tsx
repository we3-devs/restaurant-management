import { ReservationDetail } from "./reservation-detail"

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReservationDetail reservationId={Number(id)} />
}
