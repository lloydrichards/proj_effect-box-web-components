import type { LitElement } from "lit";

declare global {
  // biome-ignore lint/suspicious/noExplicitAny: Required for mixin pattern compatibility
  export type LitMixin<T = unknown> = new (...args: any[]) => T & LitElement;
}
export declare const TW: <T extends LitMixin>(superClass: T) => T;
