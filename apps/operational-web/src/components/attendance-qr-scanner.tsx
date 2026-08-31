"use client"

import { useEffect, useRef, useState } from "react"
import { CameraIcon, SquareIcon } from "lucide-react"
import { Button } from "@rms/ui/button"
import { Card } from "@rms/ui/card"
import { apiClient } from "@rms/api-client/client"

function tokenFromValue(value: string): string {
  try {
    const url = new URL(value)
    return url.searchParams.get("attendanceToken") ?? value
  } catch {
    return value
  }
}

export function AttendanceQrScanner({ onComplete }: { onComplete: () => void }) {
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
      if (!videoRef.current) return
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
    <Card className="gap-3 rounded-2xl border-border/60 p-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Attendance</p>
          <p className="text-sm text-muted-foreground">Scan either the clock-in or clock-out QR code.</p>
        </div>
        <Button variant={scanning ? "destructive" : "default"} onClick={scanning ? stop : () => void start()}>
          {scanning ? <><SquareIcon className="mr-2 size-4" />Stop</> : <><CameraIcon className="mr-2 size-4" />Scan QR</>}
        </Button>
      </div>
      {scanning && <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </Card>
  )
}
