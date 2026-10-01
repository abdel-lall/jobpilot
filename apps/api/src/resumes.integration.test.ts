import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required");
}

if (jwtSecret === undefined || jwtSecret.length === 0) {
  throw new Error("JWT_SECRET is required");
}

const storageDir = await mkdtemp(path.join(tmpdir(), "phase7-resumes-"));
process.env.RESUME_STORAGE_DIR = storageDir;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const app = createApp();
const createdEmails: string[] = [];
const password = "password1";
const resumeBytes = Buffer.from("phase7-resume-bytes");

type JsonObject = Record<string, unknown>;

function uniqueEmail(): string {
  const email = `phase7-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

async function registerAndLogin(): Promise<{ token: string; userId: string }> {
  const email = uniqueEmail();
  const registered = await request(app).post("/auth/register").send({ email, password });
  expect(registered.status).toBe(201);
  const loggedIn = await request(app).post("/auth/login").send({ email, password });
  expect(loggedIn.status).toBe(200);
  return {
    token: loggedIn.body.accessToken as string,
    userId: loggedIn.body.user.id as string,
  };
}

function upload(token: string | undefined, bytes: Buffer, filename: string, contentType: string) {
  const pending = request(app).post("/profile/resumes");
  if (token !== undefined) {
    pending.set("Authorization", `Bearer ${token}`);
  }
  return pending.attach("file", bytes, { filename, contentType });
}

function uploadOriginalName(token: string, bytes: Buffer, filename: string, contentType: string) {
  const boundary = "phase7boundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return request(app)
    .post("/profile/resumes")
    .set("Authorization", `Bearer ${token}`)
    .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
    .send(payload);
}

async function storedFiles(): Promise<string[]> {
  const found: string[] = [];
  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        found.push(fullPath);
      }
    }
  }
  await walk(storageDir);
  return found;
}

async function readDownload(token: string, id: string) {
  return request(app)
    .get(`/profile/resumes/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", () => {
        callback(null, Buffer.concat(chunks));
      });
    });
}

describe("resume file API", () => {
  beforeAll(() => {
    process.env.RESUME_STORAGE_DIR = storageDir;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("returns an empty list and rejects a missing token", async () => {
    const owner = await registerAndLogin();
    const listed = await request(app)
      .get("/profile/resumes")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ resumeFiles: [] });

    const missing = await request(app).get("/profile/resumes");
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: "Unauthorized" });
  });

  it("uploads, lists, downloads the same bytes, and deletes the row and file", async () => {
    const owner = await registerAndLogin();
    const created = await upload(owner.token, resumeBytes, "phase7-resume.pdf", "application/pdf");
    expect(created.status).toBe(201);
    const resumeFile = created.body.resumeFile as JsonObject;
    expect(resumeFile).toMatchObject({
      userId: owner.userId,
      fileName: "phase7-resume.pdf",
      contentType: "application/pdf",
      byteSize: 19,
    });
    expect(resumeFile).not.toHaveProperty("storagePath");
    expect(Object.keys(resumeFile).sort()).toEqual([
      "byteSize",
      "contentType",
      "createdAt",
      "fileName",
      "id",
      "userId",
    ]);

    const listed = await request(app)
      .get("/profile/resumes")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.resumeFiles).toEqual([resumeFile]);

    const id = resumeFile.id;
    if (typeof id !== "string") {
      throw new Error("expected resume id");
    }
    const downloaded = await readDownload(owner.token, id);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toBe("application/pdf");
    expect(downloaded.headers["content-disposition"]).toBe(
      'attachment; filename="phase7-resume.pdf"',
    );
    expect(downloaded.body).toEqual(resumeBytes);

    const stored = await prisma.resumeFile.findUnique({ where: { id } });
    expect(stored?.storagePath).toBe(path.resolve(storageDir, owner.userId, `${id}.pdf`));

    const deleted = await request(app)
      .delete(`/profile/resumes/${id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");
    expect(await prisma.resumeFile.findUnique({ where: { id } })).toBeNull();
    await expect(stat(path.resolve(storageDir, owner.userId, `${id}.pdf`))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects a non-PDF, an oversize file, and a path-like filename with no row and no file", async () => {
    const owner = await registerAndLogin();
    const nonPdf = await upload(owner.token, resumeBytes, "notes.txt", "text/plain");
    expect(nonPdf.status).toBe(400);
    expect(nonPdf.body).toEqual({ error: "Invalid input" });

    const oversize = await upload(
      owner.token,
      Buffer.alloc(5_242_881, 1),
      "phase7-resume.pdf",
      "application/pdf",
    );
    expect(oversize.status).toBe(400);
    expect(oversize.body).toEqual({ error: "Invalid input" });

    const pathLike = await uploadOriginalName(
      owner.token,
      resumeBytes,
      "../../resume.pdf",
      "application/pdf",
    );
    expect(pathLike.status).toBe(400);
    expect(pathLike.body).toEqual({ error: "Invalid input" });

    expect(await prisma.resumeFile.count({ where: { userId: owner.userId } })).toBe(0);
    expect(await storedFiles()).toEqual([]);
  });

  it("hides another user's file and returns 404 for that user's download and delete", async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const created = await upload(owner.token, resumeBytes, "phase7-resume.pdf", "application/pdf");
    expect(created.status).toBe(201);
    const id = created.body.resumeFile.id as string;
    const storedPath = path.resolve(storageDir, owner.userId, `${id}.pdf`);

    const listed = await request(app)
      .get("/profile/resumes")
      .set("Authorization", `Bearer ${other.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ resumeFiles: [] });

    const downloaded = await request(app)
      .get(`/profile/resumes/${id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(downloaded.status).toBe(404);
    expect(downloaded.body).toEqual({ error: "Not found" });

    const deleted = await request(app)
      .delete(`/profile/resumes/${id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(deleted.status).toBe(404);
    expect(deleted.body).toEqual({ error: "Not found" });

    expect(await prisma.resumeFile.findUnique({ where: { id } })).not.toBeNull();
    expect(await readFile(storedPath)).toEqual(resumeBytes);
  });

  it("removes the row when the stored file is already absent", async () => {
    const owner = await registerAndLogin();
    const created = await upload(owner.token, resumeBytes, "phase7-resume.pdf", "application/pdf");
    const id = created.body.resumeFile.id as string;
    await unlink(path.resolve(storageDir, owner.userId, `${id}.pdf`));

    const deleted = await request(app)
      .delete(`/profile/resumes/${id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(204);
    expect(await prisma.resumeFile.findUnique({ where: { id } })).toBeNull();
  });

  it("keeps the row when unlink fails for a reason other than an absent file", async () => {
    const owner = await registerAndLogin();
    const created = await upload(owner.token, resumeBytes, "phase7-resume.pdf", "application/pdf");
    const id = created.body.resumeFile.id as string;
    const blocked = path.resolve(storageDir, owner.userId, "blocked-dir");
    await mkdir(blocked);
    await prisma.resumeFile.update({ where: { id }, data: { storagePath: blocked } });

    const deleted = await request(app)
      .delete(`/profile/resumes/${id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(500);
    expect(deleted.body).toEqual({ error: "Internal server error" });
    expect(await prisma.resumeFile.findUnique({ where: { id } })).not.toBeNull();
    expect((await stat(blocked)).isDirectory()).toBe(true);
  });

  it("does not read or unlink a stored path outside the storage directory", async () => {
    const owner = await registerAndLogin();
    const created = await upload(owner.token, resumeBytes, "phase7-resume.pdf", "application/pdf");
    const id = created.body.resumeFile.id as string;
    const outsideDir = await mkdtemp(path.join(tmpdir(), "phase7-outside-"));
    const outsideFile = path.join(outsideDir, "secret.pdf");
    const outsideBytes = Buffer.from("outside-secret");
    await writeFile(outsideFile, outsideBytes);
    await prisma.resumeFile.update({ where: { id }, data: { storagePath: outsideFile } });

    try {
      const downloaded = await request(app)
        .get(`/profile/resumes/${id}`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(downloaded.status).toBe(500);
      expect(downloaded.body).toEqual({ error: "Internal server error" });
      expect(downloaded.headers["content-type"]).toMatch(/application\/json/);
      expect(await readFile(outsideFile)).toEqual(outsideBytes);

      const deleted = await request(app)
        .delete(`/profile/resumes/${id}`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(deleted.status).toBe(500);
      expect(deleted.body).toEqual({ error: "Internal server error" });
      expect(await prisma.resumeFile.findUnique({ where: { id } })).not.toBeNull();
      expect(await readFile(outsideFile)).toEqual(outsideBytes);
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });
});
