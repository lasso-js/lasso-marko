var raptorTemplatesCompiler;

try {
    raptorTemplatesCompiler = require.resolve('raptor-templates/compiler');
} catch(e) {
}

if (raptorTemplatesCompiler) {
    raptorTemplatesCompiler = require('raptor-templates/compiler');
}

exports.getRaptorTemplatesCompiler = function() {
    return raptorTemplatesCompiler;
};

exports.checkRaptorTemplates = function() {
    if (!raptorTemplatesCompiler) {
        throw new Error('The "raptor-templates" module must be installed as a top-level application to support *.rhtml dependencies');
    }
};