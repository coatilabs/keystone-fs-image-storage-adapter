# Jimp based image storage adapter for KeystoneJS

Keystone Storage Adapter to help you to manage an image document with [Jimp](https://github.com/oliver-moran/jimp) tool


# S3-based 

This adapter is designed to manipulate images after upload with Jimp tool in KeystoneJS using the storage API.

Tested in Node.js 6.12.2

## Usage

Configure the storage adapter:

```js

var storage = new keystone.Storage({
    adapter: require('keystone-fs-image-storage-adapter'),
    imagefs: {
        path: keystone.expandPath('./uploads'), // required; path where the files should be stored
        publicPath: '/uploads', // path where files will be served,
        manageImage: function(file, callback) {
            // Here you can manipulate file
            callback(null, file);
        }
    }
});
```

Then use it as the storage provider for a File field:

```js
File.add({
  name: { type: String },
  file: { type: Types.File, storage: storage },
});
```


### Options

The adapter requires an additional `fs` field added to the storage options. it accepts the following values:

- **path**: _(string; required)_ Path the files will be stored at on disk

- **generateFilename**: _(function; default: random filename)_ Method to generate a filename for the uploaded file. Gets passed the `file` data, the attempt number and the callback to call with the filename.
  - See [`keystone-storage-namefunctions`](http://npm.im/keystone-storage-namefunctions) for additional filename generators, including content hash filename and original filename. See its source for more information on how to write your own.

- **manageImage**: _(function; default: copies same file)_ Method to manipulate your image file
  - See [`Jimp`](https://github.com/oliver-moran/jimp) for additional  documentation.


- **whenExists**: _(string; default: 'retry')_ Specifies what to do when the file exists already. Can be one of `'retry'`, `'error'` or `'overwrite'`.

- **retryAttempts**: _(number; default: 3)_ If `whenExists` is set to `'retry'`, how many times keystone should try to generate a unique filename before returning an error

- **publicPath**: _(string)_ Optional path the files will served from by the webserver


### Schema

The FS adapter supports all the default Keystone file schema fields. It also additionally supports and enables the `filename` path (required).

```JS
{
    filename: String,
}
```


# License

Licensed under the standard MIT license. See [LICENSE](license).
