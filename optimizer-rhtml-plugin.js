var raptorTemplatesCompiler = require('raptor-templates/compiler');

module.exports = function(optimizer, config) {

    optimizer.dependencies.registerRequireType(
        'rhtml',
        {
            properties: {
                'path': 'string'
            },

            init: function(optimizerContext, callback) {
                if (!this.path) {
                    return callback(new Error('"path" is required for a Raptor Templates dependency'));
                }

                this.path = this.resolvePath(this.path);
                callback();
            },

            read: function(optimizerContext, callback) {
                raptorTemplatesCompiler.compileFile(this.path, callback);
            },

            getLastModified: function(optimizerContext, callback) {
                raptorTemplatesCompiler.getLastModified(this.path, callback);
            }
        });
};
