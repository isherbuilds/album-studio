import { useRouterState } from "@tanstack/react-router";

import { cn } from "@tsu-stack/ui/lib/utils";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/navigation/navbar";

export function RootLayout({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isAuthenticatedSurface = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId.includes("(auth)"))
  });

  if (isAuthenticatedSurface) {
    return children;
  }

  return (
    <>
      <div className={cn("flex min-h-screen flex-col", className)}>
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
      <Footer className="lg:mt-12" />
    </>
  );
}
