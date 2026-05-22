// Headless orchestrator. Preflight (supported pm) + steps. Resolves a structured
// CreateProjectResult and emits exactly one terminal telemetry event.
// Never calls process.exit; expected failures resolve (ok:false),
// unexpected throws propagate to the caller (which converts + emits).

import { getKit } from './kits.js';
import { detectPackageManager, assertSupportedPackageManager } from './pm.js';
import { StageError, UnsupportedPackageManagerError } from './errors.js';
import { checkConnection, dropDatabase } from './db.js';
import { clone as realClone } from './steps/clone.js';
import { scaffold as realScaffold } from './steps/scaffold.js';
import { install as realInstall } from './steps/install.js';
import { dbConfig as realDbConfig } from './steps/db-config.js';
import { addAdminUser as realAddAdminUser } from './steps/admin-user.js';
import { importSampleData as realImportSampleData } from './steps/sample-data.js';

/**
 * Internal factory so steps can be substituted in unit tests. The public
 * {@link createProject} binds the real steps; the (options, deps) contract is
 * unchanged — the step set is not part of it.
 */
export function makeCreateProject({
  clone, scaffold, install, dbConfig, addAdminUser, importSampleData
}) {
  return async function createProject(options, deps) {
    const { telemetry, logger } = deps;
    const echo = {
      kitId: options.kitId,
      dbChoice: options.dbChoice
    };

    // Single terminal point: build the result, emit exactly one event, return.
    const finish = ({
      ok, packageManager, failStage, errorCode
    }) => {
      const result = {
        ok,
        ...echo,
        packageManager,
        durationMs: Date.now() - options.confirmedAt
      };
      if (!ok) {
        result.failStage = failStage;
        if (errorCode) {
          result.errorCode = errorCode;
        }
      }
      const { ok: _ok, ...payload } = result;
      telemetry.event(ok ? 'install_success' : 'install_fail', payload);
      return result;
    };

    // Preflight (before any work). Node version stays a bin/ hard exit.
    const packageManager = options.packageManager || detectPackageManager();
    try {
      assertSupportedPackageManager(packageManager);
    } catch (err) {
      if (err instanceof UnsupportedPackageManagerError) {
        return finish({
          ok: false,
          packageManager,
          failStage: null,
          errorCode: err.errorCode
        });
      }
      throw err;
    }

    // Validation errors (unknown kit, unsafe shortName, …) propagate as
    // unexpected throws — the caller converts and emits.
    const kit = getKit(options.kitId);

    // The task handle is passed to the step fn so long-running steps can
    // report progress (task.progress?.(...)); steps that don't, ignore it.
    const step = async (label, fn) => {
      const task = logger.task(label);
      try {
        const out = await fn(task);
        task.succeed();
        return out;
      } catch (err) {
        task.fail();
        throw err;
      }
    };

    try {
      const { projectDir } = await step('Cloning starter', () =>
        clone({
          repo: kit.repo,
          shortName: options.shortName,
          cwd: options.cwd
        }));

      const { frontend, appRoot } = await step('Configuring project', () =>
        scaffold({
          projectDir,
          shortName: options.shortName,
          frontend: kit.frontend
        }));

      await step('Installing dependencies', () =>
        install({
          projectDir,
          appRoot,
          frontend,
          packageManager
        }));

      await step('Configuring database', () =>
        dbConfig({
          appRoot,
          dbChoice: options.dbChoice,
          dbUri: options.dbUri,
          shortName: options.shortName,
          dbReset: options.dbReset
        }, {
          verifyConnection: checkConnection,
          dropDatabase
        }));

      // Sample-data import runs BEFORE admin-user so a dump containing
      // users can land first and admin creation reconciles against it.
      // Conditional on kit.seedData so it only fires for *-demo-data kits.
      if (kit.seedData) {
        await step('Importing sample content', (task) =>
          importSampleData({
            appRoot,
            dbChoice: options.dbChoice,
            dbUri: options.dbUri,
            shortName: options.shortName
          }, { onProgress: task.progress }));
      }

      const adminOutcome = await step(`Creating ${options.admin.username} account`, () =>
        addAdminUser({
          appRoot,
          username: options.admin.username,
          password: options.admin.password
        }));
      if (adminOutcome === 'updated') {
        logger.muted?.(`User ${options.admin.username} already existed — password updated.`);
      }

      return finish({
        ok: true,
        packageManager
      });
    } catch (err) {
      if (err instanceof StageError) {
        return finish({
          ok: false,
          packageManager,
          failStage: err.stage,
          errorCode: err.errorCode
        });
      }
      throw err;
    }
  };
}

/** @type {import('../index.js').CreateProject} */
export const createProject = makeCreateProject({
  clone: realClone,
  scaffold: realScaffold,
  install: realInstall,
  dbConfig: realDbConfig,
  addAdminUser: realAddAdminUser,
  importSampleData: realImportSampleData
});
