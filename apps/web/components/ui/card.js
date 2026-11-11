import { cn } from "@/lib/cn";

export function Card({ className, interactive = false, ...props }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-gray-200 bg-white p-6 shadow-sm",
        interactive && "cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, description, actions, className }) {
  return (
    <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-nu-muted-teal">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function CardFooter({ className, ...props }) {
  return <div className={cn("mt-4 flex items-center justify-between border-t border-gray-100 pt-4", className)} {...props} />;
}
