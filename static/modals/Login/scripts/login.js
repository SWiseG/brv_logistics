define(`/static/js/modals/Login/scripts/login.js`, null, 
    function Login() {
        return {
            name: `Login`,
            kind: bindings.observable(`modal`),

            valor: bindings.observable(null),
            compositionComplete: (name, path, dependencies, callback, params) => {
                return true;
            },
        }
    },
    partial=true
)