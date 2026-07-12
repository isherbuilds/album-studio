import { Container } from "@/components/common/container";
import Content from "@/components/legal/privacy-policy-content.mdx";

export function PrivacyPolicyPage() {
  return (
    <Container className="prose not-dark:prose-invert">
      <Content />
    </Container>
  );
}
