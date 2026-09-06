import type { ReactNode } from "react"

function renderLine(line: string, lineIndex: number): ReactNode {
  const parts = line.replace(/\\([*_])/g, "$1").split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
  return (
    <span key={lineIndex}>
      {lineIndex > 0 && <br />}
      {parts.map((part, index) => {
        const isBold = (part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))
        return isBold ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>
      })}
    </span>
  )
}

export function AssistantMessage({ text }: { text: string }) {
  return <>{text.split("\n").map(renderLine)}</>
}
