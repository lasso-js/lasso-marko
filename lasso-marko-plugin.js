'use strict';

var minprops = require('minprops');

var isDevelopment =
    !process.env.NODE_ENV ||
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'dev';

function compileForServer (context, markoCompiler, compilerOptions, callback) {
    markoCompiler.compileFile(context.path, compilerOptions, function (err, code) {
        if (err) {
            return callback(err);
        }

        context._compiled = {
            code: code
        };

        callback();
    });
}

module.exports = function(lasso, config) {
    config = config || {};

    var minpropsEnabled = config.minpropsEnabled;
    if (minpropsEnabled == null) {
        minpropsEnabled = !isDevelopment;
    }

    var markoCompiler = config.compiler || require('marko/compiler');

    var defaultOutput = markoCompiler.isVDOMSupported ? 'vdom' : 'html';

    var compilerOptions = {
        output: config.output || defaultOutput
    };

    lasso.dependencies.registerRequireType(
        'marko',
        {
            properties: {
                'path': 'string'
            },

            init: function (lassoContext, callback) {
                if (!this.path) {
                    throw new Error('"path" is required for a Marko dependency');
                }

                this.path = this.resolvePath(this.path);

                if (markoCompiler.compileFileForBrowser) {
                    this._compiled = markoCompiler.compileFileForBrowser(this.path, compilerOptions);

                    if (callback) {
                        callback();
                    }
                } else {
                    if (callback) {
                        compileForServer(this, markoCompiler, compilerOptions, callback);
                    } else {
                        return new Promise((resolve, reject) => {
                            compileForServer(this, markoCompiler, compilerOptions, function (err) {
                                return err ? reject(err) : resolve();
                            });
                        });
                    }
                }
            },

            getDependencies: function(lassoContext) {
                return this._compiled.dependencies || [];
            },

            read: function(lassoContext) {
                return (this._compiled && this._compiled.code) || null;
            },

            getLastModified: function(lassoContext, callback) {
                if (callback) {
                    markoCompiler.getLastModified(this.path, callback);
                } else {
                    return new Promise((resolve, reject) => {
                        markoCompiler.getLastModified(this.path, function (err, data) {
                            return err ? reject(err) : resolve(data);
                        });
                    });
                }
            }
        });

    if (minpropsEnabled) {
        lasso.addTransform({
            contentType: 'js',

            name: module.id,

            stream: false,

            transform: function(code, lassoContext) {
                var filename = lassoContext.path || lassoContext.filename || lassoContext.dir;
                if (!filename) {
                    return code;
                }

                return minprops(code, filename);
            }
        });
    }
};
