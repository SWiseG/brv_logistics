window.define = async (path, requires, callback, partial=false) => {
    return await global.registerModule(callback.name, path, requires, callback, partial) 
};

window.require = (scripts, callback, partial=false) => {
    if (!scripts || scripts === "") return false;
    
    const moduleNames = String(scripts).split(',').map(s => s.trim());
    
    if (window.dependencyResolver) {
        const promises = moduleNames.map(name => {
            // Normalizar path
            let path = name;
            if (!path.startsWith('/static/')) {
                path = `/static/js/${path}`;
            }
            if (!path.endsWith('.js')) {
                path = `${path}.js`;
            }
            
            return dependencyResolver.require(path);
        });
        
        Promise.allSettled(promises)
            .then(results => {
                const successful = results.filter(r => r.status === 'fulfilled');
                if(window['logger']) logger.log(`${successful.length}/${results.length} modules loaded`);
                
                if (typeof callback === 'function') {
                    callback();
                }
            })
            .catch(error => {
                if(window['logger']) logger.log('Load modules failed:', error, 'error');
            });
        
        return;
    }
    
    // Fallback para sistema original (manter compatibilidade)
    const define = (src) => {
        return new Promise((resolve, reject) => {
            src = src.trim();
            if (!partial) {
                if (!src || src === "") return false;
                if (!src.startsWith('/static/')) src = `/static/js/${src}`;
                if (!src.endsWith('js')) src = `${src}.js`;
            } else {
                if (!src || src === "") return false;
                if (!src.startsWith('/static/')) src = `/static/${src}`;
                if (!src.endsWith('js')) src = `${src}.js`;
            }

            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = true;

            script.onload = () => resolve(src);
            script.onerror = () => reject(new Error(`Failed to load module: ${src}`));

            document.head.appendChild(script);
        });
    };

    Promise.all(moduleNames.map(define))
        .then(() => {
            if (typeof callback === 'function') callback();
        })
        .catch((error) => {
            if(window['logger']) logger.log('Module load error:', error, 'error');
        });
};

document.addEventListener('DOMContentLoaded', async function() {
    console.time('App Initialization');
    console.log('App Initializing');
    
    try {
        
        await require('logger, global, dependency-resolver, arch, utils, message, notify, bindings, themes, translation, enchancer', async () => {
            // 1. Aplicar extensões
            applyExtensions();

            // 2. Inicializar Global
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

            window.global = new Global();
            await global.init();
            
            // 3. Carregar módulos da página automaticamente
            window.ctor = await global.loadModules();
            
            // 5. Finalizar inicialização
            await finalize();

            console.log('App Initialized');
        });
        
    } catch (error) {
        console.error('Critical Error to intialize app:', error);
        showErrorFallback(error);
    }
});

function applyExtensions() {
    // JSON tryParse
    JSON['tryParse'] = (str) => {
        try {
            return JSON.parse(str);
        } catch (error) {
            if(window['logger']) logger.log("JSON parser error: " + error, 'warn');
            return null;
        }
    };

    // jQuery extensions
    if (window.jQuery) {
        jQuery.fn.appendAfter = function($selector) {
            return this.each(function() {
                $(`#${$selector.attr('id')}`).after(this);
            });
        };
    }
}

async function finalize() {
    // Finally
    if(window.global) await global.initMessages();
    if(window.enchancer) enchancer.init();
    if(window.notify) notify.global();
    if(window.global) global.initHtml();
    if(window.utils) utils.loading(false);
    
    // Aplicar bindings se necessário
    if (window.bindings) bindings.reload();
}

function showErrorFallback(error) {
    document.body.innerHTML = `
        <div style="padding: 2rem; text-align: center; font-family: Arial, sans-serif;">
            <h1 style="color: #dc3545;">Erro na Aplicação</h1>
            <p>Houve um problema ao inicializar a aplicação.</p>
            <details style="margin: 1rem 0; text-align: left;">
                <summary>Detalhes do erro</summary>
                <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow: auto;">
                    ${error.stack || error.message}
                </pre>
            </details>
            <button onclick="location.reload()" 
                    style="padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Recarregar Página
            </button>
        </div>
    `;
}