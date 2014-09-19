var markoCompiler = require('marko/compiler');

module.exports = function(optimizer, config) {

    optimizer.dependencies.registerRequireType(
        'marko',
        {
            properties: {
                'path': 'string'
            },

            init: function(optimizerContext, callback) {
                if (!this.path) {
                    return callback(new Error('"path" is required for a Marko dependency'));
                }

                this.path = this.resolvePath(this.path);
                callback();
            },

            read: function(optimizerContext, callback) {
                markoCompiler.compileFile(this.path, callback);
            },

            getLastModified: function(optimizerContext, callback) {
                markoCompiler.getLastModified(this.path, callback);
            }
        });
};
