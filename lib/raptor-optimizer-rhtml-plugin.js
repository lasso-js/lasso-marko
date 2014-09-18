var raptorTemplatesCompiler = require('raptor-templates/compiler');

module.exports = function(optimizer, config) {

    optimizer.dependencies.registerRequireType(
        'rhtml',
        {
            properties: {
                'path': 'string'
            },

            init: function() {
                if (!this.path) {
                    throw new Error('"path" is required for a Raptor Templates dependency');
                }

                this.path = this.resolvePath(this.path);
            },

            read: function(optimizerContext, callback) {
                raptorTemplatesCompiler.compileFile(this.path, callback);
            },

            lastModified: function(optimizerContext, callback) {
                raptorTemplatesCompiler.getLastModified(this.path, callback);
            }
        });
};
