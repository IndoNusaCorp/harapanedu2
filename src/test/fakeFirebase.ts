// In-memory Firebase (App/Auth/Firestore/Storage) for tests.
//
// vitest.setup.ts swaps the real "firebase/*" modules for these, so no test can ever reach the real
// project. Unlike blank vi.fn() mocks, this keeps Firebase's behaviour: where/orderBy/limit queries,
// orderBy dropping docs without the field, updateDoc failing on a missing doc, increment/arrayUnion/
// arrayRemove/deleteField, merge writes, batches, realtime onSnapshot and email/password auth.
//
// Tests seed data with `seedFirestore`, read it back with `getFirestoreData`, and sign in with `signInAs`.

type Data = Record<string, unknown>;

// ============================================
// Store
// ============================================
const docs = new Map<string, Data>();
const files = new Map<string, Blob | Uint8Array | ArrayBuffer>();
const accounts = new Map<string, { uid: string; password: string }>();
let autoId = 0;

export const FAKE_BUCKET = "demo-harapanedu.firebasestorage.app";

// ============================================
// App
// ============================================
const apps: { name: string; options: Data }[] = [];

export const appModule = {
  initializeApp: (options: Data = {}, name = "[DEFAULT]") => {
    const app = { name, options };
    apps.push(app);
    return app;
  },
  getApps: () => [...apps],
  getApp: (name = "[DEFAULT]") => {
    const app = apps.find(a => a.name === name);
    if (!app) throw new FakeFirebaseError("app/no-app", `Firebase App named '${name}' does not exist`);
    return app;
  },
};

// ============================================
// Errors
// ============================================
export class FakeFirebaseError extends Error {
  constructor(public code: string, message: string) {
    super(`${message} (${code})`);
    this.name = "FirebaseError";
  }
}

// ============================================
// Firestore: references
// ============================================
const firestoreInstance = { type: "firestore" };

interface DocRef {
  type: "document";
  id: string;
  path: string;
  parent: CollectionRef;
  firestore: typeof firestoreInstance;
}
interface CollectionRef {
  type: "collection";
  id: string;
  path: string;
  firestore: typeof firestoreInstance;
}
type Constraint =
  | { kind: "where"; field: string; op: string; value: unknown }
  | { kind: "orderBy"; field: string; dir: "asc" | "desc" }
  | { kind: "limit"; count: number; last: boolean };
interface Query {
  type: "query";
  collection: CollectionRef;
  constraints: Constraint[];
}

const joinPath = (base: string | undefined, segments: string[]) => {
  const parts = [...(base ? base.split("/") : []), ...segments.flatMap(s => {
    if (typeof s !== "string" || s === "") {
      throw new FakeFirebaseError("invalid-argument", `Invalid path segment: ${JSON.stringify(s)}`);
    }
    return s.split("/");
  })];
  if (parts.some(p => p === "")) throw new FakeFirebaseError("invalid-argument", `Invalid path "${parts.join("/")}"`);
  return parts.join("/");
};

const makeCollection = (path: string): CollectionRef => {
  if (path.split("/").length % 2 !== 1) {
    throw new FakeFirebaseError("invalid-argument", `Invalid collection reference. "${path}" has an even number of segments`);
  }
  return { type: "collection", id: path.split("/").pop()!, path, firestore: firestoreInstance };
};

const makeDoc = (path: string): DocRef => {
  const parts = path.split("/");
  if (parts.length % 2 !== 0) {
    throw new FakeFirebaseError("invalid-argument", `Invalid document reference. "${path}" has an odd number of segments`);
  }
  return {
    type: "document",
    id: parts[parts.length - 1],
    path,
    parent: makeCollection(parts.slice(0, -1).join("/")),
    firestore: firestoreInstance,
  };
};

const basePath = (parent: unknown) =>
  parent && typeof parent === "object" && "path" in parent ? (parent as { path: string }).path : undefined;

function collection(parent: unknown, ...segments: string[]): CollectionRef {
  return makeCollection(joinPath(basePath(parent), segments));
}

function doc(parent: unknown, ...segments: string[]): DocRef {
  if (parent && (parent as CollectionRef).type === "collection" && segments.length === 0) {
    return makeDoc(`${(parent as CollectionRef).path}/auto-${++autoId}`);
  }
  return makeDoc(joinPath(basePath(parent), segments));
}

const where = (field: string, op: string, value: unknown): Constraint => {
  if (value === undefined) throw new FakeFirebaseError("invalid-argument", `Function where() called with invalid data. Unsupported field value: undefined`);
  if ((op === "in" || op === "not-in" || op === "array-contains-any") && (!Array.isArray(value) || value.length === 0 || value.length > 30)) {
    throw new FakeFirebaseError("invalid-argument", `'${op}' filters need a non-empty array of at most 30 values`);
  }
  return { kind: "where", field, op, value };
};
const orderBy = (field: string, dir: "asc" | "desc" = "asc"): Constraint => ({ kind: "orderBy", field, dir });
const limit = (count: number): Constraint => ({ kind: "limit", count, last: false });
const limitToLast = (count: number): Constraint => ({ kind: "limit", count, last: true });

function query(base: CollectionRef | Query, ...constraints: Constraint[]): Query {
  if (base.type === "query") return { ...base, constraints: [...base.constraints, ...constraints] };
  return { type: "query", collection: base, constraints };
}

// ============================================
// Firestore: reading
// ============================================
const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

const getField = (data: Data, field: string): unknown =>
  field.split(".").reduce<unknown>((obj, key) => (obj && typeof obj === "object" ? (obj as Data)[key] : undefined), data);

const compare = (a: unknown, b: unknown) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as number) < (b as number) ? -1 : 1;
};

const matches = (data: Data, c: Extract<Constraint, { kind: "where" }>) => {
  const v = getField(data, c.field);
  switch (c.op) {
    case "==": return v !== undefined && JSON.stringify(v) === JSON.stringify(c.value);
    case "!=": return v !== undefined && v !== null && JSON.stringify(v) !== JSON.stringify(c.value);
    case "<": return v !== undefined && v !== null && compare(v, c.value) < 0;
    case "<=": return v !== undefined && v !== null && compare(v, c.value) <= 0;
    case ">": return v !== undefined && v !== null && compare(v, c.value) > 0;
    case ">=": return v !== undefined && v !== null && compare(v, c.value) >= 0;
    case "in": return (c.value as unknown[]).some(x => JSON.stringify(x) === JSON.stringify(v));
    case "not-in": return v !== undefined && !(c.value as unknown[]).some(x => JSON.stringify(x) === JSON.stringify(v));
    case "array-contains": return Array.isArray(v) && v.some(x => JSON.stringify(x) === JSON.stringify(c.value));
    case "array-contains-any": return Array.isArray(v) && v.some(x => (c.value as unknown[]).some(y => JSON.stringify(x) === JSON.stringify(y)));
    default: throw new FakeFirebaseError("invalid-argument", `Unsupported operator ${c.op}`);
  }
};

const docSnapshot = (ref: DocRef) => {
  const data = docs.get(ref.path);
  return {
    id: ref.id,
    ref,
    metadata: { hasPendingWrites: false, fromCache: false },
    exists: () => data !== undefined,
    data: () => clone(data),
    get: (field: string) => (data ? clone(getField(data, field)) : undefined),
  };
};
type DocSnapshot = ReturnType<typeof docSnapshot>;

const runQuery = (q: CollectionRef | Query): DocSnapshot[] => {
  const col = q.type === "query" ? q.collection : q;
  const constraints = q.type === "query" ? q.constraints : [];
  let rows = [...docs.keys()]
    .filter(path => path.startsWith(`${col.path}/`) && path.split("/").length === col.path.split("/").length + 1)
    .sort()
    .map(path => ({ path, data: docs.get(path)! }));

  for (const c of constraints) if (c.kind === "where") rows = rows.filter(r => matches(r.data, c));

  const orders = constraints.filter((c): c is Extract<Constraint, { kind: "orderBy" }> => c.kind === "orderBy");
  // Firestore leaves out documents that don't have the orderBy field
  rows = rows.filter(r => orders.every(o => getField(r.data, o.field) !== undefined));
  rows.sort((a, b) => {
    for (const o of orders) {
      const diff = compare(getField(a.data, o.field), getField(b.data, o.field));
      if (diff) return o.dir === "desc" ? -diff : diff;
    }
    return 0;
  });

  const lim = constraints.find((c): c is Extract<Constraint, { kind: "limit" }> => c.kind === "limit");
  if (lim) rows = lim.last ? rows.slice(-lim.count) : rows.slice(0, lim.count);
  return rows.map(r => docSnapshot(makeDoc(r.path)));
};

const querySnapshot = (list: DocSnapshot[], changes: { type: "added" | "modified" | "removed"; doc: DocSnapshot }[]) => ({
  docs: list,
  metadata: { hasPendingWrites: false, fromCache: false },
  size: list.length,
  empty: list.length === 0,
  forEach: (cb: (d: DocSnapshot) => void) => list.forEach(cb),
  docChanges: () => changes,
});

async function getDoc(ref: DocRef) {
  return docSnapshot(ref);
}

async function getDocs(q: CollectionRef | Query) {
  const list = runQuery(q);
  return querySnapshot(list, list.map(d => ({ type: "added" as const, doc: d })));
}

// ============================================
// Firestore: writing
// ============================================
type Sentinel =
  | { __op: "increment"; by: number }
  | { __op: "arrayUnion"; values: unknown[] }
  | { __op: "arrayRemove"; values: unknown[] }
  | { __op: "deleteField" };

const increment = (by: number): Sentinel => ({ __op: "increment", by });
const arrayUnion = (...values: unknown[]): Sentinel => ({ __op: "arrayUnion", values });
const arrayRemove = (...values: unknown[]): Sentinel => ({ __op: "arrayRemove", values });
const deleteField = (): Sentinel => ({ __op: "deleteField" });
const isSentinel = (v: unknown): v is Sentinel => !!v && typeof v === "object" && "__op" in v;

const assertNoUndefined = (value: unknown, path = ""): void => {
  if (value === undefined) {
    throw new FakeFirebaseError("invalid-argument", `Function called with invalid data. Unsupported field value: undefined (found in field ${path})`);
  }
  if (value && typeof value === "object" && !isSentinel(value) && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) assertNoUndefined(v, path ? `${path}.${k}` : k);
  }
};

const applySentinel = (current: unknown, value: unknown): unknown => {
  if (!isSentinel(value)) return clone(value);
  switch (value.__op) {
    case "increment": return (typeof current === "number" ? current : 0) + value.by;
    case "arrayUnion": {
      const arr = Array.isArray(current) ? [...current] : [];
      value.values.forEach(v => { if (!arr.some(x => JSON.stringify(x) === JSON.stringify(v))) arr.push(v); });
      return arr;
    }
    case "arrayRemove":
      return (Array.isArray(current) ? current : []).filter(x => !value.values.some(v => JSON.stringify(v) === JSON.stringify(x)));
    case "deleteField": return undefined;
  }
};

const setPath = (target: Data, path: string[], value: unknown) => {
  let obj = target;
  for (const key of path.slice(0, -1)) {
    if (!obj[key] || typeof obj[key] !== "object") obj[key] = {};
    obj = obj[key] as Data;
  }
  const last = path[path.length - 1];
  const next = applySentinel(obj[last], value);
  if (next === undefined) delete obj[last];
  else obj[last] = next;
};

// setDoc / merge writes: nested objects are merged, sentinels resolved
const mergeInto = (target: Data, patch: Data) => {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value) && !isSentinel(value) && !(value instanceof Date)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      mergeInto(target[key] as Data, value as Data);
    } else {
      setPath(target, [key], value);
    }
  }
};

const resolveAll = (data: Data): Data => {
  const out: Data = {};
  mergeInto(out, data);
  return out;
};

function writeDoc(path: string, next: Data | undefined) {
  if (next === undefined) docs.delete(path);
  else docs.set(path, next);
  notify();
}

async function setDoc(ref: DocRef, data: Data, options?: { merge?: boolean }) {
  assertNoUndefined(data);
  const current = docs.get(ref.path);
  if (options?.merge && current) {
    const next = clone(current);
    mergeInto(next, data);
    writeDoc(ref.path, next);
  } else {
    writeDoc(ref.path, resolveAll(data));
  }
}

async function addDoc(col: CollectionRef, data: Data) {
  const ref = doc(col);
  await setDoc(ref, data);
  return ref;
}

async function updateDoc(ref: DocRef, data: Data) {
  assertNoUndefined(data);
  const current = docs.get(ref.path);
  if (!current) throw new FakeFirebaseError("not-found", `No document to update: ${ref.path}`);
  const next = clone(current);
  for (const [key, value] of Object.entries(data)) setPath(next, key.split("."), value);
  writeDoc(ref.path, next);
}

async function deleteDoc(ref: DocRef) {
  writeDoc(ref.path, undefined);
}

function writeBatch() {
  const ops: (() => Promise<void>)[] = [];
  let committed = false;
  const batch = {
    set: (ref: DocRef, data: Data, options?: { merge?: boolean }) => { ops.push(() => setDoc(ref, data, options)); return batch; },
    update: (ref: DocRef, data: Data) => { ops.push(() => updateDoc(ref, data)); return batch; },
    delete: (ref: DocRef) => { ops.push(() => deleteDoc(ref)); return batch; },
    commit: async () => {
      if (committed) throw new FakeFirebaseError("failed-precondition", "A write batch can no longer be used after commit() has been called.");
      if (ops.length > 500) throw new FakeFirebaseError("invalid-argument", "Maximum 500 writes allowed per request");
      committed = true;
      for (const op of ops) await op();
    },
  };
  return batch;
}

// ============================================
// Firestore: realtime listeners
// ============================================
type Listener = {
  target: DocRef | CollectionRef | Query;
  next: (snap: unknown) => void;
  error?: (e: unknown) => void;
  last: Map<string, string> | string | undefined;
};
const listeners = new Set<Listener>();

const serialize = (list: DocSnapshot[]) => new Map(list.map(d => [d.ref.path, JSON.stringify(d.data())]));

function emit(l: Listener) {
  if (l.target.type === "document") {
    const snap = docSnapshot(l.target);
    const key = JSON.stringify(snap.data() ?? null);
    if (key === l.last) return;
    l.last = key;
    l.next(snap);
    return;
  }
  const list = runQuery(l.target);
  const now = serialize(list);
  const prev = (l.last as Map<string, string> | undefined) ?? new Map<string, string>();
  const isFirst = l.last === undefined;
  if (!isFirst && now.size === prev.size && [...now].every(([k, v]) => prev.get(k) === v) && [...now.keys()].join() === [...prev.keys()].join()) return;
  const changes = [
    ...list.filter(d => !prev.has(d.ref.path)).map(d => ({ type: "added" as const, doc: d })),
    ...list.filter(d => prev.has(d.ref.path) && prev.get(d.ref.path) !== now.get(d.ref.path)).map(d => ({ type: "modified" as const, doc: d })),
    ...[...prev.keys()].filter(p => !now.has(p)).map(p => ({ type: "removed" as const, doc: docSnapshot(makeDoc(p)) })),
  ];
  l.last = now;
  l.next(querySnapshot(list, changes));
}

// Like the real SDK, listeners hear about writes asynchronously
function notify() {
  for (const l of [...listeners]) queueMicrotask(() => { if (listeners.has(l)) emit(l); });
}

function onSnapshot(
  target: DocRef | CollectionRef | Query,
  nextOrObserver: ((snap: never) => void) | { next: (snap: never) => void; error?: (e: unknown) => void },
  error?: (e: unknown) => void,
) {
  const observer = typeof nextOrObserver === "function" ? { next: nextOrObserver, error } : nextOrObserver;
  const l: Listener = { target, next: observer.next as (s: unknown) => void, error: observer.error, last: undefined };
  listeners.add(l);
  queueMicrotask(() => { if (listeners.has(l)) emit(l); });
  return () => { listeners.delete(l); };
}

export const firestoreModule = {
  getFirestore: () => firestoreInstance,
  collection, doc, query, where, orderBy, limit, limitToLast,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, onSnapshot,
  increment, arrayUnion, arrayRemove, deleteField,
  Firestore: class {},
};

// ============================================
// Auth
// ============================================
export interface FakeUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdToken: () => Promise<string>;
}
const makeUser = (uid: string, email: string | null = null, displayName: string | null = null): FakeUser => ({
  uid,
  email,
  displayName,
  getIdToken: async () => `token-${uid}`,
});

const authListeners = new Set<(user: FakeUser | null) => void>();
const authInstance: { currentUser: FakeUser | null } = { currentUser: null };

function setCurrentUser(user: FakeUser | null) {
  authInstance.currentUser = user;
  for (const cb of [...authListeners]) queueMicrotask(() => { if (authListeners.has(cb)) cb(user); });
}

export const authModule = {
  getAuth: () => authInstance,
  onAuthStateChanged: (_auth: unknown, cb: (user: FakeUser | null) => void) => {
    authListeners.add(cb);
    queueMicrotask(() => { if (authListeners.has(cb)) cb(authInstance.currentUser); });
    return () => { authListeners.delete(cb); };
  },
  signInWithEmailAndPassword: async (_auth: unknown, email: string, password: string) => {
    const account = accounts.get(email.toLowerCase());
    if (!account || account.password !== password) {
      throw new FakeFirebaseError("auth/invalid-credential", "Firebase: Error (auth/invalid-credential).");
    }
    const user = makeUser(account.uid, email);
    setCurrentUser(user);
    return { user };
  },
  createUserWithEmailAndPassword: async (_auth: unknown, email: string, password: string) => {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new FakeFirebaseError("auth/invalid-email", "Firebase: Error (auth/invalid-email).");
    if (accounts.has(email.toLowerCase())) throw new FakeFirebaseError("auth/email-already-in-use", "Firebase: Error (auth/email-already-in-use).");
    if (password.length < 6) throw new FakeFirebaseError("auth/weak-password", "Firebase: Password should be at least 6 characters (auth/weak-password).");
    const uid = `uid-${++autoId}`;
    accounts.set(email.toLowerCase(), { uid, password });
    const user = makeUser(uid, email);
    setCurrentUser(user);
    return { user };
  },
  signOut: async () => setCurrentUser(null),
};

// ============================================
// Storage
// ============================================
const storageInstance = { type: "storage" };
const downloadUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${FAKE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
const pathFromUrl = (pathOrUrl: string) => {
  const m = pathOrUrl.match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : pathOrUrl;
};

export const storageModule = {
  getStorage: () => storageInstance,
  ref: (_storage: unknown, pathOrUrl = "") => ({ fullPath: pathFromUrl(pathOrUrl), name: pathFromUrl(pathOrUrl).split("/").pop() }),
  uploadBytes: async (ref: { fullPath: string }, data: Blob | Uint8Array | ArrayBuffer) => {
    files.set(ref.fullPath, data);
    return { ref, metadata: { fullPath: ref.fullPath } };
  },
  getDownloadURL: async (ref: { fullPath: string }) => {
    if (!files.has(ref.fullPath)) throw new FakeFirebaseError("storage/object-not-found", `Object '${ref.fullPath}' does not exist.`);
    return downloadUrl(ref.fullPath);
  },
  deleteObject: async (ref: { fullPath: string }) => {
    if (!files.delete(ref.fullPath)) throw new FakeFirebaseError("storage/object-not-found", `Object '${ref.fullPath}' does not exist.`);
  },
};

// ============================================
// Test helpers
// ============================================

/** Replace the whole database. Keys are collection paths ("users", "meetings/m1/messages"), values map doc id → data. */
export function seedFirestore(data: Record<string, Record<string, Data>>) {
  for (const [col, rows] of Object.entries(data)) {
    for (const [id, row] of Object.entries(rows)) docs.set(`${col}/${id}`, clone(row));
  }
  notify();
}

/** Every document in a collection, keyed by id. */
export function getFirestoreData(collectionPath: string): Record<string, Data> {
  return Object.fromEntries(runQuery(makeCollection(collectionPath)).map(d => [d.id, d.data()!]));
}

export function getFirestoreDoc(path: string): Data | undefined {
  return clone(docs.get(path));
}

/** Put a file in Storage and return its download URL. */
export function seedStorageFile(path: string, data: Blob | Uint8Array | ArrayBuffer = new Uint8Array()) {
  files.set(path, data);
  return downloadUrl(path);
}

export const storageFileExists = (path: string) => files.has(path);

/** Register an email/password account (for sign-in tests). */
export function seedAccount(email: string, password: string, uid: string) {
  accounts.set(email.toLowerCase(), { uid, password });
}

/** Sign a user in (or out with `null`), notifying onAuthStateChanged listeners. */
export function signInAs(uid: string | null, email: string | null = null, displayName: string | null = null) {
  setCurrentUser(uid ? makeUser(uid, email ?? `${uid}@test.local`, displayName) : null);
}

export function resetFirebase() {
  docs.clear();
  files.clear();
  accounts.clear();
  listeners.clear();
  authListeners.clear();
  authInstance.currentUser = null;
  autoId = 0;
}
