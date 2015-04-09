lasso-marko
===============

Plugin for the [Lasso.js](https://github.com/lasso-js/lasso) to support compilation and transport of [Marko](https://github.com/raptorjs/marko) template files. Templates are compiled using the [Marko](https://github.com/raptorjs/marko) compiler that produces a CommonJS module as output.

# Usage

```bash
npm install lasso-marko --save
```

Register the plugin when configuring the lasso. For example:
```js
require('lasso').configure({
    "plugins": [
        ...
        "lasso-marko"
    ]
    ...
});
```

Required Marko templates will automatically be found via static code analysis as long as they are loaded using `require.resolve(path)` and rendered using code similar to the following (inside a CommonJS module):

```javascript
// Template must be loaded using require.resolve!
var template = require('marko').load(require.resolve('./template.marko'));

template.render({
        name: 'Frank'
    },
    function(err, output) {
        console.log(output);
    });
```

To explicitly declare templates that may not be discovered via static code analysis of CommonJS modules, you can also choose to declare a Marko template dependency in an `browser.json` file.

```json
{
    "dependencies": [
        "template.marko"
    ]
}
```

_NOTE: No configuration is supported by this module._

# Contributors

* [Patrick Steele-Idem](https://github.com/patrick-steele-idem) (Twitter: [@psteeleidem](http://twitter.com/psteeleidem))
* [Phillip Gates-Idem](https://github.com/philidem/) (Twitter: [@philidem](https://twitter.com/philidem))

# Contribute

Pull Requests welcome. Please submit Github issues for any feature enhancements, bugs or documentation problems.

# License

Apache License v2.0
