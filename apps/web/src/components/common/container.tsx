import { cn } from "@tsu-stack/ui/lib/utils";

export function Container({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("container mx-auto p-4 sm:p-6", className)}>{children}</div>;
}
