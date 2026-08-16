"use client"

import { RotateCcw } from "lucide-react"
import { Button } from "./button"
import { Input } from "./input"

const HEX = /^#[0-9a-fA-F]{6}$/

/** Matches the light-mode --primary in globals.css, so Reset restores the shipped look. */
const DEFAULT_PRIMARY = "#0430de"

const PRESETS = [
  "#0430de",
  "#111827",
  "#0f766e",
  "#b91c1c",
  "#c2410c",
  "#7c3aed",
]

/**
 * Colour input backed by the native picker.
 *
 * `<input type="color">` only accepts a full 6-digit hex, so it can't be bound
 * directly to a field that may hold "" or a half-typed value — it would snap to
 * #000000 mid-edit. The text input stays the source of truth and the swatch is
 * fed a validated fallback.
 */
export function ColorPickerField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}) {
  const valid = HEX.test(value)
  const swatchValue = valid ? value : DEFAULT_PRIMARY

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label
          className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
          style={{ backgroundColor: swatchValue }}
        >
          <span className="sr-only">Pick a colour</span>
          <input
            type="color"
            value={swatchValue}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <Input
          value={value}
          disabled={disabled}
          placeholder={DEFAULT_PRIMARY}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value.trim()
            // Typing "0430de" is the common slip — accept it and add the hash.
            onChange(next && !next.startsWith("#") ? `#${next}` : next)
          }}
          className="font-mono"
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(DEFAULT_PRIMARY)}
          title="Reset to default"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            aria-label={`Use ${preset}`}
            onClick={() => onChange(preset)}
            className={`size-6 rounded-md border transition hover:scale-110 ${
              value.toLowerCase() === preset ? "border-foreground" : "border-border"
            }`}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>

      {value && !valid && (
        <p className="text-xs text-amber-600">
          Use a 6-digit hex colour, e.g. {DEFAULT_PRIMARY}.
        </p>
      )}
    </div>
  )
}
