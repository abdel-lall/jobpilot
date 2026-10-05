import type { ReactNode } from "react";

const profileShadow = "shadow-[0_4px_16px_rgb(128_168_255/0.32)]";

export function profileCardClass(): string {
  return `flex w-full min-w-0 flex-col gap-5 rounded-[8px] border border-[var(--border)] bg-white p-5 ${profileShadow}`;
}

export const savedLabelClass = "text-[#8EC1DE]";

export function AddRecordButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="auth-focus inline-flex h-9 w-fit items-center justify-center justify-self-start rounded-md bg-[#D3D3FF] px-4 text-sm font-medium text-[var(--jp-ink)] hover:bg-[#D3D3FF] hover:brightness-95"
      onClick={onClick}
    >
      Add
    </button>
  );
}

export function RecordIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="auth-focus inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--jp-logout)] hover:bg-[#F3F4F6]"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12.5 6.5 17.5 11.5" strokeLinecap="round" />
      <path
        d="M4.5 19.5 6 14.2 15.8 4.4a1.6 1.6 0 0 1 2.3 0l1.5 1.5a1.6 1.6 0 0 1 0 2.3L10.8 18 5.5 19.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M5 7h14" strokeLinecap="round" />
      <path d="M9 7V5.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7" strokeLinejoin="round" />
      <path d="M7.5 7.5 8.2 18.2c0 .7.6 1.3 1.3 1.3h5c.7 0 1.3-.6 1.3-1.3l.7-10.7" strokeLinejoin="round" />
      <path d="M10 11v5M14 11v5" strokeLinecap="round" />
    </svg>
  );
}
