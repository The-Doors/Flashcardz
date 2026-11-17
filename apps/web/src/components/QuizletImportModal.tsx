import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Group, Loader, Modal, Progress, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { importQuizletSet, isQuizletSetUrl, loadImportJob } from "../lib/api-lib";
import type { JobStatus } from "../lib/generated/api-generated";
import "./QuizletImportModal.css";

type QuizletImportModalProps = {
  opened: boolean;
  onClose: () => void;
  onImported: (setId: number) => void;
};

const isFinished = (job?: JobStatus) => job?.status === "completed" || job?.status === "failed";
const stages: Record<string, string> = {
  fetching_set: "Fetching set details…",
  fetching_cards: "Fetching flashcards…",
  saving_deck: "Saving your private set…",
  completed: "Import complete!",
};

export default function QuizletImportModal({ opened, onClose, onImported }: QuizletImportModalProps) {
  const [source, setSource] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const completedJob = useRef<number | null>(null);
  const startImport = useMutation({ mutationFn: importQuizletSet, retry: false });
  const initialJob = startImport.data;
  const status = useQuery({
    queryKey: ["quizlet-import-job", initialJob?.id],
    queryFn: ({ signal }) => loadImportJob(initialJob!.id, signal),
    initialData: initialJob,
    enabled: opened && !!initialJob && !isFinished(initialJob),
    refetchInterval: (query) => isFinished(query.state.data) || query.state.status === "error" ? false : 2000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
  const job = status.data ?? initialJob;
  const importing = startImport.isPending || (!!job && !isFinished(job));
  const progress = job?.progress;
  const error = startImport.error?.message ?? (status.isError ? status.error.message : null)
    ?? (job?.status === "failed" ? job.error_message || "The import failed. Please try again." : null);

  useEffect(() => {
    if (job?.status === "completed" && job.deck_id !== null && completedJob.current !== job.id) {
      completedJob.current = job.id;
      onImported(job.deck_id);
    }
  }, [job, onImported]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (importing || job?.status === "completed") return;
    if (!isQuizletSetUrl(source)) {
      setUrlError("Enter an HTTPS Quizlet set link, such as https://quizlet.com/123/biology-flash-cards/.");
      return;
    }
    setUrlError(null);
    startImport.mutate(source);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Import from Quizlet" centered withinPortal={false} className="qi-modal" closeButtonProps={{ "aria-label": "Close Quizlet import" }}>
      <form onSubmit={submit} noValidate>
        <Stack>
          <Text size="sm" c="dimmed">Import a Quizlet set into a new private flashcard set. Your imported set will open when it is ready.</Text>
          <TextInput
            data-autofocus
            label="Quizlet set link"
            type="url"
            placeholder="https://quizlet.com/123/biology-flash-cards/"
            value={source}
            disabled={importing || job?.status === "completed"}
            onChange={(event) => { setSource(event.currentTarget.value); setUrlError(null); }}
            onBlur={() => { if (source.trim() && !isQuizletSetUrl(source)) setUrlError("Enter a valid HTTPS Quizlet set link."); }}
            error={urlError}
            required
            maxLength={2048}
          />
          {(startImport.isPending || job) && (
            <Stack gap="xs" role="status" aria-live="polite">
              <Group gap="xs">
                {importing && !status.isError && <Loader size="xs" aria-hidden="true" />}
                <Text size="sm">
                  {startImport.isPending ? "Starting import…" : job?.status === "failed" ? "Import failed."
                    : job?.status === "completed" ? "Import complete!"
                    : job?.status === "queued" ? "Loading…"
                    : stages[progress?.stage ?? ""] ?? "Importing from Quizlet…"}
                </Text>
              </Group>
              {progress?.fetched_cards !== undefined && (
                <Text size="sm" c="dimmed">
                  {progress.fetched_cards}{progress.total_cards != null ? ` of ${progress.total_cards}` : ""} cards fetched
                </Text>
              )}
              {progress?.stage === "fetching_cards" && progress.total_cards != null && progress.total_cards > 0 && (
                <Progress value={Math.min(100, 100 * (progress.fetched_cards ?? 0) / progress.total_cards)} aria-label="Flashcards fetched" />
              )}
              {importing && <Text size="xs" c="dimmed">The import continues if you close this dialog. Reopen it to check progress.</Text>}
            </Stack>
          )}
          {error && <Alert color="red" role="alert">{error}</Alert>}
          {job?.status === "completed" && job.deck_id === null && <Alert color="red" role="alert">The import completed without a set link. Check your sets before trying again.</Alert>}
          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={onClose}>Close</Button>
            {status.isError && importing ? (
              <Button type="button" loading={status.isFetching} onClick={() => void status.refetch()}>Retry status check</Button>
            ) : (
              <Button type="submit" loading={importing} disabled={job?.status === "completed"}>
                {job?.status === "failed" ? "Try import again" : "Import set"}
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
