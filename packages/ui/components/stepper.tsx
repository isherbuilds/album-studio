import { cn } from "@tsu-stack/ui/lib/utils";

type StepStatus = "complete" | "current" | "upcoming" | "invalid";

export type StepperStep = {
  id: string;
  ariaLabel: string;
  label: string;
  status: StepStatus;
};

/**
 * A controlled, presentational segmented progress rail. One thin segment per
 * step; the fill sweeps left-to-right (GPU-only `scaleX`) as steps complete, so
 * it scales cleanly to any number of steps and to mobile — where numbered circles
 * would cramp. Monotone by construction: the only color is `--destructive` on a
 * segment whose step carries a blocking issue. The parent owns navigation and
 * passes each step's `status`; segments are click-to-jump when `isStepSelectable`
 * allows. The "Step N of M" / current-step caption is rendered by the parent so
 * this stays i18n-agnostic.
 */
export function Stepper({
  className,
  isStepSelectable,
  onStepSelect,
  steps,
  ...props
}: React.ComponentProps<"ol"> & {
  steps: StepperStep[];
  onStepSelect?: (index: number) => void;
  isStepSelectable?: (index: number) => boolean;
}) {
  return (
    <ol
      data-slot="stepper"
      className={cn("flex w-full items-center gap-1.5", className)}
      {...props}
    >
      {steps.map((step, index) => {
        const selectable = onStepSelect !== undefined && (isStepSelectable?.(index) ?? true);
        const invalid = step.status === "invalid";
        // "Reached" segments (done, or you're on it) read as progress made.
        const filled = step.status === "complete" || step.status === "current";
        return (
          <li
            key={step.id}
            data-slot="stepper-item"
            data-status={step.status}
            className="min-w-0 flex-1"
          >
            <button
              type="button"
              disabled={!selectable}
              onClick={selectable ? () => onStepSelect?.(index) : undefined}
              aria-label={step.ariaLabel}
              aria-current={step.status === "current" ? "step" : undefined}
              title={step.label}
              className={cn(
                // Thin visible bar, taller padded hit area so it clears the 24px min target.
                "group/seg block w-full rounded-full py-2.5 outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selectable ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span
                className={cn(
                  "relative block h-1.5 overflow-hidden rounded-full bg-border",
                  invalid && "bg-destructive/25",
                  selectable && !filled && !invalid && "group-hover/seg:bg-foreground/25"
                )}
              >
                <span
                  className={cn(
                    "block h-full origin-left rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none",
                    invalid ? "bg-destructive" : "bg-primary",
                    filled || invalid ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
