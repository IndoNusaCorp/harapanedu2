import { describe, it, expect, vi } from "vitest";
import { getApps } from "firebase/app";

describe("firebase", () => {
  it("initializes the app once from the NEXT_PUBLIC_FIREBASE_* env", async () => {
    const { app } = await import("./firebase");
    expect(app.options).toEqual({
      apiKey: "test-api-key",
      authDomain: "demo-harapanedu.firebaseapp.com",
      projectId: "demo-harapanedu",
      storageBucket: "demo-harapanedu.firebasestorage.app",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:test",
    });

    // Re-evaluating the module (hot reload) must reuse the app instead of initializing a second one
    vi.resetModules();
    const again = await import("./firebase");
    expect(getApps()).toHaveLength(1);
    expect(again.app).toBe(app);
  });
});
