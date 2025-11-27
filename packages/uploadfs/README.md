# uploadfs

<a href="https://apostrophecms.com/"><img src="https://raw.github.com/apostrophecms/uploadfs/master/logos/logo-box-madefor.png" align="right" /></a>

uploadfs copies files to a web-accessible location and provides a consistent way to get the URLs that correspond to those files. uploadfs can also resize, crop and autorotate uploaded images. uploadfs includes S3-based, Azure-based, GCS-based and local filesystem-based backends and you may supply others. The API offers the same conveniences with both backends, avoiding the most frustrating features of each:

* Parent directories are created automatically as needed (like S3 and Azure)
* Content types are inferred from file extensions (like the filesystem)
* Files are by default marked as readable via the web (like a filesystem + web server)
* Images can be automatically scaled to multiple sizes
* Images can be cropped
* Images are automatically rotated if necessary for proper display on the web (i.e. iPhone photos with rotation hints are right side up)
* Image width, image height and correct file extension are made available to the developer
* Non-image files are also supported
* Web access to files can be disabled and reenabled
* GIF is supported, including animation, with full support for scaling and cropping
* On fire about minimizing file sizes for your resized images? You can plug in `imagemin` and compatible tools using the `postprocessors` option.

You can also remove a file if needed.

It is possible to copy a file back from uploadfs, but there is no API to retrieve information about files in uploadfs. This is intentional. *Constantly manipulating directory information is much slower in the cloud than on a local filesystem and you should not become reliant on it.* Your code should maintain its own database of file information if needed, for instance in a MongoDB collection. Copying the actual contents of the file back may occasionally be needed however and this is supported.

## Requirements

You need:

* A "normal" filesystem in which files stay put forever, *OR* Amazon S3, *OR* Microsoft Azure, *OR* Google Cloud Platform OR a willingness to write a backend for something else (look at `s3.js`, `azure.js` and `local.js` for examples; just supply an object with the same methods, you don't have to supply a factory function).

* Most modern macOS, Windows and Linux systems running Node.js >= 12.13.0 do not require any additional install or runtime dependencies. They will automatically use `sharp`, which is extremely fast. Systems not meeting these qualifications can still use this module if `imagemagick` is installed on the system. You can also write a backend for something else (look at `sharp.js` or `imagemagick.js` for examples); just supply an object with the same methods, you don't have to supply a factory function.

* If you need to use `imagemagick` and want faster GIF support: you'll need [gifsicle](https://www.lcdf.org/gifsicle/). It is an optional tool that processes large animated GIFs much faster. This package is not necessary with Sharp. Turn it on with the `gifsicle: true` option when calling `init`. Of course you must install `gifsicle` to use it. (Hint: your operating system probably has a package for it. Don't compile things.)

* A local filesystem in which files stay put at least during the current request, to hold temporary files for Sharp's conversions. This is no problem with Heroku and most other cloud servers. It's just long-term storage that needs to be in S3 or Azure for some of them.

> Note that Heroku includes Imagemagick. You can also install it with `apt-get install imagemagick` on Ubuntu servers. Homebrew can install `imagemagick` on Macs.

## API Overview

* The `init` method passes options to the backend and invokes a callback when the backend is ready.

* The optional `destroy(callback)` method releases any resources such as file descriptors and timeouts held by `uploadfs`.

* The `copyIn` method takes a local filename and copies it to a path in uploadfs. (Note that Express conveniently sets us up for this by dropping file uploads in a temporary local file for the duration of the request.)

* The `copyImageIn` method works like `copyIn`. In addition, it also copies in scaled versions of the image, corresponding to the sizes you specify when calling `init()`. Information about the image is returned in the second argument to the callback.

* If you wish to crop the image, pass an options object as the third parameter to `copyImageIn`. Set the `crop` property to an object with `top`, `left`, `width` and `height` properties, all specified in pixels. These coordinates are relative to the original image. **When you specify the `crop` property, both the "full size" image copied into uploadfs and any scaled images are cropped.** The uncropped original is NOT copied into uploadfs. If you want the uncropped original, be sure to copy it in separately. The `width` and `height` properties of the `info` object passed to your callback will be the cropped dimensions.

* The default JPEG quality setting for scaled-down versions of your image is `80`. This avoids unacceptably large file sizes for web deployment. You can adjust this via the `scaledJpegQuality` option, either when initializing uploadfs or when calling `copyImageIn`.

* If you do not wish to always use the same set of image sizes, you may pass a `sizes` property as part of the options object when calling `copyImageIn`.

* The `copyOut` method takes a path in uploadfs and a local filename and copies the file back from uploadfs to the local filesystem. This should be used only rarely. Heavy reliance on this method sets you up for poor performance in S3 and Azure. However it may be necessary at times, for instance when you want to crop an image differently later. *Heavy reliance on copyOut is a recipe for bad S3 and/or Azure performance. Use it only for occasional operations like cropping.*

* The `streamOut` method takes a path in uploadfs and returns a readable stream. This should be used only rarely. Heavy reliance on this method sets you up for poor performance in S3 and Azure. However it may be necessary at times, for instance when permissions must be checked on a request-by-request basis in a proxy route. **This method, which is not required for normal use in ApostropheCMS, is currently implemented only in the `local` and `s3` storage backends.** Contributions for Azure and GCS are welcome.

* The `remove` method removes a file from uploadfs.

* The `getUrl` method returns the URL to which you should append uploadfs paths to fetch them with a web browser.

* The `disable` method shuts off web access to a file. Depending on the storage backend it may also block the `copyOut` method, so you should be sure to call `enable` before attempting any further access to the file.

* The `enable` method restores web access to a file.

* The `getImageSize` method returns the currently configured image sizes.

* The `identifyLocalImage` method provides direct access to the `uploadfs` functionality for determining the extension, width, height and orientation of images. Normally `copyIn` does everything you need in one step, but this method is occasionally useful for migration purposes.

The `destroy` method releases any resources such as file descriptors or timeouts that may be held by the backends, and then invokes its callback. Its use is optional, but command line Node apps might never exit without it.

## Working Example

For a complete, very simple and short working example in which a user uploads a profile photo, see `sample.js`.

Here's the interesting bit. Note that we do not supply an extension for the final image file, because we want to have Sharp figure that out for us.

```javascript
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
```

Note the use of `uploadfs.getUrl()` to determine the URL of the uploaded image. **Use this method consistently and your code will find the file in the right place regardless of the backend chosen.**

## Retrieving Information About Images

When you successfully copy an image into uploadfs with copyImageIn, the second argument to your callback has the following useful properties:

`width` (already rotated for the web if necessary, as with iPhone photos)

`height` (already rotated for the web if necessary, as with iPhone photos)

`originalWidth` (not rotated)

`originalHeight` (not rotated)

`extension` (`gif`,`jpg`, `webp` or `png`)

You should record these properties in your own database if you need access to them later.

**When cropping, the uncropped size of the original image is not returned by uploadfs. It is assumed that if you are cropping you already know what the original dimensions were.**

The same information is available via `identifyLocalImage` if you want to examine a local file before handing it off to `copyImageIn`.

## Removing Files

Here's how to remove a file:

```javascript
uploadfs.remove('/profiles/me.jpg', function(e) { ... });
```

## Disabling Access To Files

This call shuts off **web access** to a file:

```javascript
uploadfs.disable('/profiles/me.jpg', function(e) { ... });
```

And this call restores it:

```javascript
uploadfs.enable('/profiles/me.jpg', function(e) { ... });
```

*Depending on the backend, `disable` may also block the copyOut method*, so be sure to call `enable` before attempting any further access to the file.

*With the local storage backend, `disable` uses permissions `000` by default.* This is a big hassle if you want to be able to easily use rsync to move the files outside of `uploadfs`. **As an alternative, you can set the `disabledFileKey` option to a random string.** If you do this, uploadfs will *rename* disabled files based on an HMAC digest of the filename and the `disabledFileKey`. This is secure from the webserver's point of view, **as long as your webserver is not configured to display automatic directory listings of files**. But from your local file system's point of view, the file is still completely accessible. And that makes it a lot easier to use `rsync`.

*With the `azure` storage backend, you MUST set `disabledFileKey`.* This is because Azure provides no way to alter the permissions of a single blob (file). Our only option is to copy the blob to a new, cryptographically unguessable name and remove the old one while it is "disabled," then reverse the operation when it is enabled again.

For your convenience in the event you should lose your database, the filenames generated still begin with the original filename. The presence of a cryptographically un-guessable part is enough to make them secure.

Those using `local` storage can change their minds about using `disabledFileKey`. use `uploadfs.migrateToDisabledFileKey(callback)` to migrate your existing disabled files to this approach, and `uploadfs.migrateFromDisabledFileKey(callback)` to migrate back. Before calling the former, add the option to your configuration. Before calling the latter, remove it.

## Configuration Options

Here are the options we pass to `init()` in `sample.js`. Note that we define the image sizes we want the `copyImageIn` function to produce. No image will be wider or taller than the limits specified. The aspect ratio is always maintained, so one axis will often be smaller than the limits specified. Here's a hint: specify the width you really want, and the maximum height you can put up with. That way only obnoxiously tall images will get a smaller width, as a safeguard.
```javascript
{
  storage: 'local',
  // Optional. If not specified, Sharp will be used with automatic
  // fallback to Imagemagick.
  image: 'sharp',
  // Options are 'sharp' and 'imagemagick', or a custom image
  // processing backend
  uploadsPath: __dirname + '/public/uploads',
  uploadsUrl: 'http://localhost:3000' + uploadsLocalUrl,
  // Required if you use copyImageIn
  // Temporary files are made here and later automatically removed
  tempPath: __dirname + '/temp',
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
  ],
  // Render up to 4 image sizes at once. Note this means 4 at once per call
  // to copyImageIn. There is currently no built-in throttling of multiple calls to
  // copyImageIn
  parallel: 4,
  // Optional. See "disabling access to files," above
  // disabledFileKey: 'this should be a unique, random string'
}
```

Here is an equivalent configuration for S3:

```javascript
{
  storage: 's3',
  // Add an arbitrary S3 compatible endpoint
  endpoint: 's3-compatible-endpoint.com',
  // Get your credentials at aws.amazon.com
  secret: 'xxx',
  key: 'xxx',
  // You need to create your bucket first before using it here
  // Go to aws.amazon.com
  bucket: 'getyourownbucketplease',
  // For read-after-write consistency in the US East region.
  // You could also use any other region name except us-standard
  region: 'external-1',
  // Required if you use copyImageIn, or use Azure at all
  tempPath: __dirname + '/temp',
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
  ],
  // Render up to 4 image sizes at once. Note this means 4 at once per call
  // to copyImageIn. There is currently no built-in throttling of multiple calls to
  // copyImageIn
  parallel: 4
}
```

And, an equivalent configuration for Azure:

```javascript
{
  storage: 'azure',
  account: 'storageAccountName',
  container: 'storageContainerName',
  // If set to true, uploadfs will consider `key` to be a
  // SAS token. Otherwise, it will be considered an access key.
  // Default is false.
  sas: false,
  key: 'accessKeyOrSASToken',
  disabledFileKey: 'a random string of your choosing',
  // Always required for Azure
  tempPath: __dirname + '/temp',
  // by default we gzip encode EVERYTHING except for a short list of excpetions, found in defaultGzipBlacklist.js
  // if for some reason you want to enable gzip encoding for one of these types, you can
  // you can also add types to ignore when gzipping
  gzipEncoding: {
    'jpg': true,
    'rando': false
  },
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
  ],
  // Render up to 4 image sizes at once. Note this means 4 at once per call
  // to copyImageIn. There is currently no built-in throttling of multiple calls to
  // copyImageIn
  parallel: 4
}
```

With Azure you may optionally replicate the content across a cluster:

```javascript
{
  storage: 'azure',
  replicateClusters: [
    {
      account: 'storageAccountName1',
      container: 'storageContainerName1',
      key: 'accessKey1'
    },
    {
      account: 'storageAccountName2',
      container: 'storageContainerName2',
      sas: true,
      key: 'sharedAccessSignature'
    }
  ],
  ...
}
```

And, an equivalent configuration for Google Cloud Storage:

```javascript
{
      storage: 'gcs',
      // Go to the Google Cloud Console, select your project and select the Storage item on the left side of the screen to find / create your bucket. Put your bucket name here.
      bucket: 'getyourownbucketplease',
      // Select your region
      region: 'us-west-2',
      // Required if you use copyImageIn, or use Azure at all
      tempPath: __dirname + '/temp',
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
      ],
      // Render up to 4 image sizes at once. Note this means 4 at once per call
      // to copyImageIn. There is currently no built-in throttling of multiple calls to
      // copyImageIn
      parallel: 4
}
```
Note that GCS assumes the presence of a service account file and an environment variable of `GOOGLE_APPLICATION_CREDENTIALS` set pointing to this file. For example:
```sh
export GOOGLE_APPLICATION_CREDENTIALS=./projectname-f7f5e919aa79.json
```

In the above example, the file named `projectname-f7f5e919aa79.json` is sitting in the root of the module

For more information, see [Creating and Managing Service Accounts](https://cloud.google.com/iam/docs/creating-managing-service-account-keys) at cloud.google.com.

> When using Google Cloud Storage, you **must enable object ACLs for the
bucket**. Otherwise you will get this error: "cannot use ACL API to set object policy when object policies are disabled." You have 90 days to do this after first creating a bucket, otherwise you will need to use a new bucket for uploadfs.

## Less Frequently Used Options

* If you are using the `local` backend (files on your server's drive), you might not like that when `disable` is called, the permissions of a file are set to `000` (no one has access). We suggest using the `disabledFileKey` option to completely avoid this issue. However, if you wish, you can pass the `disablePermissions` option. As usual with Unix permissions, this is an OCTAL NUMBER, not a decimal one. Octal constants have been deprecated, so in modern JavaScript it is best to write it like this:
* 
```javascript
// Only the owner can read. This is handy if
// your proxy server serves static files for you and
// shares a group but does not run as the same user
disablePermissions: parseInt("0400", 8)
```

You can also change the permissions set when `enable` is invoked via `enablePermissions`. Keep in mind that `enable()` is not invoked for a brand new file (it receives the default permissions). You might choose to write:

```javascript
// Only the owner and group can read.
enablePermissions: parseInt("0440", 8)
```

* In backends like sharp or imagemagick that support it, even the "original" is rotated for you if it is not oriented "top left," as with some iPhone photos. This is necessary for the original to be of any use on the web. But it does modify the original. So if you really don't want this, you can set the `orientOriginals` option to `false`.

* It is possible to pass your own custom storage module instead of `local` or `s3`. Follow `local.js` or `s3.js` as a model, and specify your backend like this:
* 
```javascript
storage: require('mystorage.js')
```

* You may specify an alternate image processing backend via the `image` option. Two backends, `sharp` and `imagemagick`, are built in. You may also supply an object instead of a string to use your own image processor. Just follow the existing `sharp.js` file as a model.

* In backends like Google Cloud Storage and S3, uploadfs finesses the path so that paths with a leading slash like `/foo/bar.txt` behave reasonably and a double slash never appears in the URL. For Apostrophe this is a requirement. However, if you have your heart set on the double slashes, you can set the `strictPaths` option to `true`.

## Extra features for S3: caching, HTTPS, CDNs, permissions, and No Gzip Content Types

By default, when users fetch files from S3 via the web, the browser is instructed to cache them for 24 hours. This is reasonable, but you can change that cache lifetime by specifying the `cachingTime` option, in seconds:

```javascript
  // 60*60*24*7 = 1 Week
  // Images are delivered with cache-control-header
  cachingTime: 604800
```

S3 file delivery can be set to use the HTTPS protocol with the `https` option. This is essentially necessary if used on a site that uses the secure protocol.

```javascript
  https: true
```

Also, if you are using a CDN such as cloudfront that automatically mirrors the contents of your S3 bucket, you can specify that CDN so that the `getUrl` method of `uploadfs` returns the CDN's URL rather than a direct URL to Amazon S3 or Azure:

```javascript
  cdn: {
    enabled: true,
    url: 'http://myAwesomeCDN'
  }
```

Note that specifying a CDN in this way does not in any way activate that CDN for you. It just tells `uploadfs` to return a different result from `getUrl`. The rest is up to you. More CDN-related options may be added in the future.

If you want to make your S3 bucket private and serve content through the Amazon CloudFront service, you need to set the objects' access control levels (ACL) in the bucket to `private`. By default, the `bucketObjectsACL` option sets the object ACL to `public-read`. You need to change this option to `private` to block public access. Additionally, follow the [documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) to ensure your bucket is set up with an Origin Access Control correctly, otherwise CloudFront will not be able to access it.

There is also a list which contains content types that should not be gzipped for faster delivery from s3. Note that gzip content delivery is completely transparent to the end user and supported by all browsers, so the only types that should be excluded are those that are already compressed (i.e. a waste of CPU to unzip) unless there is an issue with the gzip feature in a particular s3-compatible backend.

You can override this default list by setting the `noGzipContentTypes` option: 

```javascript
  // Don't gzip jpeg and zip files, but gzip everything else (override default list)
  noGzipContentTypes: ['image/jpeg', 'application/zip'] 
```

Alternatively you can just extend the standard list of types not to be gzipped by setting `addNoGzipContentTypes`:

```javascript
  // Additionally don't gzip pdf files (append to default list)
  addNoGzipContentTypes: ['application/pdf'] 
```

## Important Concerns With S3

Since 2015, files uploaded to S3 are immediately available in all AWS regions ("read after write consistency"). However, also be aware that no matter what region you choose, updates of an existing file or deletions of a file still won't always be instantly seen everywhere, even if you don't use the `us-standard` region. To avoid this problem, it is best to change filenames when uploading updated versions.

In `sample.js` we configure Express to actually serve the uploaded files when using the local backend. When using the s3 backend, you don't need to do this, because your files are served from S3. S3 URLs look like this:

```html
https://yourbucketname.s3.amazonaws.com/your/path/to/something.jpg
```

But your code doesn't need to worry about that. If you use `uploadfs.getUrl()` consistently, code written with one backend will migrate easily to the other.

It's up to you to create an Amazon S3 bucket and obtain your secret and key. See sample.js for details.

S3 support is based on the official AWS SDK.

## Applying a prefix to paths regardless of storage layer

If you are running several Apostrophe sites that must share an S3 bucket, you'll notice
that their uploads are jumbled together in a single `/attachments` "folder." With
the local storage method, you can address this by specifying an `uploadsPath` that
includes a different prefix for each site, but for S3 or Azure there was previously no good
solution.

Starting with version 1.11.0, you can specify a `prefix` option no matter what the
storage backend is. When you do, `uploadfs` will automatically prepend it to
all uploadfs paths that you pass to it. In addition, the `getUrl` method will
include it as well. So you can use this technique to separate files from several
sites even if they share a bucket in S3 or Azure.

**An important exception:** if you have configured the `cdn` option, `uploadfs` assumes that your cdn's `url` subproperty points to the right place for this individual site. This is necessary because CDNs may have prefix features of their own which remap the URL.

## Postprocessing images: extra compression, watermarking, etc.

It is possible to configure `uploadfs` to run a postprocessor such as `imagemin` on every custom-sized image that it generates. This is intended for file size optimization tools like `imagemin`.

Here is an example based on the `imagemin` documentation:

```javascript
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');

uploadfs.init({
  storage: 'local',
  image: 'sharp',
  tempPath: __dirname + '/temp',
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
    }
  ],
  postprocessors: [
    {
      postprocessor: imagemin,
      extensions: [ 'gif', 'jpg', 'png' ],
      options: {
        plugins: [
          imageminJpegtran(),
          imageminPngquant({quality: '65-80'})
        ]
      }
    }
  ]
});
```

A file will not be passed to a postprocessor unless it is configured for the file's true extension as determined by the image backend (`gif`, `jpg`, `png` etc., never `GIF` or `JPEG`).

The above code will invoke `imagemin` like this:

```javascript
imagemin([ '/temp/folder/file1-small.jpg', '/temp/folder/file2-medium.jpg', ... ], '/temp/folder', {
  plugins: [
    imageminJpegtran(),
    imageminPngquant({quality: '65-80'})
  ]
}).then(function() {
  // All finished
}).catch(function() {
  // An error occurred
});
```

You may write and use other postprocessors, as long as they expect to be called the same way.

> Note that the second argument is always the folder that contains all of the files in the first argument's array. `uploadfs` expects your postprocessor to be able to update the files "in place." All of the files in the first argument will have the same extension.

If your postprocessor expects four arguments, uploadfs will pass a callback, rather than expecting a promise to be returned.

## Participating in development

### Running the unit tests

If you wish to run the unit tests of this module, you will need to copy the various `-sample.js` files to `.js` and edit them to match your own credentials and buckets for the various services. In addition, you will need to download your credentials `.json` file for Google Cloud Services and place it in `gcs-credentials-uploadfstest.json`. *None of these steps are needed unless you are running our module's unit tests, which only makes sense if you are contributing to further development.*

## About P'unk Avenue and Apostrophe

`uploadfs` was created at [P'unk Avenue](https://punkave.com) for use in many projects built with Apostrophe, an open-source content management system built on node.js. Appy isn't mandatory for Apostrophe and vice versa, but they play very well together. If you like `uploadfs` you should definitely [check out apostrophecms.com](https://apostrophecms.com). Also be sure to visit us on [github](http://github.com/apostrophecms).

## Support

Feel free to open issues on [github](http://github.com/apostrophecms/uploadfs).

<a href="https://punkave.com/"><img src="https://raw.github.com/apostrophecms/uploadfs/master/logos/logo-box-builtby.png" /></a>
