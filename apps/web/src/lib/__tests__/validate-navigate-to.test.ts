import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";

import { validateNavigateTo } from "@tsu-stack/i18n/tanstack-start/lib/validate-navigate-to";

const rootRoute = createRootRoute();
const localeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/{-$locale}"
});
const guestRoute = createRoute({ getParentRoute: () => localeRoute, id: "(guest)" });
const signInRoute = createRoute({ getParentRoute: () => guestRoute, path: "/sign-in" });
const dynamicRoute = createRoute({ getParentRoute: () => localeRoute, path: "/$slug" });
const splatRoute = createRoute({ getParentRoute: () => localeRoute, path: "/files/$" });
const productRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "/org/$organizationSlug/catalog/$productSlug"
});
const routeTree = rootRoute.addChildren([
  localeRoute.addChildren([
    dynamicRoute,
    guestRoute.addChildren([signInRoute]),
    productRoute,
    splatRoute
  ])
]);
createRouter({ routeTree });

const validateProtectedRoute = (to: string) =>
  validateNavigateTo({
    fallbackTo: "/",
    routeTree,
    shouldIncludeRoute: (route) => !route.id.includes("(guest)"),
    to
  });

describe("validateNavigateTo", () => {
  it("preserves dynamic protected-route parameters and search", () => {
    expect(validateProtectedRoute("/org/demo-studio/catalog/wedding-album?from=sign-in")).toBe(
      "/org/demo-studio/catalog/wedding-album?from=sign-in"
    );
  });

  it("rejects unknown routes", () => {
    expect(validateProtectedRoute("/org/demo-studio/catalog/wedding-album/unknown")).toBe("/");
  });

  it("prefers a literal route over a matching dynamic route", () => {
    expect(validateProtectedRoute("/sign-in")).toBe("/");
  });

  it("accepts paths handled by a splat route", () => {
    expect(validateProtectedRoute("/files/albums/2026")).toBe("/files/albums/2026");
  });
});
