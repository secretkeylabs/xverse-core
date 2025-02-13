type JSONPrimitive = string | number | boolean | null | undefined;

type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | {
      [key: string]: JSONValue;
    };

export type JSONCompatible<T> = T extends JSONValue
  ? T
  : T extends Array<infer U>
  ? U extends JSONCompatible<U>
    ? T
    : never
  : T extends Record<any, unknown>
  ? T extends {
      [k in keyof T]: JSONCompatible<T[k]>;
    }
    ? T
    : never
  : never;
