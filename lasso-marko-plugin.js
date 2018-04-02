'use strict';

var isDevelopment =
    !process.env.NODE_ENV ||
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'dev';

var callbackify = require('callbackify');
var nodePath = require('path');

module.exports = function(lasso, config) {
    config = config || {};

    var compiler = config.compiler || require('marko/compiler');

    var defaultOutput = compiler.isVDOMSupported ? 'vdom' : 'html';

    var compilerOptions = {
        output: config.output || defaultOutput
    };

    function compile(path) {
        if (!path) {
            throw new Error('"path" is required for a Marko dependency');
        }

        return new Promise((resolve, reject) => {
            if (compiler.compileFileForBrowser) {
                resolve(compiler.compileFileForBrowser(path, compilerOptions));
            } else {
                compiler.compileFile(path, compilerOptions, function (err, code) {
                    if (err) return reject(err);

                    resolve({ code: code });
                });
            }
        });
    }

    lasso.dependencies.registerRequireType('marko', {
        properties: { 'path': 'string' },

        init: callbackify(function(lassoContext) {
            this.path = this.resolvePath(this.path);
            return compile(this.path).then(compiled => this._compiled = compiled);
        }),

        getLastModified: callbackify(function(lassoContext) {
            return new Promise((resolve, reject) => {
                compiler.getLastModified(this.path, function (err, data) {
                    return err ? reject(err) : resolve(data);
                });
            });
        }),

        getDependencies: function(lassoContext) {
            return this._compiled.dependencies || [];
        },

        read: function(lassoContext) {
            return (this._compiled && this._compiled.code) || null;
        }
    });

    lasso.dependencies.registerPackageType('marko-dependencies', {
        properties: { 'path': 'string' },

        init: callbackify(function(lassoContext) {
            this.path = this.resolvePath(this.path);

            if (this.path.endsWith('.marko')) {
                return compile(this.path).then(compiled => this._compiled = compiled);
            }
        }),

        getDependencies: function(lassoContext) {
            if (!this._compiled) {
                return [];
            }

            var meta = this._compiled.meta;
            var dependencies = [];

            if (meta.component) {
                dependencies = dependencies.concat({
                    type:'require',
                    run: true,
                    virtualModule: getVirtualModule({
                        path: this.path + '.register.js',
                        code: `require('marko/components').register(
                            '${meta.id}',
                            require('${meta.component}')
                        );`
                    })
                });
            } else {
                if (meta.deps) {
                    dependencies = dependencies.concat(meta.deps.map(dep => (
                        dep.code ? {
                            type: dep.type,
                            code: dep.code 
                        } : {
                            type: dep.includes(':') ? dep.slice(0, dep.indexOf(':')) : 'require',
                            path: this.resolvePath(dep, nodePath.dirname(this.path))
                        }
                    )));
                }

                if (meta.tags) {
                    // we need to also include the dependencies of
                    // any tags that are used by this template
                    dependencies = dependencies.concat(meta.tags.map(tagPath => ({
                        type: 'marko-dependencies',
                        path: this.resolvePath(tagPath, nodePath.dirname(this.path))
                    })));
                }
            }

            return dependencies;
        },

        calculateKey () {
            return 'marko-dependencies:'+this.path;
        }
    });

    lasso.dependencies.registerPackageType('marko-hydrate', {
        properties: { 'path': 'string' },

        init: callbackify(function(lassoContext) {
            this.path = this.resolvePath(this.path);
            return compile(this.path).then(compiled => this._compiled = compiled);
        }),

        getDependencies: function() {
            return [
                {
                    type: 'marko-dependencies',
                    path: require.resolve(this.resolvePath(this.path))
                },
                {
                    type: 'require',
                    run: true,
                    virtualModule: getVirtualModule({
                        path: this.path + '.init.js',
                        code: `window.$initComponents && window.$initComponents()`
                    })
                }
            ];
        },

        calculateKey () {
            return 'marko-hydrate:'+this.path;
        }
    });
};

function getVirtualModule(module) {
    var virtualPath = module.path;
    var code = module.code;
    return {
        path: virtualPath,
        read: function(_, callback) {
            if (callback) {
                callback(null, code);
            } else {
                return code;
            }
        },
        getDefaultBundleName: function(_, __) {
            return virtualPath;
        }
    }
}