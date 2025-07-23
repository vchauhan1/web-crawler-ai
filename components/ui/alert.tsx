import * as React from "react"
import { cn } from "@/lib/utils"

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative w-full rounded-lg border border-red-200 bg-red-50 p-4 dark:bg-red-900/20 dark:border-red-800", className)} {...props} />
))
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-red-800 dark:text-red-200", className)} {...props} />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription } 