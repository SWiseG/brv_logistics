define(`/static/js/modules/footer.js`, [], 
    function Footer() {
        return {
            name: `Footer`,
            kind: bindings.observable(`module`),
            modules: bindings.observable([]),
            compositionComplete: (name, path, dependencies, callback, params) => {
                debugger
                return true;
            },

            comebackToTop: () => {
                return window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }
)