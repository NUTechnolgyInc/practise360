import { cn } from "@/lib/cn";

export function Table({ className, ...props }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left text-xs text-nu-dark-teal", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }) {
  return <thead className={cn("border-b bg-gray-50 text-[10px] font-bold uppercase text-gray-500", className)} {...props} />;
}
export function TBody({ className, ...props }) {
  return <tbody className={cn("divide-y divide-gray-100", className)} {...props} />;
}
export function TR({ className, ...props }) {
  return <tr className={cn("hover:bg-gray-50", className)} {...props} />;
}
export function TH({ className, ...props }) {
  return <th scope="col" className={cn("p-3", className)} {...props} />;
}
export function TD({ className, ...props }) {
  return <td className={cn("p-3", className)} {...props} />;
}
