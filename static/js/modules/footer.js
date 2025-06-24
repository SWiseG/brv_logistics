define(`/static/js/modules/footer.js`, null, 
    function Footer() {
        return {
            name: `Footer`,
            kind: bindings.observable(`module`),
            modules: bindings.observable([]),
            compositionComplete: (name, path, dependencies, callback, params) => {
                return true;
            },
        }
    }
)