import { runtimeCatalog } from "../skills/runtime-catalog";
import type { TaskBackend } from "./task-backend";
import type { WorkspaceBackend } from "./workspace-backend";

/**
 * The operator console.
 *
 * An operator needs to see who uses this server, what it costs, what failed and
 * what the platform can actually run. The console is read-mostly, but the three
 * actions it offers are real server state changes: an account can be turned off
 * (its sessions end), a failed task can be retried, a schedule can be stopped.
 *
 * The console is **not** a way around the existing rules. It never returns
 * password material, it never runs a skill, and every change it makes is
 * written to the same audit trail the account owner can read.
 */

/** Who may open the console. Configured on the server, never in the browser. */
export function configuredAdmins(): string[] {
  return (process.env.DESIGNBUDDY_ADMIN_ACCOUNTS || "")
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The machine operator's own token proves local access, so it counts as an
 * administrator even when no account name is configured.
 */
export function isLocalOperator(principalId: string): boolean {
  return principalId === "local-user";
}

export function isAdmin(principal: { id: string; username?: string }): boolean {
  if (isLocalOperator(principal.id)) return true;
  const admins = configuredAdmins();
  if (!admins.length) return false;
  if (principal.username && admins.includes(principal.username.toLowerCase())) return true;
  return admins.includes(principal.id.toLowerCase());
}

export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type AdminOverview = {
  generatedAt: number;
  /** The account names that may open the console on this server. */
  admins: string[];
  accounts: {
    total: number;
    disabled: number;
    list: Array<{
      id: string;
      username: string;
      displayName: string;
      email: string;
      createdAt: string;
      disabled: boolean;
    }>;
  };
  usage: ReturnType<TaskBackend["adminUsageSummary"]>;
  tasks: ReturnType<TaskBackend["adminTaskStats"]>;
  schedules: {
    total: number;
    enabled: number;
    list: ReturnType<TaskBackend["adminSchedules"]>;
  };
  skills: {
    total: number;
    ready: number;
    unavailable: number;
    /** Why a skill cannot run here. */
    unavailableList: Array<{ id: string; name: string; reason: string }>;
  };
  audit: ReturnType<WorkspaceBackend["adminAccountAudit"]>;
};

export class AdminService {
  constructor(
    private accounts: WorkspaceBackend,
    private tasks: TaskBackend,
  ) {}

  /** The whole console in one read. */
  overview(): AdminOverview {
    const accounts = this.accounts.adminAccounts();
    const catalog = runtimeCatalog();
    const unavailable = catalog.filter((skill) => skill.status !== "ready");
    const schedules = this.tasks.adminSchedules();
    return {
      generatedAt: Date.now(),
      admins: configuredAdmins(),
      accounts: {
        total: accounts.length,
        disabled: accounts.filter((account) => account.disabled).length,
        list: accounts,
      },
      usage: this.tasks.adminUsageSummary(),
      tasks: this.tasks.adminTaskStats(),
      schedules: {
        total: schedules.length,
        enabled: schedules.filter((schedule) => schedule.enabled).length,
        list: schedules,
      },
      skills: {
        total: catalog.length,
        ready: catalog.length - unavailable.length,
        unavailable: unavailable.length,
        unavailableList: unavailable.map((skill) => ({
          id: skill.id,
          name: skill.name,
          reason: skill.description.split("。")[0]?.trim() || "执行环境没有接通。",
        })),
      },
      audit: this.accounts.adminAccountAudit(80),
    };
  }

  /** Turn an account off or on. The sessions of a disabled account end. */
  setAccountEnabled(id: string, enabled: boolean) {
    const result = this.accounts.adminSetAccountEnabled(id, enabled);
    if (!result) throw new AdminError("没有这个账号。", 404);
    return result;
  }

  /** Retry a failed task for its owner. */
  retryTask(ownerId: string, taskId: string) {
    const task = this.tasks.retryTask(ownerId, taskId);
    if (!task) throw new AdminError("没有这个任务，或它不是失败状态。", 404);
    return task;
  }

  /** Stop or start a schedule. */
  setScheduleEnabled(ownerId: string, id: string, enabled: boolean) {
    const schedule = this.tasks.adminSetScheduleEnabled(ownerId, id, enabled);
    if (!schedule) throw new AdminError("没有这个定时任务。", 404);
    return schedule;
  }
}
