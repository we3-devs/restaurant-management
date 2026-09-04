"use client"

import { useEffect, useRef, useState } from "react"
import { CameraIcon, XIcon } from "lucide-react"
import { Button } from "@rms/ui/button"
import { SettingsRow } from "@rms/ui/settings-row"
import { apiClient } from "@rms/api-client/client"

function tokenFromValue(value: string): string {
  try {
    const url = new URL(value)
    return url.searchParams.get("attendanceToken") ?? value
  } catch {
    return value
  }
}

export function AttendanceQrScanner({ onComplete, status }: { onComplete: () => void; status: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setScanning(false)
  }

  async function submit(value: string) {
    stop()
    setMessage("Saving attendance…")
    try {
      await apiClient("/attendance/qr/scan", {
        method: "POST",
        body: JSON.stringify({ token: tokenFromValue(value) }),
      })
      setMessage("Attendance updated successfully")
      onComplete()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance scan failed")
    }
  }

  async function start() {
    setMessage(null)
    const BarcodeDetectorClass = (window as typeof window & { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
    if (!BarcodeDetectorClass) {
      setMessage("QR scanning is not supported by this browser. Open the printed QR while logged in instead.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      streamRef.current = stream
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setMessage("Could not open the camera preview")
        return
      }
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true)
      const detector = new BarcodeDetectorClass({ formats: ["qr_code"] })
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return
        const codes = await detector.detect(videoRef.current).catch(() => [])
        if (codes[0]?.rawValue) {
          await submit(codes[0].rawValue)
          return
        }
        frameRef.current = requestAnimationFrame(() => void scan())
      }
      void scan()
    } catch {
      stop()
      setMessage("Camera access was denied or unavailable")
    }
  }

  useEffect(() => stop, [])

  return (
    <>
      <SettingsRow icon={CameraIcon} label="Attendance" trailing={<span className="text-right text-sm text-muted-foreground">{status}</span>} onClick={() => void start()} />
      <div className={`${scanning ? "fixed flex" : "hidden"} inset-0 z-50 items-center justify-center bg-black/70 p-4`}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div><p className="font-semibold">Scan attendance QR</p><p className="text-sm text-muted-foreground">Use clock-in or clock-out QR</p></div>
              <Button variant="ghost" size="icon" onClick={stop} aria-label="Close scanner"><XIcon className="size-5" /></Button>
            </div>
            <video ref={videoRef} muted playsInline className="aspect-square w-full rounded-xl bg-black object-cover" />
            {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
          </div>
      </div>
    </>
  )
}
