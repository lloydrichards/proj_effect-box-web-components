import { adoptStyles, type LitElement, unsafeCSS } from "lit";
import style from "../styles/tailwind.global.css?inline";

declare global {
  // biome-ignore lint/suspicious/noExplicitAny: Required for mixin pattern compatibility
  export type LitMixin<T = unknown> = new (...args: any[]) => T & LitElement;
}

const stylesheet = unsafeCSS(style);

export const TW = <T extends LitMixin>(superClass: T): T =>
  class extends superClass {
    connectedCallback() {
      super.connectedCallback();
      if (this.shadowRoot) adoptStyles(this.shadowRoot, [stylesheet]);
    }
  };
