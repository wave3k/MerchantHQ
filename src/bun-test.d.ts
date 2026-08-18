declare module "bun:test" {
  export const describe: (
    label: string,
    callback: () => void | Promise<void>,
  ) => void;
  export const test: (
    label: string,
    callback: () => void | Promise<void>,
  ) => void;
  export const expect: (value: unknown) => {
    toBe: (expected: unknown) => void;
  };
}
