import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeCreateProject } from '../../src/core/create-project.js';
import { scaffold } from '../../src/core/steps/scaffold.js';
import { dbConfig } from '../../src/core/steps/db-config.js';
import { KIT_IDS, getKit } from '../../src/core/kits.js';
import { StageError } from '../../src/core/errors.js';

const APP_JS = 'module.exports = { shortName: \'x\' };\n';
const PKG = '{ "name": "x" }\n';
const DBS = [ 'sqlite', 'mongodb', 'postgres' ];

function spies() {
  const events = [];
  const logger = {
    info() {},
    warn() {},
    error() {},
    task() {
      return {
        succeed() {},
        fail() {}
      };
    }
  };
  const telemetry = {
    event(name, payload) {
      events.push({
        name,
        payload
      });
    }
  };
  return {
    events,
    logger,
    telemetry
  };
}

describe('core contract — createProject', function () {
  let dir;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-contract-'));
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  // Real scaffold + db-config; clone faked to lay out the kit's structure;
  // install/admin faked (no npm/node spawn).
  function orchestrator(extra = {}) {
    return makeCreateProject({
      clone: async ({ shortName }) => {
        const projectDir = join(dir, shortName);
        const frontend = getKit(extra.kitId).frontend;
        const appRoot = frontend ? join(projectDir, 'backend') : projectDir;
        mkdirSync(appRoot, { recursive: true });
        writeFileSync(join(appRoot, 'app.js'), APP_JS);
        writeFileSync(join(appRoot, 'package.json'), PKG);
        if (frontend) {
          mkdirSync(join(projectDir, 'frontend'), { recursive: true });
        }
        return { projectDir };
      },
      scaffold,
      dbConfig,
      install: async () => {},
      addAdminUser: async () => {},
      ...extra.steps
    });
  }

  it('produces a real project for every kit × db; exactly one success event', async function () {
    for (const kitId of KIT_IDS) {
      for (const dbChoice of DBS) {
        const {
          events, logger, telemetry
        } = spies();
        const shortName = 'p';
        const createProject = orchestrator({ kitId });
        const res = await createProject(
          {
            shortName,
            kitId,
            dbChoice,
            dbUri: dbChoice === 'sqlite' ? undefined : `${dbChoice}://localhost/p`,
            admin: {
              login: 'admin',
              password: 'pw'
            },
            packageManager: 'npm',
            nonInteractive: true,
            confirmedAt: Date.now() - 10
          },
          {
            telemetry,
            logger
          }
        );

        const label = `${kitId}/${dbChoice}`;
        assert.equal(res.ok, true, label);
        assert.equal(res.kitId, kitId, label);
        assert.equal(res.dbChoice, dbChoice, label);
        assert.ok(res.durationMs >= 0, label);
        assert.equal(events.length, 1, label);
        assert.equal(events[0].name, 'install_success', label);

        const { frontend } = getKit(kitId);
        const appRoot = frontend
          ? join(dir, shortName, 'backend')
          : join(dir, shortName);
        const env = join(appRoot, '.env');
        assert.equal(existsSync(env), true, `${label} .env`);
        if (frontend) {
          assert.equal(
            existsSync(join(dir, shortName, 'frontend', '.env')), true,
            `${label} frontend .env`
          );
        }
        rmSync(join(dir, shortName), {
          recursive: true,
          force: true
        });
      }
    }
  });

  const failCases = [
    [ 'scaffold', 'scaffold', 'missing_scaffold_file' ],
    [ 'install', 'dependency_install', 'install_failed' ],
    [ 'dbConfig', 'db_connect', 'db_connect_failed' ],
    [ 'addAdminUser', 'admin', 'admin_user_failed' ]
  ];

  for (const [ stepName, failStage, code ] of failCases) {
    it(`attributes a ${failStage} failure (one install_fail, later steps skipped)`, async function () {
      const {
        events, logger, telemetry
      } = spies();
      const ran = [];
      const trace = (name, fn) => async (...a) => {
        ran.push(name); return fn(...a);
      };
      const createProject = orchestrator({
        kitId: 'apostrophe-essentials',
        steps: {
          scaffold: trace('scaffold', scaffold),
          dbConfig: trace('dbConfig', dbConfig),
          install: trace('install', async () => {}),
          addAdminUser: trace('addAdminUser', async () => {}),
          [stepName]: trace(stepName, async () => {
            throw new StageError(failStage, { code });
          })
        }
      });

      const res = await createProject(
        {
          shortName: 'p',
          kitId: 'apostrophe-essentials',
          dbChoice: 'sqlite',
          admin: {
            login: 'admin',
            password: 'pw'
          },
          packageManager: 'npm',
          nonInteractive: true,
          confirmedAt: Date.now() - 5
        },
        {
          telemetry,
          logger
        }
      );

      assert.equal(res.ok, false);
      assert.equal(res.failStage, failStage);
      assert.equal(res.errorCode, code);
      assert.equal(events.length, 1);
      assert.equal(events[0].name, 'install_fail');
      assert.equal(events[0].payload.failStage, failStage);
      // The failing step is the last that ran.
      assert.equal(ran[ran.length - 1], stepName);
    });
  }
});
