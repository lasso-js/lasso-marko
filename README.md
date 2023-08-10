lasso-marko
===============

_NOTE: lasso-marko@4 requires marko >= 5, @marko/compiler >= 5.33 and lasso >= 3. For older versions use lasso-marko@3._

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

Required Marko templates will automatically be found via static code analysis when loaded, eg like:

```javascript
var template = require('./template.marko');

template.render({
        name: 'Frank'
    },
    function(err, output) {
        console.log(output);
    });
```

To explicitly declare templates that may not be discovered via static code analysis of CommonJS modules, you can also choose to declare Marko template dependencies in an `browser.json` file.

```json
{
    "dependencies": [
        "marko-dependencies: ./template.marko"
    ]
}
```

# Contributors

* [Patrick Steele-Idem](https://github.com/patrick-steele-idem) (Twitter: [@psteeleidem](http://twitter.com/psteeleidem))
* [Phillip Gates-Idem](https://github.com/philidem/) (Twitter: [@philidem](https://twitter.com/philidem))

# Contribute

Pull Requests welcome. Please submit Github issues for any feature enhancements, bugs or documentation problems.

# License

Apache License v2.0
