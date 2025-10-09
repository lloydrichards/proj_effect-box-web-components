import { Atom, Result } from "@effect-atom/atom";
import { cva } from "class-variance-authority";
import { Data, Effect } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { RefreshCw, User } from "lucide-static";
import { AtomMixin, matchResult } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

class UserError extends Data.TaggedError("UserError")<{ message: string }> {}

class UserService extends Effect.Service<UserService>()("UserService", {
  effect: Effect.gen(function* () {
    const fetchUser = (id: string) =>
      Effect.gen(function* () {
        if (id === "error") {
          return yield* new UserError({ message: "User not found" });
        }

        yield* Effect.sleep("500 millis");

        return {
          id,
          name: `User ${id}`,
          email: `user${id}@example.com`,
          loadedAt: Date.now(),
        };
      });

    return { fetchUser } as const;
  }),
}) {}

const userRuntime = Atom.runtime(UserService.Default);

const userAtomFamily = Atom.family((userId: string) =>
  userRuntime
    .atom(
      Effect.gen(function* () {
        const service = yield* UserService;
        const user = yield* service.fetchUser(userId);
        return user;
      }),
    )
    .pipe(Atom.withReactivity(["users"])),
);

const refreshCountAtom = Atom.make(0);

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outlined: "border hover:bg-gray-100",
        ghost: "hover:bg-gray-100/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3",
        icon: "p-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

@customElement("user-detail")
export class UserDetail extends TW(AtomMixin(LitElement)) {
  @property({ type: String }) userId = "1";
  @property() docsHint =
    "Demonstrates Atom.family, auto-subscribe, and reactivity keys";

  render() {
    const userAtom = userAtomFamily(this.userId);
    this.useAtomMount(userAtom, { reactivityKeys: ["users"] });
    const userResult = this.useAtomValue(userAtom);
    const refreshCount = this.useAtomValue(refreshCountAtom);
    const refresh = this.useAtomRefresh(userAtom);

    return html`
      <div class="flex flex-col justify-center items-center gap-4 w-full">
        <slot></slot>

        <div
          class="border border-border/50 w-full max-w-sm rounded-lg shadow-sm p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold flex items-center gap-2">
              <span class="[&_svg]:size-4 text-blue-500"
                >${unsafeSVG(User)}</span
              >
              User Details
            </h3>
            <button
              class="${cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "[&_svg]:size-3.5",
              )}"
              @click=${() => {
                refresh();
                const setCount = this.useAtomSet(refreshCountAtom);
                setCount((c) => c + 1);
              }}
              ?disabled=${Result.isWaiting(userResult)}
              title="Refresh user data"
            >
              ${unsafeSVG(RefreshCw)}
            </button>
          </div>

          ${matchResult(userResult, {
            onInitial: () => html`
              <div class="text-center py-6">
                <p class="text-sm text-gray-400">Loading user...</p>
              </div>
            `,
            onSuccess: (user) => html`
              <div class="space-y-2 text-sm">
                <div class="flex justify-between items-baseline">
                  <span class="text-gray-500">ID</span>
                  <span class="font-medium">${user.id}</span>
                </div>
                <div class="flex justify-between items-baseline">
                  <span class="text-gray-500">Name</span>
                  <span class="font-medium">${user.name}</span>
                </div>
                <div class="flex justify-between items-baseline">
                  <span class="text-gray-500">Email</span>
                  <span class="font-medium">${user.email}</span>
                </div>
                <div class="flex justify-between items-baseline pt-1 border-t border-border/30">
                  <span class="text-gray-400 text-xs">Loaded</span>
                  <span class="text-gray-400 text-xs">
                    ${new Date(user.loadedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            `,
            onFailure: (error) => html`
              <div class="text-center py-6">
                <p class="text-sm text-red-500 font-medium">${error.message}</p>
              </div>
            `,
            onWaiting: () => html`
              <div class="text-center py-6">
                <p class="text-sm text-blue-500">Loading user...</p>
              </div>
            `,
          })}

          <div class="mt-3 pt-2 border-t border-border/30">
            <p class="text-xs text-gray-400 text-center">
              Refreshed ${refreshCount}×
            </p>
          </div>
        </div>

        <div class="flex gap-2 flex-wrap justify-center max-w-sm">
          ${["1", "2", "3", "error"].map(
            (id) => html`
              <button
                class="${cn(
                  buttonVariants({ variant: "outlined", size: "sm" }),
                )}"
                @click=${() => {
                  this.userId = id;
                }}
              >
                User ${id}
              </button>
            `,
          )}
        </div>

        <p class="text-gray-400 text-xs sm:text-sm text-center px-2 max-w-sm">
          ${this.docsHint}
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "user-detail": UserDetail;
  }
}
