import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginBodySchema,
  registerBodySchema,
  type LoginBody,
  type PublicUser,
  type RegisterBody,
} from "@jobpilot/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
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

export function AuthPage() {
  const session = useSession();

  if (session.status === "loading") {
    return (
      <main
        data-testid="auth-loading"
        className="flex min-h-screen items-center justify-center p-6"
      >
        <p>Restoring session…</p>
      </main>
    );
  }

  if (session.status === "signed-in" && session.user !== null) {
    return <SignedInPage user={session.user} accessToken={session.accessToken} />;
  }

  return (
    <main
      data-testid="signed-out"
      className="flex min-h-screen items-center justify-center p-6"
    >
      <div className="grid w-full max-w-4xl gap-6">
        <SessionMessages />
        <div className="grid gap-6 md:grid-cols-2">
          <RegisterSection />
          <LoginSection />
        </div>
      </div>
    </main>
  );
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

function SessionMessages() {
  const session = useSession();

  return (
    <>
      {session.notice !== null ? (
        <p data-testid="register-confirmation">{session.notice}</p>
      ) : null}
      {session.error !== null ? <p role="alert">{session.error}</p> : null}
    </>
  );
}

function RegisterSection() {
  const session = useSession();
  const form = useForm<RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Register a new account</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Form {...form}>
          <form
            aria-label="Register"
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit(async (values) => {
              await session.register(values);
            })}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Create account
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function LoginSection() {
  const session = useSession();
  const form = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Use an existing account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            aria-label="Log in"
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit(async (values) => {
              await session.login(values);
            })}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Log in
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
