var assign = require('object-assign');
var fs = require('fs-extra');
var path = require('path');
var url = require('url');
var sanitize = require('sanitize-filename');
var Jimp = require('jimp');
var nameFunctions = require('keystone-storage-namefunctions');
var ensureCallback = require('keystone-storage-namefunctions/ensureCallback');
var prototypeMethods = require('keystone-storage-namefunctions/prototypeMethods');

var debug = require('debug')('coatilabs:storage:adapter:imagefs');


var DEFAULT_OPTIONS = {
    generateFilename: nameFunctions.randomFilename,
    whenExists: 'retry',
    retryAttempts: 3, // For whenExists: 'retry'.
    manageImage: function(file, callback) {
        callback(null, file);
    }
};

function ensurePath (path) {
    // Ensure that the specified path exists and is writable. This is quick and
    // happens on server startup, so sync functions are ok.
    try {
        // accessSync throws if the item doesn't exist or we don't have
        // permission to read + write it.
        fs.accessSync(path, fs.R_OK | fs.W_OK);

        if (!fs.statSync(path).isDirectory()) {
            throw Error('Specified output path is not a directory');
        }
    } catch (e) {
        if (e.code === 'ENOENT') {
            // Recover by creating the directory.
            fs.mkdirsSync(path);
            debug('Storage output path \'' + path + '\' created');
            return;
        }
        throw e;
    }
}

function FSImageAdapter (options, schema) {
    if (!schema.filename) throw Error('Cannot use FSImageAdapter without storing filename');

    this.options = assign({}, DEFAULT_OPTIONS, options.imagefs);
    debug('Initialising FSImageAdapter with options', this.options);

    this.options.generateFilename = ensureCallback(this.options.generateFilename);

    if (typeof this.options.manageImage !== "function") 
        throw Error('manageImage must be a function');
    this.manageImage = this.options.manageImage;

    ensurePath(this.options.path);
}

FSImageAdapter.compatibilityLevel = 1;

// All the extra schema fields supported by this adapter.
FSImageAdapter.SCHEMA_TYPES = {
    // This adapter stores its key in the name of a file on disk.
    filename: String,
};

FSImageAdapter.SCHEMA_FIELD_DEFAULTS = {
    filename: true,
};

FSImageAdapter.prototype.getFilename = prototypeMethods.getFilename;
FSImageAdapter.prototype.retryFilename = prototypeMethods.retryFilename;

/**
    Gets the public path of a stored file by combining the publicPath option
    with the filename in the field value
*/
FSImageAdapter.prototype.getFileURL = function (file) {
    var publicPath = this.options.publicPath;
    if (!publicPath) return null; // No URL.

    return url.resolve(publicPath, file.filename);
};

/**
    Private function for getting the on-disk filename
*/
FSImageAdapter.prototype.pathForFile = function (filename) {
    return path.resolve(this.options.path, sanitize(filename));
};

/**
    Uploads a file at the specified path and returns the value to be stored
    in the field value. The file argument must be an object as per the [multer
    file information spec](https://github.com/expressjs/multer#file-information)
*/
FSImageAdapter.prototype.uploadFile = function (file, callback) {
    var self = this;
    debug('Uploading file', file);
    var options = self.options;
    self.getFilename(file, function (err, filename) {
        if (err) return callback(err);
        filename = sanitize(filename);
        debug('Uploading file with filename: %s', filename);
        var uploadPath = path.resolve(options.path, filename);
        var fsOptions = {};
        fsOptions.clobber = options.whenExists === 'overwrite';

        Jimp.read(file.path, function (err, workingfile) {
            if (err) return callback(err);
            self.manageImage(workingfile, function(err, filetosave) {
                if (err) return callback(err);
                filetosave.write(file.path, function(){
                    fs.move(file.path, uploadPath, fsOptions, function (err) {
                        // TODO: Chmod the file.
                        var data = {
                            filename: filename,
                            size: file.size,
                            mimetype: file.mimetype,
                            path: options.path,
                            originalname: file.originalname,
                        };
                        debug('Uploaded file, returning data', data);
                        callback(null, data);
                    });
                });
            });
        });


    
    });
};

FSImageAdapter.prototype.removeFile = function (file, callback) {
    debug('Removing file', file);
    fs.unlink(this.pathForFile(file.filename), function (err) {
        if (err && err.code === 'ENOENT') {
            // The file doesn't exist.
            console.warn('Attempted to remove a non-existant file');
            return callback();
        }

        callback(err);
    });
};

FSImageAdapter.prototype.fileExists = function (filename, callback) {
    var path = this.pathForFile(filename);
    debug('Checking for file at path %s', filename);
    // Returns (err, bool) to the callback based on whether or not the file
    // already exists. Used if whenExists: 'error' or 'retry' in the options
    fs.stat(path, function (err, stats) {
        if (err && err.code === 'ENOENT') {
            // File does not exist
            callback(null, false);
        } else if (err) {
            // Other error getting file info
            callback(err);
        } else if (stats.isFile()) {
            // File does exist
            callback(null, true);
        } else {
            // Object at path is not a file
            callback(Error('Invalid save destination - dest is not a file'));
        }
    });
};

module.exports = FSImageAdapter;
