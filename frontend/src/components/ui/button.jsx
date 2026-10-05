import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-pill text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-coral-strong text-white hover:bg-coral-strong/90",
        destructive: "bg-danger text-white hover:bg-danger/90",
        outline: "border border-border bg-surface hover:bg-canvas hover:text-ink",
        secondary: "bg-canvas text-ink hover:bg-border/50",
        ghost: "hover:bg-canvas hover:text-ink",
        link: "text-coral-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[44px] px-6 py-2",
        xs: "h-7 rounded-pill px-3 text-xs",
        sm: "h-9 rounded-pill px-4 text-xs",
        lg: "h-12 rounded-pill px-8 text-base",
        icon: "h-[44px] w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
