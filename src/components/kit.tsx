import type { ReactNode } from "react"

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function Btn({
  children, variant = "primary", size = "md", className = "", ...rest
}: {
  variant?: "primary" | "emerald" | "ghost" | "outline" | "danger" | "dark"
  size?: "sm" | "md"
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<string, string> = {
    primary: "bg-brand text-white hover:bg-brand-700 shadow-sm",
    emerald: "bg-emerald-brand text-white hover:bg-emerald-700 shadow-sm",
    dark: "bg-navy text-white hover:bg-ink shadow-sm",
    ghost: "text-ink hover:bg-ink/[0.05]",
    outline: "border border-line-strong bg-surface text-ink hover:border-muted",
    danger: "bg-serious text-white hover:brightness-95 shadow-sm",
  }
  const sizes = { sm: "px-2.5 py-1.5 text-[12px]", md: "px-3.5 py-2 text-[13px]" }
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

