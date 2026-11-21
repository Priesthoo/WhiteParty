import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "dark" | "outline";
type Size = "sm" | "md" | "lg";
type Base = { children: ReactNode; variant?: Variant; size?: Size; fullWidth?: boolean; className?: string };
type ButtonProps = Base & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "size">;
type LinkProps = Base & Omit<ComponentProps<typeof Link>, "className" | "children">;
function buttonClass(p: Base) { return ["btn", `btn-${p.variant ?? "primary"}`, p.size === "sm" ? "btn-sm" : p.size === "lg" ? "btn-lg" : "", p.fullWidth ? "btn-full" : "", p.className ?? ""].filter(Boolean).join(" "); }
export function Button({ children, variant, size, fullWidth, className, ...props }: ButtonProps) { return <button className={buttonClass({ variant, size, fullWidth, className })} {...props}>{children}</button>; }
export function ButtonLink({ children, variant, size, fullWidth, className, ...props }: LinkProps) { return <Link className={buttonClass({ variant, size, fullWidth, className })} {...props}>{children}</Link>; }
export function Badge({ variant = "neutral", className = "", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: "gold" | "success" | "warning" | "danger" | "neutral" }) { return <span className={`badge badge-${variant} ${className}`} {...props}/>; }
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`card ${className}`} {...props}/>; }
export function Container({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`container ${className}`} {...props}/>; }
export function SectionHeading({ eyebrow, title, description, centered = false }: { eyebrow: ReactNode; title: ReactNode; description?: ReactNode; centered?: boolean }) { return <div className={`section-heading${centered ? " centered" : ""}`}><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>; }
