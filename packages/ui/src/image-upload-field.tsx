"use client"

import { useRef, useState } from "react"
import { ImageIcon, Loader2, Upload, X } from "lucide-react"
import { useUploadBranding } from "@rms/api-client/hooks/use-settings"
import { Button } from "./button"
import { Input } from "./input"

/** Mirrors ALLOWED_IMAGE_TYPES on the backend — SVG is excluded there on purpose. */
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/x-icon"

/**
 * Picks an image, uploads it, and stores the resulting URL in the form field.
 *
 * The URL stays visible and editable underneath: installs that already point
 * at an externally hosted image keep working, and it makes it obvious when a
 * field holds something that isn't an image at all — a link to an icon site's
 * *page* rather than the file, which is easy to paste by mistake.
 */
export function ImageUploadField({
  value,
  onChange,
  disabled,
  hint,
}: {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  hint?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadBranding()
  const [error, setError] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const { url } = await upload.mutateAsync(file)
      setBroken(false)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {value && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary
            // remote host; next/image would need it in remotePatterns up front.
            <img
              src={value}
              alt="Preview"
              className="size-full object-contain"
              onError={() => setBroken(true)}
              onLoad={() => setBroken(false)}
            />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0])
              // Reset so re-picking the same file still fires a change event.
              event.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {upload.isPending ? "Uploading..." : "Upload image"}
          </Button>

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setBroken(false)
                onChange("")
              }}
            >
              <X className="size-3.5" />
              Remove
            </Button>
          )}
        </div>
      </div>

      <Input
        value={value}
        disabled={disabled}
        placeholder="…or paste an image URL"
        onChange={(event) => {
          setBroken(false)
          onChange(event.target.value)
        }}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && value && broken && (
        <p className="text-xs text-amber-600">
          This URL didn&apos;t load as an image. Make sure it points at the image
          file itself, not a page about it.
        </p>
      )}
      {!error && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
