import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { TW } from "../../shared/tailwindMixin";

@customElement("ui-card")
export class Card extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="card"
        class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-card-header")
export class CardHeader extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="card-header"
        class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-[*[data-slot=card-action]]:grid-cols-[1fr_auto] [.border-b]:pb-6"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-card-title")
export class CardTitle extends TW(LitElement) {
  override render() {
    return html`
      <div data-slot="card-title" class="leading-none font-semibold">
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-card-description")
export class CardDescription extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="card-description"
        class="text-muted-foreground text-sm"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-card-action")
export class CardAction extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="card-action"
        class="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-card-content")
export class CardContent extends TW(LitElement) {
  override render() {
    return html`
      <div data-slot="card-content" class="px-6">
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-card-footer")
export class CardFooter extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="card-footer"
        class="flex items-center px-6 [.border-t]:pt-6"
      >
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ui-card": Card;
    "ui-card-header": CardHeader;
    "ui-card-title": CardTitle;
    "ui-card-description": CardDescription;
    "ui-card-action": CardAction;
    "ui-card-content": CardContent;
    "ui-card-footer": CardFooter;
  }
}
