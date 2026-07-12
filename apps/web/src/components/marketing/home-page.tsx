import { CallToAction } from "@/components/marketing/call-to-action";
import { HeroSection } from "@/components/marketing/hero-section";
import { IntegrationsSection } from "@/components/marketing/integrations-section";

export function HomePage() {
  return (
    <>
      <HeroSection />
      <IntegrationsSection />
      <CallToAction />
    </>
  );
}
