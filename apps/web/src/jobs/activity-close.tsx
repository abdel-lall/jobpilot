export function ActivityCloseButton({
  onClick,
  testId,
}: {
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Close"
      data-testid={testId}
      className="auth-focus absolute top-5 right-5 z-10 inline-flex size-8 items-center justify-center rounded-md text-[var(--jp-logout)] hover:bg-[#F3F4F6]"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M7 7l10 10M17 7 7 17" strokeLinecap="round" />
      </svg>
    </button>
  );
}
