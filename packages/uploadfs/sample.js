// An extremely simple app that accepts uploaded files
// and stores them in either a local folder or s3,
// depending on which backend you choose.

const express = require('express');
const uploadfs = require('uploadfs')();
const multipart = require('connect-multiparty');
const multipartMiddleware = multipart();
const path = require('path');

// For the local backend
const uploadsPath = path.join(__dirname, '/public/uploads');
const uploadsLocalUrl = '/uploads';
const options = {
  backend: 'local',
  uploadsPath,
  uploadsUrl: 'http://localhost:3000' + uploadsLocalUrl,
  // Required if you use imageSizes and copyImageIn
  tempPath: path.join(__dirname, '/temp'),
  imageSizes: [
    {
      name: 'small',
      width: 320,
      height: 320
    },
    {
      name: 'medium',
      width: 640,
      height: 640
    },
    {
      name: 'large',
      width: 1140,
      height: 1140
    }
  ]
};

uploadfs.init(options, createApp);

function createApp(err) {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  const app = express();

  // For the local backend: serve the uploaded files at /uploads.
  // With the s3 backend you don't need this of course, s3 serves
  // the files for you.

  app.use(uploadsLocalUrl, express.static(uploadsPath));

  app.get('/', function(req, res) {
    res.send('<form method="POST" enctype="multipart/form-data">' +
      '<input type="file" name="photo" /> <input type="submit" value="Upload Photo" />' +
      '</form>');
  });

  app.post('/', multipartMiddleware, function(req, res) {
    uploadfs.copyImageIn(req.files.photo.path, '/profiles/me', function(e, info) {
      if (e) {
        res.send('An error occurred: ' + e);
      } else {
        res.send('<h1>All is well. Here is the image in three sizes plus the original.</h1>' +
          '<div><img src="' + uploadfs.getUrl() + info.basePath + '.small.' + info.extension + '" /></div>' +
          '<div><img src="' + uploadfs.getUrl() + info.basePath + '.medium.' + info.extension + '" /></div>' +
          '<div><img src="' + uploadfs.getUrl() + info.basePath + '.large.' + info.extension + '" /></div>' +
          '<div><img src="' + uploadfs.getUrl() + info.basePath + '.' + info.extension + '" /></div>');
      }
    });
  });
  app.listen(3000);
  console.log('Listening at http://localhost:3000');
}
