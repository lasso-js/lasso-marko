var util = require('./util');
var raptorTemplatesCompiler = util.getRaptorTemplatesCompiler();

module.exports = function(optimizer, config) {
    optimizer.dependencies.registerPackageType('rhtml', require('./dependency-rhtml'));
    optimizer.dependencies.registerRequireExtension('rhtml', function(path, context, callback) {
        raptorTemplatesCompiler.compileFile(path, callback);
    });
};