module.exports = function(lasso, config) {
    var markoCompiler = config.compiler || require('marko/compiler');
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
                markoCompiler.compileFile(this.path, callback);
            },

            getLastModified: function(lassoContext, callback) {
                markoCompiler.getLastModified(this.path, callback);
            }
        });
};
