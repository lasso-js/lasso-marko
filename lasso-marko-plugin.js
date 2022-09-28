'use strict';

var callbackify = require('callbackify');
var promisify = require('util').promisify;
var nodePath = require('path');
var lassoVersion = require('lasso/package').version.split('.');
var markoVersion = require('marko/package').version.split('.');

// marko package types are supported with lasso >= 3 and marko >= 4.7
var isPackageTypesSupported = lassoVersion[0] >= 3 && (markoVersion[0] > 4 || (markoVersion[0] == 4 && markoVersion[1] >= 7));
var isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

module.exports = function(lasso, config) {
    config = config || {};

    var compiler = config.compiler || (markoVersion[0] >= 5 ? require('@marko/compiler') : require('marko/compiler'));

    var defaultOutput;
    var compileFile;

    // check if we've got marko 5+ compiler
    if (compiler.getRuntimeEntryFiles) {
        compileFile = compiler.compileFile;
        defaultOutput = 'dom';
    } else {
        compileFile = promisify(compiler.compileFileForBrowser || compiler.compileFile);
        defaultOutput = compiler.isVDOMSupported ? 'vdom' : 'html';
    }

    var lassoConfig = lasso.config.rawConfig;
    var compilerOptions = {
        sourceOnly: false,
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

    lasso.on('lassoCacheCreated', function(cacheInfo) {
        var lassoCache = cacheInfo.lassoCache;

        lassoCache.configureCacheDefaults({
            '*': { // Any profile
                'marko/meta': {
                    store: 'memory',
                    encoding: 'utf8',
                    valueType: 'json'
                }
            },
            'production': {
                'marko/meta': {
                    store: 'disk',
                    encoding: 'utf8',
                    valueType: 'json'
                }
            }
        });
    });

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

        var cachedCode = cache.get(path);

        if (!cachedCode) {
            cache.set(
                path,
                (cachedCode = compileFile(path, compilerOptions).then((compiled) => {
                    const rawMeta = compiled.meta || {};
                    const meta = {
                        id: rawMeta.id,
                        tags: rawMeta.tags,
                        legacy: rawMeta.legacy,
                        component: rawMeta.component,
                        watchFiles: rawMeta.watchFiles,
                        deps: (compiled.dependencies || rawMeta.deps || []),
                    };

                    lassoContext.cache
                        .getCache("marko/meta")
                        .put(path, meta);

                    return {
                        code: compiled.code || compiled,
                        meta: meta
                    };
                }))
            );
        }

        return cachedCode;
    }

    function getMeta(path, lassoContext) {
        return lassoContext.cache
            .getCache("marko/meta")
            .get(path, {
                builder() {
                    return compile(path, lassoContext).then(result => result.meta)
                }
            });
    }

    lasso.dependencies.registerRequireType('marko', {
        properties: { 'path': 'string' },

        init: callbackify(function(lassoContext) {
            this.path = this.resolvePath(this.path);
            return Promise.resolve();
        }),

        getLastModified: callbackify(function(lassoContext) {
            if (!isDev || config.useCache) {
                return Promise.resolve(1);
            }

            return getMeta(this.path, lassoContext).then((meta) => {
                const watchFiles = meta.watchFiles;
    
                if (!watchFiles) {
                    return -1;
                }
    
                return Promise.all(
                    watchFiles
                        .concat(this.path)
                        .map((file) => lassoContext.getFileLastModified(file))
                )
                    .then((times) => Math.max(...times))
                    .catch(() => -1);
            });
        }
    ),

        getDependencies: callbackify(function(lassoContext) {
            return getMeta(this.path, lassoContext).then((meta) =>
                (meta.deps || []).map(toLassoDep, this)
            );
        }),

        read: callbackify(function(lassoContext) {
            return compile(this.path, lassoContext).then(result => result.code);
        })
    });

    if (isPackageTypesSupported) {
        lasso.dependencies.registerPackageType('marko-dependencies', {
            properties: { 'path': 'string' },

            init: callbackify(function(lassoContext) {
                this.path = this.resolvePath(this.path);
                return Promise.resolve();
            }),

            getDependencies: callbackify(function(lassoContext) {
                if (this.path.endsWith('.marko')) {
                    return getMeta(this.path, lassoContext).then(meta => {
                        var dir = nodePath.dirname(this.path)
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
                    });
                }

                return [];
            }),

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
        // clone the dep and exclude additional metadata added by Marko
        const original = dep;
        dep = {};
        for (const key in original) {
            switch (key) {
                case "map":
                case "style":
                case "endPos":
                case "startPos":
                    break;
                default:
                    dep[key] = original[key];
            }
        }
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