import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type HealthResponse = {
  status: string;
};

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/health");
  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    typeof body.status !== "string"
  ) {
    throw new Error("Health response is missing a status");
  }

  return { status: body.status };
}

export function HealthPage() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>API health</CardTitle>
        </CardHeader>
        <CardContent>
          {healthQuery.isPending ? <p>Checking API health…</p> : null}
          {healthQuery.isError ? <p>The health check failed.</p> : null}
          {healthQuery.isSuccess ? (
            <p>Health status: {healthQuery.data.status}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
