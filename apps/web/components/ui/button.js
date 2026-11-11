import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // One primary action per view — the gradient is the brand's CTA colour.
        primary: "bg-nu-primary text-white shadow-sm hover:opacity-90 focus-visible:ring-[#d42f7b]",
        secondary: "border border-gray-300 bg-white text-nu-navy hover:bg-gray-50 focus-visible:ring-nu-purple",
        dark: "bg-nu-lapis text-white shadow-sm hover:bg-nu-navy focus-visible:ring-nu-lapis",
        danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-500",
        ghost: "text-nu-muted-teal hover:bg-gray-100 focus-visible:ring-gray-300",
        link: "text-nu-purple underline-offset-4 hover:underline focus-visible:ring-nu-purple",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({ className, variant, size, type = "button", ...props }) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
