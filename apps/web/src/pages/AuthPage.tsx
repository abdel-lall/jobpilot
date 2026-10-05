import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginBodySchema,
  registerBodySchema,
  type LoginBody,
  type PublicUser,
  type RegisterBody,
} from "@jobpilot/shared";
import { useState } from "react";
import { useForm, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import artwork from "@/assets/auth-artwork.png";
import logo from "@/assets/logo.png";
import { useSession } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/jobs/dashboard";
import { ProfileSections } from "@/profile/sections";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <main
      data-testid="signed-in"
      className="mx-auto grid min-h-screen w-full max-w-3xl content-start gap-6 p-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
          <CardDescription>Current account</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p data-testid="user-email">{user.email}</p>
          <Button type="button" onClick={() => void session.logout()}>
            Log out
          </Button>
          {session.error !== null ? <p role="alert">{session.error}</p> : null}
        </CardContent>
      </Card>
      <nav data-testid="app-nav" className="flex flex-wrap gap-2">
        <Button type="button" data-testid="nav-profile" onClick={() => setView("profile")}>
          Profile
        </Button>
        <Button type="button" data-testid="nav-dashboard" onClick={() => setView("dashboard")}>
          Dashboard
        </Button>
      </nav>
      {view === "profile" ? (
        <ProfileSections userId={user.id} accessToken={accessToken} />
      ) : (
        <Dashboard userId={user.id} accessToken={accessToken} />
      )}
    </main>
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
