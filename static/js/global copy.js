// Configurações globais
function Global() {
    return {
        modules: [],
        translations: {},
        options: {
            noTreatedOptions: []
        },
        messages: [],
        currentLang: 'pt-BR',
        cart: {
            items: [],
            total: 0
        },
        user: {
            isAuthenticated: false
        },
        config: {
            currency: 'BRL',
            currencySymbol: 'R$',
            apiUrl: '/api/v1/',
            csrfToken: document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
        },
        initHtml: () => {
            $('html').removeClass('hidden-content-html');
        },
        initMessages: async () => {
            try {
                const response = await fetch('/modals/', { credentials: 'include' });

                if (!response.ok) {
                    console.error(
                        `%c[Modals Load Error: ${response.status}`,
                        "color: red; font-weight: bold;",
                        "color: white;"
                    );
                };

                global.messages = await response.json();
                if(window['logger']) 
                    logger.log('Content modals script loaded');
            } catch (error) {
                if(window['logger'])
                    logger.log(
                        `[Modals Load Error - ${error}`,
                        'error'
                    );
            };
        },
        mixinMergeStrategy: (constructor, mixin) => {
            const result = { ...constructor };

            for (const key in mixin) {
                if (!mixin.hasOwnProperty(key)) continue;

                const val1 = constructor[key];
                const val2 = mixin[key];

                if (val1 === undefined) {
                    result[key] = val2;
                } else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
                    result[key] = $.extend(val1, val2); // recursão para objetos aninhados
                } else if (val1 !== val2) {
                    result[key] = val1;
                };
            };

            return result;
        },
        applyMixinArgs: (name, module, partial) => {
            if(!partial) ctor = {};
            else {
                window.parent = {...ctor};
                ctor = {};
            };
            if(module) return ctor = module.ctor;
            var module = global.modules.find(x => x.path === name);
            if(!module) throw Error(`Could not load constructor from ${name}`); 
            return ctor = module;
        },
        getModule: (name) => {
            const hasLogger = window.hasOwnProperty('logger');
            
            function isInConstructor(name) { return window.ctor && window.ctor.hasOwnProperty('name') && window.ctor.name === name; };
            function isInParent(name) { return window.parent && window.parent.hasOwnProperty('name') && window.parent.name === name; };
            
            logger.log(`Trying to find custom module constructor ${name}`, 'warn');

            if(isInConstructor(name)) {
                logger.log(`Module constructor was in ctor`, 'warn');
                return window.ctor;
            }
            else if(isInParent(name)) {
                logger.log(`Module constructor was in parent. Maybe any custom partial view is opened`, 'warn');
                return window.parent;
            }
            else {
                const module = global.modules.find(md => md.name === name);
                if(hasLogger) {
                    if(!module) logger.log(`Could not found custom module constructor ${name}`, 'warn');
                    else {
                        logger.log(`Module constructor ${name} founded`, 'warn');
                        return module.ctor;
                    };
                };
            };

            return null;
        },
        createModule: async (name) => {
            return await require(name);
        },
        registerModule: async (name, path, dependencies, callback, partial, params) => {
            var registeredModule = null;
            var moduleLoaded = callback();
            if(moduleLoaded.hasOwnProperty('init') && typeof moduleLoaded['init'] === 'function') 
                moduleLoaded['init'](name, path, dependencies, callback, params);

            function finallyThen() {
                // Reload Bindings
                return bindings.reload();
            }
            async function start(module) {
                global.applyMixinArgs(module.name,module,partial);
                if(!partial) {
                    if(moduleLoaded.hasOwnProperty('checkParams') && typeof moduleLoaded['checkParams'] === 'function') 
                        await moduleLoaded['checkParams'](name, path, dependencies, callback, params);
                    if(moduleLoaded.hasOwnProperty('checkParamsThen') && typeof moduleLoaded['checkParamsThen'] === 'function') 
                        await moduleLoaded['checkParamsThen'](name, path, dependencies, callback, params);
                    if(moduleLoaded.hasOwnProperty('compositionComplete') && typeof moduleLoaded['compositionComplete'] === 'function') 
                        await moduleLoaded['compositionComplete'](name, path, dependencies, callback, params);
                    return module.started = true;
                };
                return false;
            }

            async function register(name, path, dependencies, finalModule, params) {
                var module = {
                    name,
                    path,
                    dependencies,
                    params,
                    ctor: finalModule,
                    started: false,
                    createdAt: new Date()
                };

                const isAlreadyLoadedModule = global.modules.find(x => x.name === module.name);
                if(isAlreadyLoadedModule && isAlreadyLoadedModule.started) return false;

                if(window['logger']) 
                    logger.log(
                        `[Module Binding]%c Name: ${module.name} | Assigned Module: ${module.ctor}`,
                        'success'
                    );

                start(module);
                return module;
            }
            if(dependencies && dependencies !== '') {
                var loadedDependencies = {
                    modules: Array(),
                    list: String(dependencies).split(','),
                    raw: String(dependencies),
                };
                await require(loadedDependencies.list, async () => {
                    loadedDependencies.list.forEach(async dp => {
                        var mdFounded = global.modules.find(x => x.path === dp);
                        if(!mdFounded) throw Error(`Could not load dependencie from ${name}. Dependencie: ${dp}`);
                        if(!mdFounded.started) await start(mdFounded);
                        loadedDependencies.modules.push(mdFounded);
                        moduleLoaded = global.mixinMergeStrategy(moduleLoaded, mdFounded.ctor);
                    });
                    registeredModule = await register(name, path, loadedDependencies, moduleLoaded, params);
                    if(!registeredModule) return;
                    finallyThen();
                    return global.modules.push(registeredModule);
                });
            }
            else {
                registeredModule = await register(name, path, dependencies, moduleLoaded, params);
                if(!registeredModule) return;
                finallyThen();
                return global.modules.push(registeredModule);
            };
        },
        loadModules: async() => {
            var $modules = $(`module`);
            if($modules?.length > 0) {
                $modules.each(async (i, mod) => {
                    $module = $(mod);
                    const dataTag = $module.attr('data-tag');
                    if(dataTag && '' !== dataTag) {
                        const names = dataTag.split(',')
                                    .map(line => line.trim())
                                    .filter(line => line.length > 0);
                        const modules = Array(names).join(',');
                        await global.createModule(modules);
                    };
                })
            };
        },

        getCookie: (name) => {
            let cookieValue = null;
            if (document.cookie && document.cookie !== '') {
                const cookies = document.cookie.split(';');
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i].trim();
                    if (cookie.substring(0, name.length + 1) === (name + '=')) {
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        },

        getCsrfToken() {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'csrftoken') {
                    return value;
                }
            }
            
            // Fallback to meta tag
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            return metaTag ? metaTag.getAttribute('content') : '';
        },

        applyHashProperties: () => {
            // First try find CsrfToken
            if(!global.config.csrfToken || global.config.csrfToken === "") global.config.csrfToken = global.getCsrfToken();
            var $hashOptions = $('datahash');
            if($hashOptions?.length > 0) {
                $hashOptions.each((i, e) => {
                    var $hash = $(e);
                    var $hashVal = $hash.attr('val');
                    if(JSON.tryParse($hashVal)) {
                        var options = JSON.parse($hashVal);
                        Object.keys(options).forEach((key) => {
                            var res = options[key] === 'true' || options[key] === 'false' ? Boolean(options[key]) : options[key];
                            global.options[key] = res;
                        });
                    }
                    else global.options.noTreatedOptions.push($hashVal);
                });
                $hashOptions.remove();
            };

            // Check user auth
            $("script[tag='auth']").remove();
            if(window.hasOwnProperty('auth')) {
                global.user.isAuthenticated = window.auth;
                delete window.auth;
            };
        }
    }
};
