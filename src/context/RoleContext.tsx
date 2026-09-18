"use client";

import React, { createContext, useContext, useState, useMemo } from "react";

type Role = "teacher" | "student";

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  toggleRole: () => void;
  classLevel: number | null;
  setClassLevel: (level: number | null) => void;
  isKidsMode: boolean;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("student");
  const [classLevel, setClassLevel] = useState<number | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const isKidsMode = useMemo(() => {
    return role === "student" && classLevel !== null && classLevel >= 1 && classLevel <= 6;
  }, [role, classLevel]);

  const toggleRole = () => {
    setRole((prev) => (prev === "student" ? "teacher" : "student"));
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, toggleRole, classLevel, setClassLevel, isKidsMode, isSidebarOpen, setSidebarOpen, toggleSidebar }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
