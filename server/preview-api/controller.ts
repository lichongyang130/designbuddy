import {
  PreviewServer,
  PreviewServerError
} from "../preview-engine/preview-server";
import { PreviewSessionError } from "../preview-engine/preview-session";
import type {
  PreviewActor,
  PreviewErrorInput,
  PreviewEvent,
  PreviewFile,
  PreviewFramework
} from "../preview-engine/preview-types";

export interface AuthenticatedPreviewUser {
  id: string;
  roles?: string[];
}

export interface PreviewApiErrorBody {
  error: string;
  message: string;
}

export interface PreviewApiResult<T = unknown> {
  status: number;
  body: T | PreviewApiErrorBody;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireActor(user: AuthenticatedPreviewUser | undefined): PreviewActor {
  if (!user || typeof user.id !== "string" || !user.id.trim()) {
    throw new PreviewApiHttpError(401, "UNAUTHENTICATED", "Authentication is required.");
  }
  return { userId: user.id, roles: user.roles ?? [] };
}

export class PreviewApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "PreviewApiHttpError";
  }
}

function normalizeError(error: unknown): PreviewApiResult<PreviewApiErrorBody> {
  if (error instanceof PreviewApiHttpError) {
    return {
      status: error.status,
      body: { error: error.code, message: error.message }
    };
  }

  if (error instanceof PreviewSessionError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409;
    return {
      status,
      body: { error: error.code, message: error.message }
    };
  }

  if (error instanceof PreviewServerError) {
    const status =
      error.code === "INVALID_INPUT" ? 400 :
      error.code === "UNSAFE_PREVIEW_URL" ? 502 : 502;
    return {
      status,
      body: {
        error: error.code,
        message: status === 502 ? "Preview runtime operation failed." : error.message
      }
    };
  }

  return {
    status: 500,
    body: { error: "INTERNAL_ERROR", message: "An unexpected preview API error occurred." }
  };
}

export class PreviewApiController {
  constructor(private readonly preview: PreviewServer) {}

  async list(user: AuthenticatedPreviewUser | undefined): Promise<PreviewApiResult> {
    try {
      return { status: 200, body: { sessions: this.preview.listSessions(requireActor(user)) } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async create(
    user: AuthenticatedPreviewUser | undefined,
    body: unknown
  ): Promise<PreviewApiResult> {
    try {
      const actor = requireActor(user);
      if (!isRecord(body)) {
        throw new PreviewApiHttpError(400, "INVALID_INPUT", "Request body must be an object.");
      }

      const session = await this.preview.start(actor, {
        projectId: body.projectId as string,
        framework: body.framework as PreviewFramework,
        files: body.files as PreviewFile[]
      });
      return { status: 201, body: { session } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async get(
    user: AuthenticatedPreviewUser | undefined,
    sessionId: string
  ): Promise<PreviewApiResult> {
    try {
      if (!sessionId) throw new PreviewApiHttpError(400, "INVALID_INPUT", "Session ID is required.");
      const session = this.preview.getSession(requireActor(user), sessionId);
      return { status: 200, body: { session } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async update(
    user: AuthenticatedPreviewUser | undefined,
    sessionId: string,
    body: unknown
  ): Promise<PreviewApiResult> {
    try {
      const actor = requireActor(user);
      if (!sessionId) throw new PreviewApiHttpError(400, "INVALID_INPUT", "Session ID is required.");
      if (!isRecord(body)) {
        throw new PreviewApiHttpError(400, "INVALID_INPUT", "Request body must be an object.");
      }

      const session = await this.preview.update(actor, sessionId, {
        files: body.files as PreviewFile[],
        changedPaths: body.changedPaths as string[]
      });
      return { status: 200, body: { session } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async stop(
    user: AuthenticatedPreviewUser | undefined,
    sessionId: string
  ): Promise<PreviewApiResult> {
    try {
      if (!sessionId) throw new PreviewApiHttpError(400, "INVALID_INPUT", "Session ID is required.");
      const session = await this.preview.stop(requireActor(user), sessionId);
      return { status: 200, body: { session } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async health(
    user: AuthenticatedPreviewUser | undefined,
    sessionId: string
  ): Promise<PreviewApiResult> {
    try {
      const health = await this.preview.checkHealth(requireActor(user), sessionId);
      const session = this.preview.getSession(requireActor(user), sessionId);
      return { status: 200, body: { status: session.status, health } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listErrors(
    user: AuthenticatedPreviewUser | undefined,
    sessionId: string
  ): Promise<PreviewApiResult> {
    try {
      const errors = this.preview.listErrors(requireActor(user), sessionId);
      return { status: 200, body: { errors } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async reportError(
    user: AuthenticatedPreviewUser | undefined,
    sessionId: string,
    body: unknown
  ): Promise<PreviewApiResult> {
    try {
      const actor = requireActor(user);
      if (!isRecord(body) || typeof body.message !== "string" || !body.message.trim()) {
        throw new PreviewApiHttpError(400, "INVALID_INPUT", "An error message is required.");
      }
      const input: PreviewErrorInput = {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        message: body.message,
        ...(typeof body.stack === "string" ? { stack: body.stack } : {}),
        ...(typeof body.source === "string" ? { source: body.source } : {}),
        ...(typeof body.timestamp === "number" ? { timestamp: body.timestamp } : {})
      };
      const report = this.preview.reportError(actor, sessionId, input);
      return { status: 201, body: { error: report } };
    } catch (error) {
      return normalizeError(error);
    }
  }

  subscribe(
    user: AuthenticatedPreviewUser | undefined,
    sessionId: string,
    listener: (event: PreviewEvent) => void
  ): () => void {
    return this.preview.subscribe(requireActor(user), sessionId, listener);
  }

  toHttpError(error: unknown): PreviewApiResult<PreviewApiErrorBody> {
    return normalizeError(error);
  }
}
