import * as React from "react"

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <span className="relative group">{children}</span>
}

export function TooltipTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  return <span>{children}</span>
}

export function TooltipContent({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      {children}
    </span>
  )
} 