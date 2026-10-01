import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/auth/session";
import { AuthPage } from "@/pages/AuthPage";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AuthPage />
      </SessionProvider>
    </QueryClientProvider>
  );
}
