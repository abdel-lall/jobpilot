import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { AuthError } from "../auth/errors.js";
import { ResumeError } from "../resumes/errors.js";
import {
  createResumeFile,
  deleteResumeFile,
  listResumeFiles,
  readResumeFile,
} from "../resumes/service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  preservePath: true,
  limits: {
    fileSize: 5_242_880,
    files: 1,
  },
});

function sendResumeError(response: Response, error: unknown): void {
  if (error instanceof AuthError) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (error instanceof ResumeError) {
    if (error.code === "not_found") {
      response.status(404).json({ error: "Not found" });
      return;
    }
    if (error.code === "invalid_input") {
      response.status(400).json({ error: "Invalid input" });
      return;
    }
  }
  response.status(500).json({ error: "Internal server error" });
}

async function respond(
  response: Response,
  status: number,
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    const body = await action();
    if (status === 204) {
      response.status(204).end();
      return;
    }
    response.status(status).json(body);
  } catch (error) {
    sendResumeError(response, error);
  }
}

function pathId(request: Request): string {
  const id = request.params.id;
  return typeof id === "string" ? id : "";
}

function receiveResumeUpload(request: Request, response: Response, next: NextFunction): void {
  upload.single("file")(request, response, (error: unknown) => {
    if (error !== undefined && error !== null) {
      response.status(400).json({ error: "Invalid input" });
      return;
    }
    next();
  });
}

export function createResumeRouter(): Router {
  const router = Router();

  router.post("/profile/resumes", receiveResumeUpload, async (request, response) => {
    const file = request.file;
    await respond(response, 201, async () => ({
      resumeFile: await createResumeFile(
        request.header("authorization"),
        file === undefined
          ? undefined
          : {
              originalName: file.originalname,
              contentType: file.mimetype,
              bytes: file.buffer,
            },
      ),
    }));
  });

  router.get("/profile/resumes", async (request, response) => {
    await respond(response, 200, async () => ({
      resumeFiles: await listResumeFiles(request.header("authorization")),
    }));
  });

  router.get("/profile/resumes/:id", async (request, response) => {
    try {
      const file = await readResumeFile(request.header("authorization"), pathId(request));
      response.setHeader("Content-Type", file.contentType);
      response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
      response.status(200).send(file.bytes);
    } catch (error) {
      sendResumeError(response, error);
    }
  });

  router.delete("/profile/resumes/:id", async (request, response) => {
    await respond(response, 204, () =>
      deleteResumeFile(request.header("authorization"), pathId(request)),
    );
  });

  return router;
}
