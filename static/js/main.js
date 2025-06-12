// Instalando require
window.define = async (path, requires, callback) => { return await global.registerModule(callback.name, path, requires, callback) };

window.require = (scripts, callback) => {
    if(!scripts || "" === scripts) return false;
    scripts = String(scripts).split(',');

    const define = (src) => {
        return new Promise((resolve, reject) => {
            src = src.trim();
            if(!src || "" === src) return false;
            if(!src.startsWith('/static/')) src = `/static/js/${src}`;
            if(!src.endsWith('js')) src = `${src}.js`;

            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = true;

            script.onload = () => {
                if(undefined === window['global'] && window.hasOwnProperty('global')) {
                    const module = global.modules.find(x => x.path === scr);
                    return resolve(module.ctor);
                };
                return resolve(src);
            };
            script.onerror = () => reject(new Error(`Failed to load module: ${src}`));

            document.head.appendChild(script);
        });
    };

    Promise.all(scripts.map(define))
        .then((srcs) => {
            srcs.forEach(scriptName => {
                console.log(`Success to load module: ${scriptName}`);
            });
            if (typeof callback === 'function') callback();
        })
        .catch((error) => {
            console.error(error);
        });
}

// Main
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar módulos
    var ctor = {};
    await require('global, utils, message, notify, bindings, themes, translation', async (res) => {
        // Global
        window.global = new Global();

        // Bindings
        bindings.init();

        // Utils
        window.utils = new Utils();
        utils.loading();

        // Themes
        window.themes = new Themes();
        await themes.initTheme();

        // Translation
        window.translate = new Translations();
        translate.init();

        // Navbar
        window.ctor = await global.loadModules();

        // Finally
        global.initHtml();
        utils.loading(false);

    });
    return ctor;
});