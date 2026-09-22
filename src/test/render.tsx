import React, { useEffect, useState } from "react";
import { act, render, renderHook, screen, waitFor, type RenderOptions, type RenderResult } from "@testing-library/react";
import { expect } from "vitest";
import { I18nProviderClient } from "@/components/translate/client";
import { RoleProvider, useRole } from "@/context/RoleContext";
import id from "@/components/translate/id";
import en from "@/components/translate/en";
import { NavigationProvider } from "./navigation";

export { id as idDict, en as enDict };

interface Options extends Omit<RenderOptions, "wrapper"> {
  locale?: "id" | "en";
  role?: "teacher" | "student";
  classLevel?: number | null;
}

// Holds back the first render until RoleContext has the requested role/class level, so components
// never see the default role first. Later changes (e.g. a component syncing the role from Firestore) pass through.
function RoleSetter({ role, classLevel, children }: { role: "teacher" | "student"; classLevel: number | null; children: React.ReactNode }) {
  const ctx = useRole();
  const [ready, setReady] = useState(() => ctx.role === role && ctx.classLevel === classLevel);
  useEffect(() => {
    if (ready) return;
    if (ctx.role === role && ctx.classLevel === classLevel) setReady(true);
    else {
      ctx.setRole(role);
      ctx.setClassLevel(classLevel);
    }
  }, [ready, ctx, role, classLevel]);
  return ready ? <>{children}</> : null;
}

export function Providers({ locale = "id", role = "student", classLevel = null, children }: Omit<Options, keyof RenderOptions> & { children: React.ReactNode }) {
  return (
    <NavigationProvider locale={locale}>
      <I18nProviderClient locale={locale} fallback={<span data-testid="i18n-loading" />}>
        <RoleProvider>
          <RoleSetter role={role} classLevel={classLevel}>{children}</RoleSetter>
        </RoleProvider>
      </I18nProviderClient>
    </NavigationProvider>
  );
}

/**
 * Render inside the real App Router contexts, translation dictionary and RoleContext,
 * then wait for the dictionary to load.
 * The provider suspends while loading, and React 19 only resumes suspended work inside an awaited act().
 */
export async function renderWithProviders(ui: React.ReactElement, { locale, role, classLevel, ...options }: Options = {}) {
  let result!: RenderResult;
  await act(async () => {
    result = render(ui, {
      ...options,
      wrapper: ({ children }) => <Providers locale={locale} role={role} classLevel={classLevel}>{children}</Providers>,
    });
  });
  await waitFor(() => expect(screen.queryByTestId("i18n-loading")).toBeNull());
  return result;
}

/** renderHook inside the same providers; resolves once the hook has rendered. */
export async function renderHookWithProviders<T>(hook: () => T, { locale, role, classLevel }: Omit<Options, keyof RenderOptions> = {}) {
  let result!: ReturnType<typeof renderHook<T, unknown>>;
  await act(async () => {
    result = renderHook(hook, {
      wrapper: ({ children }) => <Providers locale={locale} role={role} classLevel={classLevel}>{children}</Providers>,
    });
  });
  await waitFor(() => expect(result.result.current).toBeDefined());
  return result;
}
