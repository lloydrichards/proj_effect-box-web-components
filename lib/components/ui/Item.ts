import { cva, type VariantProps } from "class-variance-authority";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TW } from "../../shared/tailwindMixin";

export const itemVariants = cva(
  "flex items-center gap-4 transition-colors outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-background hover:bg-accent/50",
        outline:
          "border bg-background hover:bg-accent/50 dark:border-input dark:hover:bg-accent/50",
        muted: "bg-muted hover:bg-muted/80 text-muted-foreground",
      },
      size: {
        default: "p-4 rounded-lg",
        sm: "p-3 rounded-md text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center",
  {
    variants: {
      variant: {
        default: "",
        icon: "size-10 rounded-md bg-muted/50 text-muted-foreground",
        image: "size-10 overflow-hidden rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type ItemVariants = VariantProps<typeof itemVariants>;
type ItemMediaVariants = VariantProps<typeof itemMediaVariants>;

@customElement("ui-item")
export class Item extends TW(LitElement) {
  @property({ type: String }) variant: ItemVariants["variant"] = "default";
  @property({ type: String }) size: ItemVariants["size"] = "default";

  @property({ type: String, attribute: "aria-label" }) accessor ariaLabel:
    | string
    | null = null;
  @property({ type: String, attribute: "aria-describedby" })
  accessor ariaDescribedby: string | null = null;
  @property({ type: String, attribute: "role" }) accessor role: string | null =
    null;

  private get itemClasses() {
    return itemVariants({ variant: this.variant, size: this.size });
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (changedProperties.has("role") && this.role) {
      this.setAttribute("role", this.role);
    }
  }

  override render() {
    return html`
      <div
        data-slot="item"
        class=${this.itemClasses}
        aria-label=${this.ariaLabel || nothing}
        aria-describedby=${this.ariaDescribedby || nothing}
        role=${this.role || nothing}
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-media")
export class ItemMedia extends TW(LitElement) {
  @property({ type: String }) variant: ItemMediaVariants["variant"] = "default";

  private get mediaClasses() {
    return itemMediaVariants({ variant: this.variant });
  }

  override render() {
    return html`
      <div data-slot="item-media" class=${this.mediaClasses}>
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-content")
export class ItemContent extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="item-content"
        class="flex min-w-0 flex-1 flex-col gap-1"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-title")
export class ItemTitle extends TW(LitElement) {
  override render() {
    return html`
      <div data-slot="item-title" class="font-medium leading-none">
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-description")
export class ItemDescription extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="item-description"
        class="text-muted-foreground text-sm leading-snug"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-actions")
export class ItemActions extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="item-actions"
        class="flex shrink-0 items-center gap-2"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-header")
export class ItemHeader extends TW(LitElement) {
  override render() {
    return html`
      <div data-slot="item-header" class="mb-3">
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-footer")
export class ItemFooter extends TW(LitElement) {
  override render() {
    return html`
      <div data-slot="item-footer" class="mt-3 flex items-center">
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-group")
export class ItemGroup extends TW(LitElement) {
  override render() {
    return html`
      <div data-slot="item-group" class="flex flex-col gap-2" role="list">
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-item-separator")
export class ItemSeparator extends TW(LitElement) {
  override render() {
    return html`
      <div
        data-slot="item-separator"
        class="bg-border h-px w-full"
        role="separator"
      ></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ui-item": Item;
    "ui-item-media": ItemMedia;
    "ui-item-content": ItemContent;
    "ui-item-title": ItemTitle;
    "ui-item-description": ItemDescription;
    "ui-item-actions": ItemActions;
    "ui-item-header": ItemHeader;
    "ui-item-footer": ItemFooter;
    "ui-item-group": ItemGroup;
    "ui-item-separator": ItemSeparator;
  }
}
