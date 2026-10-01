import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resumeFileSchema, type ResumeFile } from "@jobpilot/shared";
import { getAuthenticatedUser } from "../auth/service.js";
import { getPrisma } from "../db.js";
import { ResumeError } from "./errors.js";

const MAX_RESUME_BYTES = 5_242_880;
const RESUME_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.pdf$/i;

export type UploadedResume = {
  originalName: string;
  contentType: string;
  bytes: Buffer;
};

type StoredResume = {
  id: string;
  userId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  storagePath: string;
  createdAt: Date;
};

export type ResumeDownload = {
  fileName: string;
  contentType: string;
  bytes: Buffer;
};

function requireStorageDir(): string {
  const storageDir = process.env.RESUME_STORAGE_DIR;
  if (storageDir === undefined || storageDir.trim().length === 0) {
    throw new ResumeError("internal");
  }
  return storageDir;
}

function isInsideStorageDir(storageDir: string, candidate: string): boolean {
  const root = path.resolve(storageDir);
  const target = path.resolve(candidate);
  const relative = path.relative(root, target);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return true;
}

function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function acceptedFileName(originalName: string): string {
  if (
    originalName.includes("/") ||
    originalName.includes("\\") ||
    originalName.includes("..") ||
    !RESUME_FILE_NAME.test(originalName)
  ) {
    throw new ResumeError("invalid_input");
  }
  return originalName;
}

function toResumeFile(record: StoredResume): ResumeFile {
  const parsed = resumeFileSchema.safeParse({
    id: record.id,
    userId: record.userId,
    fileName: record.fileName,
    contentType: record.contentType,
    byteSize: record.byteSize,
    createdAt: record.createdAt.toISOString(),
  });
  if (!parsed.success) {
    throw new ResumeError("internal");
  }
  return parsed.data;
}

async function findOwned(authorization: string | undefined, id: string): Promise<StoredResume> {
  const user = await getAuthenticatedUser(authorization);
  const record = await getPrisma().resumeFile.findFirst({
    where: { id, userId: user.id },
  });
  if (record === null) {
    throw new ResumeError("not_found");
  }
  return record;
}

function resolveStoredFile(storageDir: string, storagePath: string): string {
  const storedPath = path.resolve(storagePath);
  if (!isInsideStorageDir(storageDir, storedPath)) {
    throw new ResumeError("internal");
  }
  return storedPath;
}

async function unlinkQuiet(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    return;
  }
}

export async function createResumeFile(
  authorization: string | undefined,
  file: UploadedResume | undefined,
): Promise<ResumeFile> {
  const user = await getAuthenticatedUser(authorization);
  if (
    file === undefined ||
    file.contentType !== "application/pdf" ||
    file.bytes.length === 0 ||
    file.bytes.length > MAX_RESUME_BYTES
  ) {
    throw new ResumeError("invalid_input");
  }
  const fileName = acceptedFileName(file.originalName);
  const storageDir = requireStorageDir();
  const id = randomUUID();
  const storagePath = path.resolve(storageDir, user.id, `${id}.pdf`);
  if (!isInsideStorageDir(storageDir, storagePath)) {
    throw new ResumeError("internal");
  }

  try {
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, file.bytes);
  } catch {
    await unlinkQuiet(storagePath);
    throw new ResumeError("internal");
  }

  try {
    const record = await getPrisma().resumeFile.create({
      data: {
        id,
        userId: user.id,
        fileName,
        contentType: "application/pdf",
        byteSize: file.bytes.length,
        storagePath,
      },
    });
    return toResumeFile(record);
  } catch (error) {
    await unlinkQuiet(storagePath);
    if (error instanceof ResumeError) {
      throw error;
    }
    throw new ResumeError("internal");
  }
}

export async function listResumeFiles(authorization: string | undefined): Promise<ResumeFile[]> {
  const user = await getAuthenticatedUser(authorization);
  const records = await getPrisma().resumeFile.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return records.map((record) => toResumeFile(record));
}

export async function readResumeFile(
  authorization: string | undefined,
  id: string,
): Promise<ResumeDownload> {
  const record = await findOwned(authorization, id);
  const storedPath = resolveStoredFile(requireStorageDir(), record.storagePath);
  try {
    const bytes = await readFile(storedPath);
    return {
      fileName: record.fileName,
      contentType: record.contentType,
      bytes,
    };
  } catch {
    throw new ResumeError("internal");
  }
}

export async function deleteResumeFile(authorization: string | undefined, id: string): Promise<void> {
  const record = await findOwned(authorization, id);
  const storedPath = resolveStoredFile(requireStorageDir(), record.storagePath);
  try {
    await unlink(storedPath);
  } catch (error) {
    if (!isEnoent(error)) {
      throw new ResumeError("internal");
    }
  }
  await getPrisma().resumeFile.delete({ where: { id: record.id } });
}
