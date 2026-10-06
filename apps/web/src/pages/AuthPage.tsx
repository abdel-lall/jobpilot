import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginBodySchema,
  registerBodySchema,
  type LoginBody,
  type PublicUser,
  type RegisterBody,
} from "@jobpilot/shared";
import { useRef, useState, type ReactNode } from "react";
import { useForm, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import artwork from "@/assets/auth-artwork.png";
import logo from "@/assets/logo.png";
import { useSession } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/jobs/dashboard";
import { ProfileSections } from "@/profile/sections";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type AuthView = "login" | "signup";

const authInputClass =
  "border-[var(--jp-primary-border)] bg-white focus-visible:border-[var(--jp-primary-border)] focus-visible:ring-[var(--jp-primary-border)]";
const authButtonClass =
  "auth-focus h-10 w-full bg-[var(--jp-primary-strong)] text-white hover:bg-[var(--jp-primary-strong-hover)] focus-visible:ring-0";

export function AuthPage() {
  const session = useSession();

  if (session.status === "loading") {
    return (
      <main
        data-testid="auth-loading"
        className="flex min-h-screen items-center justify-center bg-white p-6"
      >
        <p className="text-[var(--jp-ink)]">Restoring session…</p>
      </main>
    );
  }

  if (session.status === "signed-in" && session.user !== null) {
    return <SignedInPage user={session.user} accessToken={session.accessToken} />;
  }

  return <SignedOutPage />;
}

function SignedInPage({
  user,
  accessToken,
}: {
  user: PublicUser;
  accessToken: string | null;
}) {
  const session = useSession();
  const [view, setView] = useState<"profile" | "dashboard">("profile");
  const mainRef = useRef<HTMLElement>(null);

  function showView(next: "profile" | "dashboard") {
    setView(next);
    if (mainRef.current !== null) {
      mainRef.current.scrollTop = 0;
    }
  }

  return (
    <div data-testid="signed-in" className="flex h-dvh flex-col overflow-hidden bg-[var(--jp-canvas)]">
      <header className="shell-header relative z-10 flex h-[70px] shrink-0 items-center justify-between bg-white px-4">
        <img src={logo} alt="JobPilot" width={60} height={60} className="h-[60px] w-[60px] shrink-0" />
        <button
          type="button"
          aria-label="Log out"
          className="auth-focus inline-flex size-10 shrink-0 items-center justify-center rounded-md text-[var(--jp-logout)]"
          onClick={() => {
            void session.logout();
          }}
        >
          <LogoutIcon />
        </button>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <nav
          data-testid="app-nav"
          className="flex shrink-0 bg-[var(--jp-navy)] max-lg:gap-2 max-lg:p-2 lg:w-24 lg:flex-col lg:pt-[10px]"
        >
          <ShellNavButton
            testId="nav-dashboard"
            label="Dashboard"
            selected={view === "dashboard"}
            onSelect={() => {
              showView("dashboard");
            }}
            icon={<DashboardIcon />}
          />
          <ShellNavButton
            testId="nav-profile"
            label="Profile"
            selected={view === "profile"}
            onSelect={() => {
              showView("profile");
            }}
            icon={<ProfileIcon />}
          />
        </nav>
        <main
          ref={mainRef}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--jp-canvas)]"
        >
          <div className="p-5">
            <h1 className="mb-5 text-2xl font-semibold text-[var(--jp-ink)]">
              {view === "profile" ? "Profile" : "Dashboard"}
            </h1>
            {view === "profile" ? (
              <ProfileSections userId={user.id} accessToken={accessToken} />
            ) : (
              <Dashboard userId={user.id} email={user.email} accessToken={accessToken} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ShellNavButton({
  testId,
  label,
  selected,
  onSelect,
  icon,
}: {
  testId: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={selected ? "page" : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-xs font-medium lg:w-full lg:flex-none ${
        selected
          ? "shell-nav-selected bg-[var(--jp-accent)] text-[var(--jp-ink)]"
          : "shell-nav-idle text-white"
      }`}
      onClick={onSelect}
    >
      {icon}
      {label}
    </button>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8" r="3" />
      <path d="M6.2 19.2c1.15-2.8 3.15-4.2 5.8-4.2s4.65 1.4 5.8 4.2" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" strokeLinecap="round" />
      <path d="M4 12h10" strokeLinecap="round" />
      <path d="M11.5 8.5 15 12l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignedOutPage() {
  const session = useSession();
  const [view, setView] = useState<AuthView>("login");
  const [errorView, setErrorView] = useState<AuthView | null>(null);
  const showError = session.error !== null && (errorView === null || errorView === view);

  return (
    <main
      data-testid="signed-out"
      className="flex min-h-screen flex-col overflow-x-hidden bg-white lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden"
    >
      <AuthArtwork />
      <section className="auth-form-pane flex min-h-0 flex-1 lg:col-start-1 lg:row-start-1 lg:overflow-y-auto">
        <div className="m-auto w-full max-w-sm px-6 py-10">
          <div className="mb-8 text-center">
            <img src={logo} alt="" width={70} height={70} className="mx-auto h-[70px] w-[70px]" />
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--jp-ink)]">JobPilot</h1>
            <div className="mx-auto mt-3 h-0.5 w-11 bg-[var(--jp-secondary)]" />
          </div>
          {view === "login" && session.notice !== null ? (
            <p
              data-testid="register-confirmation"
              className="mb-6 rounded-md border border-[var(--jp-primary-border)] bg-[var(--jp-mist)]/50 px-3 py-2 text-sm text-[var(--jp-ink)]"
            >
              {session.notice}
            </p>
          ) : null}
          {showError ? (
            <p role="alert" className="mb-6 text-sm text-destructive">
              {session.error}
            </p>
          ) : null}
          {view === "login" ? (
            <LoginSection
              onSubmitStart={() => {
                setErrorView("login");
              }}
            />
          ) : (
            <RegisterSection
              onSubmitStart={() => {
                setErrorView("signup");
              }}
              onCreated={() => {
                setView("login");
              }}
            />
          )}
          <ViewSwitch view={view} onSwitch={setView} />
        </div>
      </section>
    </main>
  );
}

function AuthArtwork() {
  return (
    <section className="auth-artwork relative h-[32vh] min-h-36 shrink-0 overflow-hidden lg:col-start-2 lg:row-start-1 lg:h-screen lg:min-h-0">
      <img src={artwork} alt="" className="auth-artwork-img" />
    </section>
  );
}

function ViewSwitch({ view, onSwitch }: { view: AuthView; onSwitch: (view: AuthView) => void }) {
  const nextView: AuthView = view === "login" ? "signup" : "login";
  const lead = view === "login" ? "Don't have an account?" : "Already have an account?";
  const action = view === "login" ? "Sign up" : "Log in";

  return (
    <button
      type="button"
      className="auth-focus mt-6 rounded-sm text-left text-sm text-[var(--jp-ink)]"
      onClick={() => {
        onSwitch(nextView);
      }}
    >
      {lead}{" "}
      <span className="font-semibold underline decoration-[var(--jp-primary-border)] decoration-2 underline-offset-4">
        {action}
      </span>
    </button>
  );
}

function LoginSection({ onSubmitStart }: { onSubmitStart: () => void }) {
  const session = useSession();
  const form = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form
        aria-label="Log in"
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          onSubmitStart();
          await session.login(values);
        })}
      >
        <AuthHeading title="Log in" description="Use an existing account" />
        <AuthFields control={form.control} passwordAutoComplete="current-password" />
        <Button type="submit" className={authButtonClass} disabled={form.formState.isSubmitting}>
          Log in
        </Button>
      </form>
    </Form>
  );
}

function RegisterSection({
  onSubmitStart,
  onCreated,
}: {
  onSubmitStart: () => void;
  onCreated: () => void;
}) {
  const session = useSession();
  const form = useForm<RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form
        aria-label="Register"
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          onSubmitStart();
          const created = await session.register(values);
          if (created) {
            onCreated();
          }
        })}
      >
        <AuthHeading title="Create account" description="Register a new account" />
        <AuthFields control={form.control} passwordAutoComplete="new-password" />
        <Button type="submit" className={authButtonClass} disabled={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </Form>
  );
}

function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--jp-ink)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--jp-muted)]">{description}</p>
    </div>
  );
}

function AuthFields<T extends { email: string; password: string }>({
  control,
  passwordAutoComplete,
}: {
  control: Control<T>;
  passwordAutoComplete: "new-password" | "current-password";
}) {
  return (
    <>
      <AuthField
        control={control}
        name={"email" as FieldPath<T>}
        label="Email"
        type="email"
        autoComplete="email"
      />
      <AuthField
        control={control}
        name={"password" as FieldPath<T>}
        label="Password"
        type="password"
        autoComplete={passwordAutoComplete}
      />
    </>
  );
}

function AuthField<T extends FieldValues>({
  control,
  name,
  label,
  type,
  autoComplete,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type: "email" | "password";
  autoComplete: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[var(--jp-ink)]">{label}</FormLabel>
          <FormControl>
            <Input type={type} autoComplete={autoComplete} className={authInputClass} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
