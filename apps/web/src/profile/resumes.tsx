import type { ResumeFile } from "@jobpilot/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteResumeFile,
  downloadResumeFile,
  listResumeFiles,
  profilePaths,
  profileQueryKey,
  requestErrorMessage,
  uploadResumeFile,
} from "@/profile/requests";

type ResumesSectionProps = {
  userId: string;
  accessToken: string | null;
};

function requireToken(accessToken: string | null): string {
  if (accessToken === null || accessToken.length === 0) {
    throw new Error("Request failed");
  }
  return accessToken;
}

export function ResumesSection({ userId, accessToken }: ResumesSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: profileQueryKey(profilePaths.resumes, userId),
    enabled: accessToken !== null && accessToken.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (accessToken === null || accessToken.length === 0) {
        throw new Error("Request failed");
      }
      return listResumeFiles(accessToken);
    },
  });

  const refetch = useCallback(() => {
    return queryClient.refetchQueries({ queryKey: profileQueryKey(profilePaths.resumes, userId) });
  }, [queryClient, userId]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setRequestError(null);
    try {
      await action();
    } catch (error) {
      setRequestError(requestErrorMessage(error));
    }
  }, []);

  const data = query.data;
  const showLoading = data === undefined && query.isFetching;
  const showEmpty = query.isSuccess && data !== undefined && data.length === 0;
  const listError = query.isError ? requestErrorMessage(query.error) : null;

  return (
    <section data-testid="profile-resumes">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Resumes</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showLoading ? <p data-testid="profile-resumes-loading">Loading resumes…</p> : null}
          {listError !== null ? <p role="alert">{listError}</p> : null}
          {showEmpty ? <p data-testid="profile-resumes-empty">No resumes yet.</p> : null}
          {data !== undefined && data.length > 0 ? (
            <ul className="grid gap-4">
              {data.map((record) => (
                <ResumeRow
                  key={record.id}
                  record={record}
                  onDownload={() => {
                    void run(() =>
                      downloadResumeFile(requireToken(accessToken), record.id, record.fileName),
                    );
                  }}
                  onDelete={() => {
                    void run(async () => {
                      await deleteResumeFile(requireToken(accessToken), record.id);
                      await refetch();
                    });
                  }}
                />
              ))}
            </ul>
          ) : null}
          {requestError !== null ? <p role="alert">{requestError}</p> : null}
          <div className="grid gap-3">
            <input ref={fileInputRef} type="file" />
            <Button
              type="button"
              onClick={() => {
                void run(async () => {
                  const input = fileInputRef.current;
                  const file = input?.files?.[0];
                  if (file === undefined) {
                    throw new Error("Invalid input");
                  }
                  await uploadResumeFile(requireToken(accessToken), file);
                  if (input !== null && input !== undefined) {
                    input.value = "";
                  }
                  await refetch();
                });
              }}
            >
              Upload resume
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ResumeRow({
  record,
  onDownload,
  onDelete,
}: {
  record: ResumeFile;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="grid gap-3">
      <p>{record.fileName}</p>
      <Button type="button" onClick={onDownload}>
        Download resume
      </Button>
      <Button type="button" onClick={onDelete}>
        Delete resume
      </Button>
    </li>
  );
}
