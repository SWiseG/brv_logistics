define(`/static/js/mixins/mixin.test2.js`, null, 
    function MixinTest2() {
        return {
            kind: bindings.observable(`mixin`),
            name: bindings.observable(`MixinTest2`),
            compositionComplete: (name, path, dependencies, callback, params) => {
            },
            mixinTest2Method: () => {
            }
        }
    }
)