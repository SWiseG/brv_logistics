// Configurações globais
function Global() {
    return {
        modules: [],
        translations: {},
        currentLang: 'pt-BR',
        cart: {
            items: [],
            total: 0
        },
        config: {
            currency: 'BRL',
            currencySymbol: 'R$',
            apiUrl: '/api/',
            csrfToken: document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
        },
        initHtml: () => {
            $('html').removeClass('hidden-content-html');
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
                    result[key] = mergeRespectingFirst(val1, val2); // recursão para objetos aninhados
                } else if (val1 !== val2) {
                    result[key] = val1;
                };
            };

            return result;
        },
        applyMixinArgs: (name, module) => {
            ctor = {};
            if(module) return ctor = module.ctor;
            var module = global.modules.find(x => x.path === name);
            if(!module) throw Error(`Could not load constructor from ${name}`); 
            return ctor = module;
        },
        createModule: async (name) => {
            return await require(name);
        },
        registerModule: async (name, path, dependencies, callback, params) => {
            var registeredModule = null;
            var moduleLoaded = callback();
            if(moduleLoaded.hasOwnProperty('init') && typeof moduleLoaded['init'] === 'function') 
                moduleLoaded['init'](name, path, dependencies, callback, params);

            function finallyThen() {
                // Reload Bindings
                return bindings.reload();
            }
            async function start(module) {
                global.applyMixinArgs(module.name,module);
                if(moduleLoaded.hasOwnProperty('checkParams') && typeof moduleLoaded['checkParams'] === 'function') 
                    await moduleLoaded['checkParams'](name, path, dependencies, callback, params);
                if(moduleLoaded.hasOwnProperty('checkParamsThen') && typeof moduleLoaded['checkParamsThen'] === 'function') 
                    await moduleLoaded['checkParamsThen'](name, path, dependencies, callback, params);
                if(moduleLoaded.hasOwnProperty('compositionComplete') && typeof moduleLoaded['compositionComplete'] === 'function') 
                    await moduleLoaded['compositionComplete'](name, path, dependencies, callback, params);
                return module.started = true;
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
                console.log(`Module loaded: ${module.name}. Returned from module: ${module.ctor}`)
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
                    finallyThen();
                    return global.modules.push(registeredModule);
                });
            }
            else {
                registeredModule = await register(name, path, dependencies, moduleLoaded, params);
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
        }
    }
};
