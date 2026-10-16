export interface WorkerRequest {
  sessionId: string;
  projectId: string;
  action: string;
}

export interface WorkerResponse {
  success: boolean;
  message: string;
}

export class WorkerAPI {
  async execute(request: WorkerRequest): Promise<WorkerResponse> {
    return { success: true, message: `worker accepted ${request.action}` };
  }
}
