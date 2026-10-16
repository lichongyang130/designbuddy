import { HttpPreviewAdapter } from "../preview-engine/http-preview-adapter";
import { PreviewServer } from "../preview-engine/preview-server";
import { PreviewApiController } from "./controller";
import { registerPreviewRoutes, type PreviewHandler, type PreviewRouterLike } from "./routes";

export interface CreatePreviewServiceOptions {
  runtimeBaseUrl: string;
  runtimeToken: string;
  allowedPreviewOrigins?: string[];
  requestTimeoutMs?: number;
  operationTimeoutMs?: number;
  maxFiles?: number;
  maxTotalBytes?: number;
  fetchImpl?: typeof fetch;
}

export function createPreviewService(options: CreatePreviewServiceOptions) {
  const adapter = new HttpPreviewAdapter({
    baseUrl: options.runtimeBaseUrl,
    token: options.runtimeToken,
    ...(options.requestTimeoutMs ? { requestTimeoutMs: options.requestTimeoutMs } : {}),
    ...(options.operationTimeoutMs ? { operationTimeoutMs: options.operationTimeoutMs } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
  });

  const preview = new PreviewServer(adapter, {
    ...(options.allowedPreviewOrigins ? { allowedPreviewOrigins: options.allowedPreviewOrigins } : {}),
    ...(options.maxFiles ? { maxFiles: options.maxFiles } : {}),
    ...(options.maxTotalBytes ? { maxTotalBytes: options.maxTotalBytes } : {})
  });
  const controller = new PreviewApiController(preview);

  return {
    adapter,
    preview,
    controller,
    mount(router: PreviewRouterLike, requireAuth: PreviewHandler) {
      registerPreviewRoutes(router, controller, requireAuth);
    }
  };
}
