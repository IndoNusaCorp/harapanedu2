"use client";

import { connecttoauth } from "@/lib/firebase";

// fetch ke API AI dengan Firebase ID token, supaya server tahu siapa yang login
export async function aiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await connecttoauth.currentUser?.getIdToken();
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}
