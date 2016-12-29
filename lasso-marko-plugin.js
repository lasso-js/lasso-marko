module.exports = function(lasso, config) {
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

            init: function(lassoContext, callback) {
                if (!this.path) {
                    return callback(new Error('"path" is required for a Marko dependency'));
                }

                this.path = this.resolvePath(this.path);
                callback();
            },

            read: function(lassoContext, callback) {
                if (markoCompiler.compileFileForBrowser) {
                    markoCompiler.compileFileForBrowser(this.path, compilerOptions, callback);                    
                } else {
                    markoCompiler.compileFile(this.path, compilerOptions, callback);
                }
            },

            getLastModified: function(lassoContext, callback) {
                markoCompiler.getLastModified(this.path, callback);
            }
        });
};
