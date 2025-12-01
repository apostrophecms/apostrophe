const fs = require('fs');
const uploadSource = `${__dirname}/upload_tests/`;

module.exports = {
  wipeIt: async function (uploadTarget, apos) {
    deleteFolderRecursive(uploadTarget);

    function deleteFolderRecursive(path) {
      let files = [];
      if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
          const curPath = path + '/' + file;
          if (fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
          } else { // delete file
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(path);
      }
    }

    const db = await apos.db.collection('aposAttachments');

    db.deleteMany({});
  },
  insert: async function (filename, apos) {
    return apos.attachment.insert(apos.task.getReq(), {
      name: filename,
      path: `${uploadSource}${filename}`
    });
  }
};
