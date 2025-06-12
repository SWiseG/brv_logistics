define(`/static/js/mixins/mixin.test.js`, null, 
    function MixinTest() {
        return {
            kind: bindings.observable(`mixin`),
            name: bindings.observable(`MixinTest`),
            compositionComplete: (name, path, dependencies, callback, params) => {
            },
            mixinTestMethod: () => {
            }
        }
    }
)