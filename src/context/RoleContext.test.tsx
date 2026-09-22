import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { RoleProvider, useRole } from "./RoleContext";

const setup = () => renderHook(() => useRole(), { wrapper: RoleProvider });

describe("RoleContext", () => {
  it("starts as a student with the sidebar closed", () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ role: "student", classLevel: null, isKidsMode: false, isSidebarOpen: false });
  });

  it("switches role", () => {
    const { result } = setup();
    act(() => result.current.toggleRole());
    expect(result.current.role).toBe("teacher");
    act(() => result.current.toggleRole());
    expect(result.current.role).toBe("student");
  });

  it.each([
    [1, true],
    [6, true],
    [7, false],
    [0, false],
    [null, false],
  ])("kids mode for a student in class %s is %s", (level, expected) => {
    const { result } = setup();
    act(() => result.current.setClassLevel(level));
    expect(result.current.isKidsMode).toBe(expected);
  });

  it("never uses kids mode for teachers", () => {
    const { result } = setup();
    act(() => {
      result.current.setClassLevel(3);
      result.current.setRole("teacher");
    });
    expect(result.current.isKidsMode).toBe(false);
  });

  it("toggles the sidebar", () => {
    const { result } = setup();
    act(() => result.current.toggleSidebar());
    expect(result.current.isSidebarOpen).toBe(true);
    act(() => result.current.setSidebarOpen(false));
    expect(result.current.isSidebarOpen).toBe(false);
  });

  it("throws a clear error outside the provider", () => {
    expect(() => renderHook(() => useRole())).toThrow("useRole must be used within a RoleProvider");
  });
});
