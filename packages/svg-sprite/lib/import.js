const fs = require('fs');
const glob = require('glob');
const axios = require('axios');
const xml2js = require('xml2js');
const _ = require('lodash');

module.exports = function (self) {
  return {
    async importTask () {
      const maps = self.options.maps;

      for (const map of maps) {
        const { data, updatedMap } = await loadMap(map);

        const svgs = await parseMap(data, updatedMap);

        await evaluateForUpsert(svgs);
      }
    }
  };

  async function loadMap(map) {
    const pattern = /(http(s)?)/gi;

    if (pattern.test(map.file)) {
      return loadMapFromUrl(map);

    } else {
      // file is a relative file path
      const base = `${self.apos.rootDir}/modules/@apostrophecms/svg-sprite/public/`;
      const path = base + map.file;

      if (path.includes('*')) {
        return loadMapFromGlob(base, path, map);
      } else {
        return loadMapFromPath(base, path, map);
      }
    }
  }

  async function loadMapFromUrl (map) {
    // file is a full url, load it via axios module
    const response = await axios.get(map.file);

    if (response.status >= 400 && response.status < 500) {
      throw self.apos.error('notfound');
    } else if (response.status !== 200) {
      self.apos.util.error(response);
      throw self.apos.error('error');
    }

    const data = response.data;

    return {
      data,
      updatedMap: map
    };
  }

  async function loadMapFromGlob(base, path, map) {
    const readFile = require('util').promisify(fs.readFile);
    const asyncGlob = require('util').promisify(glob);
    const files = await asyncGlob(path);

    if (files.length) {
      const data = await readFile(files[0]);

      // Get the path relative to the module's public folder
      const file = files[0].substring(base.length);
      // Correct map.file to point to the current actual file,
      map.file = file;

      map.finalFile = `${self.apos.asset.getAssetBaseUrl()}/modules/@apostrophecms/my-svg-sprite/${file}`;

      return {
        data,
        updatedMap: map
      };

    } else {
      self.apos.util.error(path + ' does not match anything, cannot continue');
      return {
        data: null,
        updatedMap: map
      };
    }
  }

  async function loadMapFromPath(base, path, map) {
    const readFile = require('util').promisify(fs.readFile);
    if (fileExists(path)) {
      // TODO: Should this be using the my- prefix?
      map.finalFile = `${self.apos.asset.getAssetBaseUrl()}/modules/@apostrophecms/my-svg-sprite/${map.file}`;

      const data = await readFile(path);

      return {
        data,
        updatedMap: map
      };

    } else {
      self.apos.util.error(path + ': no path provided, cannot continue');
      return {
        data: null,
        updatedMap: map
      };
    }
  }

  async function parseMap(xml = '', map = {}) {
    const parseString = require('util').promisify(xml2js.parseString);

    const svgs = [];
    const result = await parseString(xml);

    let symbols = findInObj(result, 'symbol');

    if (!symbols.length) {
      self.apos.util.error('Could not find an array of <symbol> elements in map ' + map.label);

      throw self.apos.error('invalid');
    }

    if (symbols[0] && symbols[0].symbol) {
      symbols = symbols[0].symbol;
    } else {
      self.apos.util.error('Error occurred parsing array of symbols in map ' + map.label);

      throw self.apos.error('error');
    }

    symbols.forEach(function (symbol) {
      if (symbol.$.id) {
        svgs.push({
          symbol: symbol.$,
          file: map.finalFile || map.file,
          map: map.name
        });
      } else {
        self.apos.util.error('SVG is malformed or has no ID property');

        throw self.apos.error('invalid');
      }
    });

    return svgs;

  }

  async function evaluateForUpsert(svgs) {
    const req = self.apos.task.getReq();

    for (const svg of svgs) {

      const docs = await self.find(req, {
        svgId: svg.symbol.id
      }, {}).toArray();

      if (docs.length) {
        // i have a doc, update it
        await updatePiece(req, docs[0], svg);
      } else {
        // i don't have a doc, insert it
        await insertPiece(svg);
      }
    }
  }

  async function insertPiece(svg) {
    const req = self.apos.task.getReq();
    const piece = self.newInstance();

    if (svg.symbol.title) {
      piece.title = self.apos.launder.string(svg.symbol.title);
    } else {
      piece.title = self.apos.launder.string(svg.symbol.id);
    }

    piece.svgId = svg.symbol.id;
    piece.file = svg.file;
    piece.map = svg.map;

    await self.insert(req, piece);
  }

  async function updatePiece(req, doc, svg) {
    const updatedDoc = await self.findOneForEditing(req, { _id: doc._id });

    if (svg.symbol.title) {
      updatedDoc.title = self.apos.launder.string(svg.symbol.title);
    } else {
      updatedDoc.title = self.apos.launder.string(svg.symbol.id);
    }

    updatedDoc.file = svg.file;
    updatedDoc.map = svg.map;

    await self.update(req, updatedDoc);
  }

  function fileExists(path) {
    if (fs.existsSync(path)) {
      return true;
    } else {
      return false;
    }
  }

  function findInObj(obj, key) {

    if (_.has(obj, key)) {
      return [ obj ];
    }

    return _.flatten(_.map(obj, function (v) {
      return typeof v === 'object' ? findInObj(v, key) : [];
    }), true);
  }
};
