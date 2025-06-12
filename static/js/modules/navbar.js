define(`/static/js/mixins/mixin.test.js`, '/static/js/mixins/mixin.test.js,/static/js/mixins/mixin.test2.js', 
    function Navbar() {
        return {
            kind: bindings.observable(`module`),
            name: bindings.observable(`Navbar`),
            modules: bindings.observable([]),
            compositionComplete: (name, path, dependencies, callback, params) => {
            }
        }
    }
)