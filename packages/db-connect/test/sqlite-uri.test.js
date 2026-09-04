/* global describe, it, after */
const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite = require('../adapters/sqlite');

const { uriToPath } = sqlite;

// A sqlite URI carries a filesystem path, not a URL. These cases pin the
// distinction: the parse must hand back exactly the path that went in, on
// every platform, whatever characters it contains.
describe('sqlite adapter — URI to path', function() {

  describe('POSIX', function() {
    const posix = (uri) => uriToPath(uri, 'linux');

    it('absolute path: the empty-authority form', function() {
      expect(posix('sqlite:///home/jane/site/data/site.sqlite'))
        .to.equal('/home/jane/site/data/site.sqlite');
    });

    it('relative path', function() {
      expect(posix('sqlite://data/site.sqlite')).to.equal('data/site.sqlite');
    });

    it('preserves case: a relative path is not a hostname', function() {
      // url.hostname lowercases, which would send this to Data/ -> data/.
      expect(posix('sqlite://Data/Site.sqlite')).to.equal('Data/Site.sqlite');
    });

    it('leaves a drive-letter-shaped POSIX path alone', function() {
      // A directory literally named "C:" is legal here, so the Windows
      // leading-slash fixup must not fire.
      expect(posix('sqlite:///C:/odd/site.sqlite')).to.equal('/C:/odd/site.sqlite');
    });
  });

  describe('Windows', function() {
    const win = (uri) => uriToPath(uri, 'win32');

    it('absolute drive path with backslashes', function() {
      // The regression: as a URL this is host "C" with port "\Users\...",
      // which throws ERR_INVALID_URL before the adapter sees a path at all.
      expect(win('sqlite://C:\\Users\\jane\\site\\data\\site.sqlite'))
        .to.equal('C:\\Users\\jane\\site\\data\\site.sqlite');
    });

    it('absolute drive path with forward slashes', function() {
      expect(win('sqlite://C:/Users/jane/site/data/site.sqlite'))
        .to.equal('C:/Users/jane/site/data/site.sqlite');
    });

    it('file:// spelling of a drive path drops the leading slash', function() {
      // Windows resolves /C:/Users to \C:\Users, and "C:" is not a legal
      // directory name, so the slash pathToFileURL adds has to come back off.
      expect(win('sqlite:///C:/Users/jane/site/data/site.sqlite'))
        .to.equal('C:/Users/jane/site/data/site.sqlite');
    });

    it('UNC path', function() {
      expect(win('sqlite://\\\\server\\share\\site\\data.sqlite'))
        .to.equal('\\\\server\\share\\site\\data.sqlite');
    });

    it('relative path is untouched by the drive fixup', function() {
      expect(win('sqlite://data/site.sqlite')).to.equal('data/site.sqlite');
    });
  });

  describe('characters a URL parser would mangle', function() {
    for (const [ label, dbPath ] of [
      [ 'a space', '/home/jane/My Project/data/site.sqlite' ],
      [ 'a literal percent', '/home/jane/100%/data/site.sqlite' ],
      [ 'a hash', '/home/jane/site#2/data/site.sqlite' ],
      [ 'a question mark', '/home/jane/really?/data/site.sqlite' ],
      [ 'non-ASCII', '/home/jané/sitio/data/site.sqlite' ]
    ]) {
      it(`passes through ${label}`, function() {
        expect(uriToPath(`sqlite://${dbPath}`, 'linux')).to.equal(dbPath);
      });
    }
  });
});

describe('sqlite adapter — connect', function() {
  const dirs = [];

  after(function() {
    for (const dir of dirs) {
      fs.rmSync(dir, {
        recursive: true,
        force: true
      });
    }
  });

  it('creates the database under a path containing a space', async function() {
    // Percent-encoding used to turn "My Project" into "My%20Project" here,
    // and since connect() mkdirs the dirname, the wrong directory was created
    // and the database silently went somewhere nobody would look.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'db-connect-'));
    dirs.push(root);
    const dbPath = path.join(root, 'My Project', 'data', 'site.sqlite');

    const client = await sqlite.connect(`sqlite://${dbPath}`);
    try {
      expect(fs.existsSync(dbPath)).to.equal(true);
      expect(fs.readdirSync(root)).to.deep.equal([ 'My Project' ]);
    } finally {
      await client.close();
    }
  });

  it('rejects :memory: with its own error, not a URL parse failure', async function() {
    // new URL('sqlite://:memory:') throws ERR_INVALID_URL, pre-empting the
    // explanation the adapter means to give.
    let err;
    try {
      await sqlite.connect('sqlite://:memory:');
    } catch (e) {
      err = e;
    }
    expect(err).to.be.an('error');
    expect(err.code).to.not.equal('ERR_INVALID_URL');
    expect(err.message).to.match(/does not support in-memory databases/);
  });
});
