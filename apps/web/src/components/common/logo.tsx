import type React from "react";

import { cn } from "@tsu-stack/ui/lib/utils";

import { appConfig } from "@/config/app.config";

export function LogoIcon(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      width="378"
      height="387"
      viewBox="0 0 378 387"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M124.73 19.85H284.11L166.94 247.81H7.56L124.73 19.85Z" fill="#EC4E02" />
      <path
        d="M131.71 268.94L86.33 357.23H253.27L370.44 129.27H247.23L175.44 268.94H131.71Z"
        fill="#93370A"
      />
    </svg>
  );
}

export function LogoWordmark({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-2 text-lg font-semibold", className)} {...props}>
      <svg
        className="relative top-0.5 size-8"
        width="378"
        height="387"
        viewBox="0 0 378 387"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M124.73 19.85H284.11L166.94 247.81H7.56L124.73 19.85Z" fill="#EC4E02" />
        <path
          d="M131.71 268.94L86.33 357.23H253.27L370.44 129.27H247.23L175.44 268.94H131.71Z"
          fill="#93370A"
        />
      </svg>
      {appConfig.site.shortName}
    </div>
  );
}
