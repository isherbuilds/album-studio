import { useHydrated } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { m } from "@tsu-stack/i18n/messages";
import { type ButtonProps } from "@tsu-stack/ui/components/button";
import { Button } from "@tsu-stack/ui/components/button";
export { ThemeProvider } from "next-themes";

type ThemeSwitcherProps = {
  className?: string;
} & ButtonProps;

export function ThemeSwitcher({ variant = "ghost", size = "icon", className }: ThemeSwitcherProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isHydrated = useHydrated();
  const nextTheme = isHydrated && resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => setTheme(nextTheme)}
      aria-label={
        nextTheme === "light"
          ? m.preferences__switch_to_light_theme()
          : m.preferences__switch_to_dark_theme()
      }
      className={className}
    >
      <Sun
        className="absolute scale-100 rotate-0 dark:scale-0 dark:rotate-90"
        size={18}
        strokeWidth={2}
      />
      <Moon
        className="absolute scale-0 rotate-90 dark:scale-100 dark:rotate-0"
        size={18}
        strokeWidth={2}
      />
    </Button>
  );
}
