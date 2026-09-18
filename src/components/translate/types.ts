import type id from "./id";

// Same nested keys as the Indonesian dictionary, with any string as the value.
// en.ts uses `satisfies LocaleShape`, so a missing or misplaced key is a type error.
type Shape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]>;
};

export type LocaleShape = Shape<typeof id>;
