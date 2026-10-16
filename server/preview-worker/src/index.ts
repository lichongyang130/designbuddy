import { loadWorkerConfig } from "./config";
import { createPreviewWorkerServer } from "./server";

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const app = createPreviewWorkerServer(config);
  const removed = await app.manager.cleanupOrphans();
  if (removed > 0) {
    process.stdout.write("Cleaned " + removed + " orphaned preview container(s).\n");
  }

  await app.listen();
  process.stdout.write(
    "DesignBuddy preview worker listening on " + config.host + ":" + config.port + "\n"
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write("Received " + signal + "; stopping preview sessions.\n");
    const forceExit = setTimeout(() => process.exit(1), 15000);
    forceExit.unref();

    try {
      await app.close();
      await app.manager.stopAll();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      process.stderr.write(
        "Preview worker shutdown failed: " +
        (error instanceof Error ? error.message : "unknown error") + "\n"
      );
      process.exit(1);
    }
  };

  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
}

main().catch((error: unknown) => {
  process.stderr.write(
    "Preview worker failed to start: " +
    (error instanceof Error ? error.message : "unknown error") + "\n"
  );
  process.exitCode = 1;
});
