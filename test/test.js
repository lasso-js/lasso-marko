'use strict';
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var fs = require('fs');

var markoPlugin = require('../'); // Load this module just to make sure it works
var lasso = require('lasso');

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

    it('should bundle a simple marko dependency tree', function() {
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'basic',
            dependencies: [
                nodePath.join(__dirname, 'fixtures/project1/simple.marko')
            ],
            from: nodePath.join(__dirname, 'fixtures/project1')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/basic.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/basic.css'), {encoding: 'utf8'});
            expect(JS).to.contain("simple.marko");
            expect(JS).to.contain("input.name");
            expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a simple marko dependency tree that uses require', function() {
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'require',
            dependencies: [
                'require: ./simple.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/project1')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/require.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/require.css'), {encoding: 'utf8'});
            expect(JS).to.contain("simple.marko");
            expect(JS).to.contain("input.name");
            expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a simple marko dependency tree that uses dependencies', function() {
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'dependencies',
            dependencies: [
                'marko-dependencies: ./simple.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/project1')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/dependencies.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/dependencies.css'), {encoding: 'utf8'});
            expect(JS).to.not.contain("simple.marko");
            expect(JS).to.not.contain("input.name");
            expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });

    it('should bundle a simple marko dependency tree that uses hydrate', function() {
        var myLasso = lasso.create(config);

        return myLasso.lassoPage({
            name: 'hydrate',
            dependencies: [
                'marko-hydrate: ./simple.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/project1')
        }).then((lassoPageResult) => {
            var JS = fs.readFileSync(nodePath.join(__dirname, 'static/hydrate.js'), {encoding: 'utf8'});
            var CSS = fs.readFileSync(nodePath.join(__dirname, 'static/hydrate.css'), {encoding: 'utf8'});
            expect(JS).to.not.contain("simple.marko");
            expect(JS).to.not.contain("input.name");
            expect(JS).to.contain("TEST");
            expect(CSS).to.contain("blue");
            expect(CSS).to.contain("red");
            return lasso.flushAllCaches();
        });
    });
});
