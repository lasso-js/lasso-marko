"use strict";

const nodePath = require("path");
const lassoVersion = getVersion("lasso");
const markoCompilerVersion = getVersion("@marko/compiler");
const emptyCodeReg = /\s*(?:"use strict";?|\/\/.*$|\/\*.*?\*\/)+\s*/gm;
const manifestDepReg = /^package(?::\s*|\s+)(.*)$/;
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

if (markoCompilerVersion[0] < 5 || markoCompilerVersion[1] < 33) {
  throw new Error(
    "lasso-marko-plugin@5 requires marko >= 5 and @marko/compiler >= 5.33, install lasso-marko-plugin@3 for older marko versions."
  );
}

if (lassoVersion[0] < 3) {
  throw new Error(
    "lasso-marko-plugin@5 requires lasso >= 3, install lasso-marko-plugin@3 for older lasso versions."
  );
}

const compiler = require("@marko/compiler");
compiler.configure({
  cache: new Map()
});

module.exports = function (lasso, config = {}) {
  const lassoConfig = lasso.config.rawConfig;
  const isMultiFile = !(lassoConfig.bundlingEnabled || lassoConfig.minify);
  const baseConfig = {
    modules: "cjs",
    babelConfig: config.babelConfig || {
      comments: false,
      compact: false,
      babelrc: false,
      configFile: false,
      browserslistConfigFile: false,
      caller: {
        name: "lasso-marko",
        supportsStaticESM: true,
        supportsDynamicImport: true,
        supportsTopLevelAwait: true,
        supportsExportNamespaceFrom: true,
      }
    },
    writeVersionComment: isMultiFile,
    sourceMaps: isMultiFile && "inline",
    runtimeId: config.runtimeId,
  };

  lasso.on("lassoCacheCreated", function (cacheInfo) {
    cacheInfo.lassoCache.configureCacheDefaults({
      "*": {
        "marko/meta": {
          store: "memory",
          encoding: "utf8",
          valueType: "json",
        },
      },
      production: {
        "marko/meta": {
          store: "disk",
          encoding: "utf8",
          valueType: "json",
        },
      },
    });
  });

  const domOutputConfig = {
    ...baseConfig,
    output: "dom",
  };
  lasso.dependencies.registerRequireType("marko", {
    properties: { path: "string" },

    async init() {
      this.path = this.resolvePath(this.path);
    },

    async getDependencies(lassoContext) {
      const meta = await getMeta(this.path, domOutputConfig, lassoContext);
      const dir = nodePath.dirname(this.path);
      const deps = [];

      if (meta.manifestFiles) {
        for (const file of meta.manifestFiles) {
          deps.push(toManifestDep(dir, file));
        }
      }

      if (meta.virtualFiles) {
        for (const file of meta.virtualFiles) {
          deps.push(toVirtualDep(dir, file));
        }
      }

      return deps;
    },

    async getLastModified(lassoContext) {
      if (!isDev) return 1;

      try {
        const { watchFiles } = await getMeta(
          this.path,
          domOutputConfig,
          lassoContext
        );
        const times = await Promise.all(
          watchFiles
            .concat(this.path)
            .map((file) => lassoContext.getFileLastModified(file))
        );
        return Math.max(...times);
      } catch (_) {
        return -1;
      }
    },

    async read(lassoContext) {
      return (await compile(this.path, domOutputConfig, lassoContext)).code;
    },
  });

  for (const [name, config] of [
    [
      "marko-hydrate",
      {
        ...baseConfig,
        output: "hydrate",
        hydrateInit: true,
      },
    ],
    [
      "marko-dependencies",
      {
        ...baseConfig,
        output: "hydrate",
        hydrateInit: false,
      },
    ],
  ]) {
    lasso.dependencies.registerPackageType(name, {
      properties: { path: "string" },

      async init() {
        this.path = this.resolvePath(this.path);
      },

      async getDependencies(lassoContext) {
        const { code, meta } = await compile(this.path, config, lassoContext);
        const dir = nodePath.dirname(this.path);
        const deps = [];

        if (meta.manifestFiles) {
          for (const file of meta.manifestFiles) {
            deps.push(toManifestDep(dir, file));
          }
        }

        if (meta.virtualFiles) {
          for (const file of meta.virtualFiles) {
            deps.push(toVirtualDep(dir, file));
          }
        }

        if (code.replace(emptyCodeReg, "")) {
          deps.push(
            toVirtualDep(dir, {
              virtualPath: `./${nodePath.basename(
                this.path,
                ".marko"
              )}.hydrate.js`,
              code: code,
            })
          );
        }

        return deps;
      },

      async getLastModified(lassoContext) {
        if (!isDev) return 1;

        try {
          const { watchFiles } = await getMeta(this.path, config, lassoContext);
          const times = await Promise.all(
            watchFiles.map((file) => lassoContext.getFileLastModified(file))
          );
          return Math.max(...times);
        } catch (_) {
          return -1;
        }
      },

      calculateKey() {
        return `${name}:${this.path}`;
      },
    });
  }

  function getMeta(path, config, lassoContext) {
    return lassoContext.cache
      .getCache("marko/meta")
      .get(`${config.output}:${path}`, {
        async builder() {
          return (await compile(path, config, lassoContext)).meta;
        },
      });
  }

  async function compile(path, config, lassoContext) {
    let virtualFiles;
    let manifestFiles;
    const dir = nodePath.dirname(path);
    const compiled = await compiler.compileFile(path, {
      ...config,
      resolveVirtualDependency(from, { virtualPath, code }) {
        const file = {
          virtualPath:
            from === path
              ? virtualPath
              : nodePath.relative(
                  dir,
                  nodePath.resolve(from, "..", virtualPath)
                ),
          code,
        };

        if (virtualFiles) {
          virtualFiles.push(file);
        } else {
          virtualFiles = [file];
        }
        return false;
      },
    });

    for (const item of compiled.meta.deps) {
      if (typeof item === "string") {
        const match = manifestDepReg.exec(item);
        if (match) {
          if (manifestFiles) {
            manifestFiles.push(match[1]);
          } else {
            manifestFiles = [match[1]];
          }
        }
      }
    }

    const meta = {
      watchFiles: compiled.meta.watchFiles,
      virtualFiles,
      manifestFiles,
    };

    lassoContext.cache
      .getCache("marko/meta")
      .put(`${config.output}:${path}`, meta);

    return {
      code: compiled.code,
      meta: meta,
    };
  }
};

function toManifestDep(dir, file) {
  return {
    type: "package",
    path: nodePath.resolve(dir, file),
  };
}

function toVirtualDep(dir, { code, virtualPath }) {
  const type = virtualPath.slice(virtualPath.lastIndexOf(".") + 1);
  const resolved = nodePath.resolve(dir, virtualPath);

  if (type === "js") {
    return {
      type: "require",
      run: true,
      virtualModule: {
        path: resolved,
        read(_, done) {
          done(null, code);
        },
      },
    };
  }

  return {
    type,
    virtualPath: resolved,
    code,
  };
}

function getVersion(pkg) {
  try {
    const { version } = require(`${pkg}/package.json`);
    const [major, minor, patch] = version.split(".");
    return [parseInt(major, 10), parseInt(minor, 10), parseInt(patch, 10)];
  } catch {
    return [0, 0, 0];
  }
}
