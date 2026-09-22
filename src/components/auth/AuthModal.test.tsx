import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc, seedAccount, seedFirestore } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { AuthModal } from "./AuthModal";

const type = (placeholder: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
const submit = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

let onSuccess: Mock<(roleId: string, userId: string) => void>;
let onClose: Mock<() => void>;
const open = () => renderWithProviders(<AuthModal isOpen onClose={onClose} onSuccess={onSuccess} />);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  onSuccess = vi.fn<(roleId: string, userId: string) => void>();
  onClose = vi.fn<() => void>();
});

describe("AuthModal: sign in", () => {
  it("renders nothing when closed", async () => {
    await renderWithProviders(<AuthModal isOpen={false} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.queryByText("Selamat Datang Kembali")).toBeNull();
  });

  it("signs in and reports the role stored in Firestore", async () => {
    seedAccount("bu.sari@sekolah.id", "rahasia123", "t1");
    seedFirestore({ users: { t1: { role_id: "2" } } });
    await open();

    type("nama@contoh.com", "bu.sari@sekolah.id");
    type("••••••••", "rahasia123");
    submit("Masuk");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("2", "t1"));
    expect(onClose).toHaveBeenCalled();
  });

  it("treats an account without a profile as a student", async () => {
    seedAccount("baru@sekolah.id", "rahasia123", "u9");
    await open();
    type("nama@contoh.com", "baru@sekolah.id");
    type("••••••••", "rahasia123");
    submit("Masuk");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("1", "u9"));
  });

  it("shows a friendly message for a wrong password and stays open", async () => {
    seedAccount("ani@sekolah.id", "benar123", "s1");
    await open();
    type("nama@contoh.com", "ani@sekolah.id");
    type("••••••••", "salah");
    submit("Masuk");

    expect(await screen.findByText("Email atau kata sandi salah.")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("AuthModal: register", () => {
  const toRegister = async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    expect(screen.getByRole("heading", { name: "Buat Akun" })).toBeInTheDocument();
  };

  it("creates a student profile with the chosen class", async () => {
    await toRegister();
    type("Budi", "Ani");
    type("Santoso", "Putri");
    type("nama@contoh.com", "ani@sekolah.id");
    type("••••••••", "rahasia123");
    fireEvent.change(screen.getByDisplayValue("Kelas 1 SD"), { target: { value: "4" } });
    submit("Buat Akun");

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const [roleId, uid] = onSuccess.mock.calls[0];
    expect(roleId).toBe("1");
    expect(getFirestoreDoc(`users/${uid}`)).toMatchObject({
      user_id: uid, first_name: "Ani", middle_name: null, last_name: "Putri", username: null, role_id: "1", class: 4,
    });
  });

  it("creates a teacher profile without a class", async () => {
    await toRegister();
    type("Budi", "Sari");
    type("nama@contoh.com", "sari@sekolah.id");
    type("••••••••", "rahasia123");
    fireEvent.change(screen.getByDisplayValue("Pelajar"), { target: { value: "2" } });
    expect(screen.queryByDisplayValue("Kelas 1 SD")).toBeNull();
    submit("Buat Akun");

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(getFirestoreDoc(`users/${onSuccess.mock.calls[0][1]}`)).toMatchObject({ role_id: "2", class: null });
  });

  it("only offers elementary classes for now", async () => {
    await toRegister();
    const options = screen.getAllByRole("option").filter(o => /^Kelas/.test(o.textContent || ""));
    expect(options.filter(o => !(o as HTMLOptionElement).disabled).map(o => o.textContent)).toEqual([
      "Kelas 1 SD", "Kelas 2 SD", "Kelas 3 SD", "Kelas 4 SD", "Kelas 5 SD", "Kelas 6 SD",
    ]);
    expect(screen.getByRole("option", { name: "Kelas 1 SMP (tidak tersedia)" })).toBeDisabled();
  });

  it.each([
    ["already registered", "dipakai@sekolah.id", "rahasia123", "Email ini sudah terdaftar."],
    ["weak password", "baru@sekolah.id", "123", "Kata sandi minimal 6 karakter."],
  ])("explains a %s", async (_case, email, password, message) => {
    seedAccount("dipakai@sekolah.id", "apapun1", "x");
    await toRegister();
    type("Budi", "Ani");
    type("nama@contoh.com", email);
    type("••••••••", password);
    submit("Buat Akun");

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
