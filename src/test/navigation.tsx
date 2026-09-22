import React from "react";
import { vi } from "vitest";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathParamsContext, PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

// Mounts the real App Router contexts, so the real "next/navigation" hooks work in tests — both in
// app code and in next-international (which require()s next/navigation, out of reach of vi.mock).
// Tests set the current URL with `setNavigation` and check navigation on `router`.

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  hmrRefresh: vi.fn(),
  prefetch: vi.fn(),
};

const initial = () => ({
  pathname: "/",
  params: {} as Record<string, string>,
  search: "",
});
let state = initial();

export function setNavigation(next: { pathname?: string; params?: Record<string, string>; search?: string }) {
  state = { ...state, ...next };
}

export function resetNavigation() {
  state = initial();
}

export function NavigationProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  const params = { locale, ...state.params };
  return (
    <AppRouterContext.Provider value={router as never}>
      <PathnameContext.Provider value={state.pathname}>
        <SearchParamsContext.Provider value={new URLSearchParams(state.search)}>
          <PathParamsContext.Provider value={params}>{children}</PathParamsContext.Provider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}
