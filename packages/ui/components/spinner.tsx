import { Loader2Icon } from "lucide-react";

import { cn } from "@tsu-stack/ui/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"output">) {
  return (
    <output
      data-slot="spinner"
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("inline-flex size-4", className)}
      {...props}
    >
      <Loader2Icon aria-hidden className="size-full animate-spin" />
    </output>
  );
}

export { Spinner };
