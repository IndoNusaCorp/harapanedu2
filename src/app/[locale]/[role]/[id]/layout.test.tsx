import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { seedFirestore, signInAs } from "@/test/fakeFirebase";
import { router, setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { useRole } from "@/context/RoleContext";
import RoleLayout from "./layout";

const live = await vi.hoisted(async () => (await import("@/test/voice")).fakeLive());
vi.mock("@google/genai", () => live.module);

function RoleProbe() {
  const { role, classLevel } = useRole();
  return <p data-testid="probe">{role} {String(classLevel)}</p>;
}

beforeEach(() => {
  seedFirestore({
    users: {
      t1: { first_name: "Sari", role_id: "2" },
      s1: { first_name: "Ani", role_id: "1", class: 3 },
      s2: { first_name: "Budi", role_id: "1", class: 8 },
    },
  });
});

const visit = (role: string, id: string) => {
  setNavigation({ pathname: `/id/${role}/${id}`, params: { role, id } });
  return renderWithProviders(<RoleLayout><RoleProbe /></RoleLayout>);
};

describe("Role layout", () => {
  it("sends unknown roles back to the landing page", async () => {
    signInAs("s1");
    await visit("admin", "s1");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("probe")).toBeNull();
  });

  it("sends logged-out visitors back to the landing page", async () => {
    await visit("pelajar", "s1");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("probe")).toBeNull();
  });

  it("does not let a user open someone else's pages", async () => {
    signInAs("s2");
    await visit("pelajar", "s1");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("probe")).toBeNull();
  });

  it("shows a teacher's pages with the teacher sidebar", async () => {
    signInAs("t1");
    await visit("pengajar", "t1");
    expect(await screen.findByTestId("probe")).toHaveTextContent("teacher null");
    expect(screen.getByRole("link", { name: "Pekerjaan Saya" })).toHaveAttribute("href", "/pengajar/t1/my-work");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("switches elementary students to kids mode", async () => {
    signInAs("s1");
    await visit("pelajar", "s1");
    expect(await screen.findByTestId("probe")).toHaveTextContent("student 3");
    expect(screen.getByRole("link", { name: /Ayo Bermain/ })).toHaveAttribute("href", "/pelajar/s1/games");
  });

  it("keeps older students in the regular layout", async () => {
    signInAs("s2");
    await visit("pelajar", "s2");
    expect(await screen.findByTestId("probe")).toHaveTextContent("student 8");
    expect(screen.queryByRole("link", { name: /Ayo Bermain/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Kelas Saya" })).toBeInTheDocument();
  });
});
