import { cva, type VariantProps } from "class-variance-authority";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TW } from "../../shared/tailwindMixin";

const TwLitElement = TW(LitElement);

@customElement("ui-field-set")
export class FieldSet extends TwLitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  override render() {
    return html`
      <fieldset
        part="fieldset"
        data-slot="field-set"
        class="flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3"
      >
        <slot></slot>
      </fieldset>
    `;
  }
}

@customElement("ui-field-legend")
export class FieldLegend extends TwLitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  @property({ type: String }) variant: "legend" | "label" = "legend";

  override render() {
    return html`
      <legend
        part="legend"
        data-slot="field-legend"
        data-variant=${this.variant}
        class="mb-3 font-medium data-[variant=legend]:text-base data-[variant=label]:text-sm"
      >
        <slot></slot>
      </legend>
    `;
  }
}

@customElement("ui-field-group")
export class FieldGroup extends TwLitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  override render() {
    return html`
      <div
        part="group"
        data-slot="field-group"
        class="group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4"
      >
        <slot></slot>
      </div>
    `;
  }
}

const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  },
);

type FieldVariants = VariantProps<typeof fieldVariants>;

@customElement("ui-field")
export class Field extends TwLitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  @property({ type: String }) orientation: FieldVariants["orientation"] =
    "vertical";
  @property({ type: Boolean, reflect: true }) invalid = false;

  private get fieldClasses() {
    return fieldVariants({ orientation: this.orientation });
  }

  override render() {
    return html`
      <div 
        role="group"
        part="field" 
        data-slot="field"
        data-orientation=${this.orientation || nothing} 
        data-invalid=${this.invalid}
        class=${this.fieldClasses}>
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-field-description")
export class FieldDescription extends TwLitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  override render() {
    return html`
      <p
        part="description"
        data-slot="field-description"
        class="text-muted-foreground text-sm leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5 [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4"
      >
        <slot></slot>
      </p>
    `;
  }
}

@customElement("ui-field-error")
export class FieldError extends TwLitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  override render() {
    return html`
      <div
        role="alert"
        part="error"
        data-slot="field-error"
        class="text-destructive text-sm font-normal"
      >
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ui-field": Field;
    "ui-field-description": FieldDescription;
    "ui-field-error": FieldError;
    "ui-field-group": FieldGroup;
    "ui-field-legend": FieldLegend;
    "ui-field-set": FieldSet;
  }
}
