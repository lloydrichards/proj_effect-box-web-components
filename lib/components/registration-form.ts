import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import "./ui/Button";
import "./ui/Card";
import "./ui/Field";
import "./ui/Select";
import { inputStyles } from "./ui/Input";

type FormData = {
  name: string;
  role: string;
  subscribe: boolean;
};

@customElement("registration-form")
export class RegistrationForm extends TW(LitElement) {
  @state() private submittedData: FormData | null = null;
  @state() private errors: Partial<Record<keyof FormData, string>> = {};

  private handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const data: FormData = {
      name: formData.get("name") as string,
      role: formData.get("role") as string,
      subscribe: formData.get("subscribe") === "on",
    };

    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!data.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!data.role) {
      newErrors.role = "Please select a role";
    }

    this.errors = newErrors;

    if (Object.keys(newErrors).length === 0) {
      this.submittedData = data;
    }
  }

  private handleReset() {
    this.submittedData = null;
    this.errors = {};
  }

  render() {
    if (this.submittedData) {
      return this.renderResults();
    }

    return html`
      <div class="flex flex-col items-center gap-6 w-full px-4 py-8">
        <div class="w-full max-w-2xl">
          <ui-card>
            <ui-card-header>
              <ui-card-title><slot></slot></ui-card-title>
              <ui-card-description>
                Fill out the form below to register.
              </ui-card-description>
            </ui-card-header>

            <ui-card-content>
              <form @submit=${this.handleSubmit} @reset=${this.handleReset} novalidate>
                <ui-field-group>
                  <ui-field ?invalid=${!!this.errors.name}>
                    <label for="name" class="text-sm font-medium"
                      >Full Name</label
                    >
                    <input
                      id="name"
                      name="name"
                      type="text"
                      class=${cn(inputStyles)}
                      placeholder="John Doe"
                      aria-invalid=${!!this.errors.name}
                    />
                    ${
                      this.errors.name
                        ? html`<ui-field-error
                          >${this.errors.name}</ui-field-error
                        >`
                        : html`<ui-field-description
                          >Enter your first and last name</ui-field-description
                        >`
                    }
                  </ui-field>

                  <ui-field ?invalid=${!!this.errors.role}>
                    <label for="role" class="text-sm font-medium">Role</label>
                    <ui-select id="role" name="role" value="">
                      <ui-select-trigger>
                        <ui-select-value placeholder="Select a role..."></ui-select-value>
                      </ui-select-trigger>
                      <ui-select-content>
                        <ui-select-item value="developer">Developer</ui-select-item>
                        <ui-select-item value="designer">Designer</ui-select-item>
                        <ui-select-item value="manager">Manager</ui-select-item>
                        <ui-select-item value="other">Other</ui-select-item>
                      </ui-select-content>
                    </ui-select>
                    ${
                      this.errors.role
                        ? html`<ui-field-error
                          >${this.errors.role}</ui-field-error
                        >`
                        : html`<ui-field-description
                          >Select your primary role</ui-field-description
                        >`
                    }
                  </ui-field>

                  <ui-field orientation="horizontal">
                    <div class="flex items-center gap-2">
                      <input
                        id="subscribe"
                        name="subscribe"
                        type="checkbox"
                        class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                      />
                      <label for="subscribe" class="text-sm font-medium"
                        >Subscribe to newsletter</label
                      >
                    </div>
                  </ui-field>
                </ui-field-group>

                <div class="flex gap-3 mt-6">
                  <ui-button type="submit" variant="default">
                    Submit
                  </ui-button>
                  <ui-button type="reset" variant="outline"> Reset </ui-button>
                </div>
              </form>
            </ui-card-content>
          </ui-card>
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center max-w-2xl">
          This is a demo registration form. Fill it out and submit to see the
          results.
        </p>
      </div>
    `;
  }

  private renderResults() {
    return html`
      <div class="flex flex-col items-center gap-6 w-full px-4 py-8">
        <div class="w-full max-w-2xl">
          <ui-card>
            <ui-card-header>
              <ui-card-title>Form Submission Results</ui-card-title>
              <ui-card-description>
                Here's the data that was submitted from the form
              </ui-card-description>
            </ui-card-header>

            <ui-card-content>
              <pre
                class="bg-muted text-foreground p-4 rounded-lg overflow-x-auto text-sm"
              >${JSON.stringify(this.submittedData, null, 2)}</pre>

              <ui-button
                @click=${this.handleReset}
                variant="default"
                class="mt-6"
              >
                Back to Form
              </ui-button>
            </ui-card-content>
          </ui-card>
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center max-w-2xl">
          The submitted data is displayed above in JSON format. Click "Back to
          Form" to submit again.
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "registration-form": RegistrationForm;
  }
}
