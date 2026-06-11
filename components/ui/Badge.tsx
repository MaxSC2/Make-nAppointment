import { type ReactNode } from "react";

interface BadgeProps {
  variant?: "teal" | "green" | "amber" | "red" | "blue" | "gray";
  children: ReactNode;
}

const variantStyles: Record<string, string> = {
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  green: "bg-green-50 text-green-700 border-green-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  gray: "bg-background text-muted-foreground border-border",
};

export function Badge({ variant = "gray", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-label font-semibold ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
