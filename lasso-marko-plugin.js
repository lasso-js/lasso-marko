'use strict';

var callbackify = require('callbackify');
var nodePath = require('path');
var lassoVersion = require('lasso/package').version.split('.');
var markoVersion = require('marko/package').version.split('.');

// marko package types are supported with lasso >= 3 and marko >= 4.7
var isPackageTypesSupported = lassoVersion[0] >= 3 && (markoVersion[0] > 4 || (markoVersion[0] == 4 && markoVersion[1] >= 7));
var isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

module.exports = function(lasso, config) {
    config = config || {};

    var compiler = config.compiler || require('marko/compiler');

    var defaultOutput = compiler.isVDOMSupported ? 'vdom' : 'html';

    var lassoConfig = lasso.config.rawConfig;
    var compilerOptions = {
        output: config.output || defaultOutput,
        babelConfig: config.babelConfig,
        sourceMaps: !(lassoConfig.bundlingEnabled || lassoConfig.minify) && 'inline',
        cache: new Map(),
        modules: 'cjs'
    };

    var sharedCache;
    if (config.useCache) {
        sharedCache = new Map();
    } else {
        sharedCache = new WeakMap();
        lasso.on('afterLassoPage', ({ context }) => {
            sharedCache.delete(context);
        });
    }

    function compile(path, lassoContext) {
        if (!path) {
            throw new Error('"path" is required for a Marko dependency');
        }

        var cache;

        if (config.useCache) {
            cache = sharedCache;
        } else {
            cache = sharedCache.get(lassoContext);

            if (!cache) {
                sharedCache.set(lassoContext, cache = new Map());
            }
        }

        var cached = cache.get(path);

        if (!cached) {
            cache.set(path, cached = new Promise((resolve, reject) => {
                if (compiler.compileFileForBrowser) {
                    resolve(compiler.compileFileForBrowser(path, compilerOptions));
                } else {
                    compiler.compileFile(path, compilerOptions, function (err, code) {
                        if (err) return reject(err);
                        resolve({ code: code });
                    });
                }
            }));
        }

        return cached;
    }

    lasso.dependencies.registerRequireType('marko', {
        properties: { 'path': 'string' },

        init: callbackify(function(lassoContext) {
            this.path = this.resolvePath(this.path);
            return compile(this.path, lassoContext).then(compiled => this._compiled = compiled);
        }),

        getLastModified: callbackify(function (lassoContext) {
            if (!isDev || config.useCache) {
                return Promise.resolve(1);
            }

            const watchFiles = this._compiled && this._compiled.meta && this._compiled.meta.watchFiles;
            
            if (watchFiles) {
                return new Promise((resolve) => {
                    let remaining = watchFiles.length;
                    let maxMtime = -1;
                    for (const watchFile of watchFiles.concat(this.path)) {
                        lassoContext.cachingFs.stat(watchFile, (err, stat) => {
                            if (remaining) {
                                if (err) {
                                    remaining = 0;
                                    resolve(-1);
                                } else {
                                    if (stat._lastModified > maxMtime) {
                                        maxMtime = stat._lastModified;
                                    }

                                    if (--remaining === 0) {
                                        resolve(maxMtime);
                                    }
                                }
                            }
                        });
                    }
                });
            } else {
                return Promise.resolve(-1);
            }
        }),

        getDependencies: function(lassoContext) {
            if (this._compiled.dependencies) {
                return this._compiled.dependencies;
            }

            if (this._compiled.meta) {
                return (this._compiled.meta.deps || []).map(toLassoDep, this);
            }

            return [];
        },

        read: function(lassoContext) {
            return (this._compiled && this._compiled.code) || null;
        }
    });

    if (isPackageTypesSupported) {
        lasso.dependencies.registerPackageType('marko-dependencies', {
            properties: { 'path': 'string' },

            init: callbackify(function(lassoContext) {
                this.path = this.resolvePath(this.path);

                if (this.path.endsWith('.marko')) {
                    return compile(this.path, lassoContext).then(compiled => this._compiled = compiled);
                }
            }),

            getDependencies: function(lassoContext) {
                if (!this._compiled) {
                    return [];
                }

                var dir = nodePath.dirname(this.path)
                var meta = this._compiled.meta;
                var dependencies = [];

                if (meta.component) {
                    let componentRequire = `require(${JSON.stringify(meta.component)})`;
                    if (meta.legacy) {
                        componentRequire = `require("marko-widgets").defineWidget(${componentRequire})`
                    }
                    dependencies = dependencies.concat({
                        type:'require',
                        run: true,
                        virtualModule: getVirtualModule({
                            path: this.path + '.register.js',
                            code: `var component = ${
                                componentRequire
                            };\nrequire('marko/components').register(${
                                JSON.stringify(meta.id)
                            }, component.default || component);`
                        })
                    });
                }

                if (meta.deps) {
                    dependencies = dependencies.concat(meta.deps.map(toLassoDep, this));
                }

                if (meta.tags) {
                    // we need to also include the dependencies of
                    // any tags that are used by this template
                    dependencies = dependencies.concat(meta.tags.map(tagPath => ({
                        type: 'marko-dependencies',
                        path: this.resolvePath(tagPath, dir)
                    })));
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
                            code: config.runtimeId
                                ? `require("marko/components").init(${JSON.stringify(config.runtimeId)})`
                                : `window.$initComponents && window.$initComponents()`
                        })
                    }
                ];
            },

            calculateKey () {
                return 'marko-hydrate:'+this.path;
            }
        });
    }
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
        }
    }
}

function toLassoDep(dep) {
    var dir = nodePath.dirname(this.path);

    if (typeof dep === 'string') {
        var match = /^(?:([\w-]+)(?::\s*|\s+))?(.*?(?:\.(\w+))?)$/.exec(dep);
        dep = {
            type: match[1] || match[3],
            path: match[2]
        };
    } else {
        dep = {
            type: dep.type,
            path: dep.path,
            code: dep.code,
            virtualPath: dep.virtualPath
        };
    }

    if (dep.path) {
        dep.path = this.resolvePath(dep.path, dir);

        if (dep.path && !dep.type) {
            dep.type = dep.path.slice(dep.path.lastIndexOf('.') + 1);
        }
    }

    if (dep.virtualPath) {
        dep.virtualPath = nodePath.resolve(dir, dep.virtualPath);
    }

    if (dep.type === 'js') {
        dep.type = 'require';
        dep.run = true;
    }

    return dep;
}