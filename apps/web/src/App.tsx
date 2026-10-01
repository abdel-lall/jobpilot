import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/auth/session";
import { AuthPage } from "@/pages/AuthPage";
import { ProfileQueryCache } from "@/profile/cache";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ProfileQueryCache />
        <AuthPage />
      </SessionProvider>
    </QueryClientProvider>
  );
}
