'use strict';
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var fs = require('fs');

var markoPlugin = require('../'); // Load this module just to make sure it works
var lasso = require('lasso');

describe('lasso-marko' , function() {

    beforeEach(function(done) {
        for (var k in require.cache) {
            if (require.cache[k]) {
                delete require.cache[k];
            }
        }
        done();
    });

    it('should render a simple marko dependency', function() {
        var myLasso = lasso.create({
            fileWriter: {
                fingerprintsEnabled: false,
                outputDir: nodePath.join(__dirname, 'static')
            },
            bundlingEnabled: true,
            plugins: [
                {
                    plugin: markoPlugin,
                    config: {

                    }
                },
                {
                    plugin: 'lasso-require',
                    config: {
                        includeClient: false
                    }
                }
            ]
        });

        return myLasso.lassoPage({
            name: 'testPage',
            dependencies: [
                nodePath.join(__dirname, 'fixtures/project1/simple.marko')
            ],
            from: nodePath.join(__dirname, 'fixtures/project1')
        }).then((lassoPageResult) => {
            var output = fs.readFileSync(nodePath.join(__dirname, 'static/testPage.js'), {encoding: 'utf8'});
            expect(output).to.contain("simple.marko");
            expect(output).to.contain("input.name");
            return lasso.flushAllCaches();
        });
    });

    it('should render a simple marko dependency that uses require', function() {
        var myLasso = lasso.create({
            fileWriter: {
                fingerprintsEnabled: false,
                outputDir: nodePath.join(__dirname, 'static')
            },
            bundlingEnabled: true,
            plugins: [
                {
                    plugin: markoPlugin,
                    config: {

                    }
                },
                {
                    plugin: 'lasso-require',
                    config: {
                        includeClient: false
                    }
                }
            ]
        });

        return myLasso.lassoPage({
            name: 'testPage',
            dependencies: [
                'require: ./simple.marko'
            ],
            from: nodePath.join(__dirname, 'fixtures/project1')
        }).then((lassoPageResult) => {
            var output = fs.readFileSync(nodePath.join(__dirname, 'static/testPage.js'), {encoding: 'utf8'});
            expect(output).to.contain("simple.marko");
            expect(output).to.contain("input.name");
            return lasso.flushAllCaches();
        });
    });
});
