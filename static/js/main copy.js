// Instalando require
window.define = async (path, requires, callback, partial=false) => { return await global.registerModule(callback.name, path, requires, callback, partial) };

window.require = (scripts, callback, partial=false) => {
    if(!scripts || "" === scripts) return false;
    scripts = String(scripts).split(',');

    const define = (src) => {
        return new Promise((resolve, reject) => {
            src = src.trim();
            if(!partial) {
                if(!src || "" === src) return false;
                if(!src.startsWith('/static/')) src = `/static/js/${src}`;
                if(!src.endsWith('js')) src = `${src}.js`;
            }
            else {
                if(!src || "" === src) return false;
                if(!src.startsWith('/static/')) src = `/static/${src}`;
                if(!src.endsWith('js')) src = `${src}.js`;
            };


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
                if(window['logger'])
                    logger.log(
                        `[Module Load Success - ${new Date().toLocaleTimeString()}] ${scriptName}`,
                        'succcess'
                    );
            });
            if (typeof callback === 'function') callback();
        })
        .catch((error) => {
            if(window['logger'])
                logger.log(
                    `[Module Load Error - ${new Date().toLocaleTimeString()}] ${error}`,
                    'error'
                );
        });
}

// Main
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar módulos
    var ctor = {};
    await require('logger, global, utils, message, notify, bindings, themes, translation, enchancer', async (res) => {
        // Global
        window.global = new Global();
        global.applyHashProperties();

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

        // Modules
        window.ctor = await global.loadModules();

        // Finally
        await global.initMessages();
        enchancer.init();
        notify.global();
        global.initHtml();
        utils.loading(false);
    });

    // Extending custom methods
    JSON['tryParse'] = (str) => {
        try {
            return JSON.parse(str);
        } catch (error) {
            if(window['logger']) logger.log("JSON parser has problemns. Error: " + error, 'warn');
            return null;
        };
    }

    jQuery.fn.appendAfter = function($selector) {
        return this.each(function() {
            $(`#${$selector.attr('id')}`).after(this);
        });
    };
    
    function bindDropdownBlocker() {
        document.querySelectorAll('.dropdown[data-bs-auto-close="outside"]').forEach(dropdown => {
            if (!dropdown.hasAttribute('data-bs-listener-bound')) {
                dropdown.addEventListener('hide.bs.dropdown', function (e) {
                    const clickTarget = e.clickEvent?.target;
                    if (!clickTarget) return;

                    const isClickInsideMenu = dropdown.querySelector('.dropdown-menu')?.contains(clickTarget);
                    if (isClickInsideMenu) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });

                dropdown.setAttribute('data-bs-listener-bound', 'true');
            }
        });
    };

    bindDropdownBlocker();

    return ctor;
});