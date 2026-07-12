import { Container } from "@/components/common/container";
import Content from "@/components/legal/terms-of-service-content.mdx";

export function TermsOfServicePage() {
  return (
    <Container className="prose not-dark:prose-invert">
      <Content />
    </Container>
  );
}
