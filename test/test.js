'use strict';
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var fs = require('fs');

var rhtmlPlugin = require('../'); // Load this module just to make sure it works
var raptorOptimizer = require('raptor-optimizer');

describe('raptor-optimizer-rhtml' , function() {

    beforeEach(function(done) {
        for (var k in require.cache) {
            if (require.cache.hasOwnProperty(k)) {
                delete require.cache[k];
            }
        }
        done();
    });

    it('should render a simple rhtml dependency', function(done) {

        var pageOptimizer = raptorOptimizer.create({
                fileWriter: {
                    fingerprintsEnabled: false,
                    outputDir: nodePath.join(__dirname, 'static')
                },
                bundlingEnabled: true,
                plugins: [
                    {
                        plugin: rhtmlPlugin,
                        config: {

                        }
                    },
                    {
                        plugin: 'raptor-optimizer-require',
                        config: {
                            includeClient: false
                        }
                    }
                ]
            });

        pageOptimizer.optimizePage({
                name: 'testPage',
                dependencies: [
                    nodePath.join(__dirname, 'fixtures/project1/simple.rhtml')
                ],
                from: nodePath.join(__dirname, 'fixtures/project1')
            },
            function(err, optimizedPage) {
                if (err) {
                    return done(err);
                }

                var output = fs.readFileSync(nodePath.join(__dirname, 'static/testPage.js'), 'utf8');
                expect(output).to.contain("simple.rhtml");
                expect(output).to.contain("data.name");

                setTimeout(done, 1000);
                // done();
            });
    });


});
