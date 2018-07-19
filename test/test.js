'use strict';
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var semver = require('semver');
var fs = require('fs');

var markoPlugin = require('../'); // Load this module just to make sure it works
var lasso = require('lasso');
var lassoVersion = require('lasso/package').version;
var markoVersion = require('marko/package').version;
var isPackageTypesSupported = semver.satisfies(lassoVersion, '>=3') && semver.satisfies(markoVersion, '>=4.7');
var isMetaSupported = semver.satisfies(markoVersion, '>=4');
var isBrowserJSONInMeta = semver.satisfies(markoVersion, '>=4.4.9');

var config = {
    fileWriter: {
        fingerprintsEnabled: false,
        outputDir: nodePath.join(__dirname, 'static')
    },
    bundlingEnabled: true,
    require: {
        includeClient: false
    },
    plugins: [
        markoPlugin
    ]
};

describe('lasso-marko' , function() {

    beforeEach(function(done) {
        for (var k in require.cache) {
            if (require.cache[k]) {
                delete require.cache[k];
            }
        }
        done();
    });

    it('should bundle a simple marko template', function() {
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'simple',
            dependencies: [
                nodePath.join(__dirname, 'fixtures/simple/template.marko')
            ],
            from: nodePath.join(__dirname, 'fixtures/simple')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/simple.js'), {encoding: 'utf8'});
            expect(JS).to.contain("input.name");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a simple marko template loaded using require', function() {
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'require',
            dependencies: [
               'require: ./template.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/simple')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/require.js'), {encoding: 'utf8'});
            expect(JS).to.contain("input.name");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a marko dependency tree with meta data', function() {
        if (!isMetaSupported) return this.skip();

        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'simple-meta',
            dependencies: [
                nodePath.join(__dirname, 'fixtures/meta-stateful/stateful.marko')
            ],
            from: nodePath.join(__dirname, 'fixtures/meta-stateful')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/simple-meta.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/simple-meta.css'), {encoding: 'utf8'});
            expect(JS).to.contain("stateful.marko");
            expect(JS).to.contain("input.name");
            if (isBrowserJSONInMeta) expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a marko dependency tree with meta data that uses require', function() {
        if (!isMetaSupported) return this.skip();
        
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'require-meta',
            dependencies: [
                'require: ./stateful.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/meta-stateful')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/require-meta.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/require-meta.css'), {encoding: 'utf8'});
            expect(JS).to.contain("stateful.marko");
            expect(JS).to.contain("input.name");
            if (isBrowserJSONInMeta) expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a simple marko dependency tree that uses dependencies', function() {
        if (!isPackageTypesSupported) return this.skip();
        
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'dependencies',
            dependencies: [
                'marko-dependencies: ./stateful.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/meta-stateful')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/dependencies.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/dependencies.css'), {encoding: 'utf8'});
            expect(JS).to.not.contain("stateful.marko");
            expect(JS).to.not.contain("input.name");
            expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a simple marko dependency tree that uses hydrate', function() {
        if (!isPackageTypesSupported) return this.skip();

        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'hydrate',
            dependencies: [
                'marko-hydrate: ./stateful.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/meta-stateful')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/hydrate.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/hydrate.css'), {encoding: 'utf8'});
            expect(JS).to.not.contain("input.name");
            expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a split component with its dependencies', function() {
        if (!isPackageTypesSupported) return this.skip();

        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'dependencies',
            dependencies: [
                'marko-dependencies: ./split.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/meta-split')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/dependencies.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/dependencies.css'), {encoding: 'utf8'});
            expect(JS).to.not.contain("TEMPLATE");
            expect(JS).to.contain("TEST");
            expect(JS).to.contain("MOUNT");
            expect(CSS).to.contain("blue");
            return lasso.flushAllCaches();
        });
    });
});
