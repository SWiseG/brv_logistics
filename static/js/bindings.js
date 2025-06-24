window.bindings = {
  observables: {},
  components: {},
  templates: {},

  _currentComputed: null,

  // Cria observable (getter/setter + subscribe)
  observable(initialValue) {
    let _value = initialValue;
    const subscribers = new Set();

    function obs(newValue) {
      if (arguments.length > 0) {
        if (_value !== newValue) {
          _value = newValue;
          subscribers.forEach(cb => cb(_value));
        }
      } else if (bindings._currentComputed) {
        subscribers.add(bindings._currentComputed);
      }
      return _value;
    }

    obs.subscribe = cb => {
      subscribers.add(cb);
      cb(_value);
      return () => subscribers.delete(cb);
    };

    obs.unsubscribe = cb => subscribers.delete(cb);

    return obs;
  },

  // Cria observable de array (getter/setter + subscribe)
  observableArray(initialArray = []) {
    const obs = bindings.observable([...initialArray]);

    obs.push = item => {
      const current = obs();
      current.push(item);
      obs([...current]);
    };

    obs.remove = item => {
      const current = obs().filter(i => i !== item);
      obs([...current]);
    };

    obs.clear = () => obs([]);

    return obs;
  },

  // Computed com tracking automático
  computed(fn) {
    let cachedValue;
    const subscribers = new Set();

    const update = () => {
      bindings._currentComputed = update;
      const newValue = fn();
      bindings._currentComputed = null;

      if (newValue !== cachedValue) {
        cachedValue = newValue;
        subscribers.forEach(cb => cb(cachedValue));
      }
    };

    function comp(cb) {
      subscribers.add(cb);
      cb(cachedValue);
    }

    update();

    return Object.assign(comp, { update });
  },

  _params(input) {
    const regex = /([a-zA-Z0-9_.]+)\(([\s\S]*)\)$/;
    const match = input.match(regex);

    if (!match) {
        return { isFunctionCall: false };
    }

    const functionName = match[1];
    const rawArgs = match[2].trim();

    let parsedArgs = [];

    // Função auxiliar para tentar detectar o tipo
    const parseArg = (arg) => {
        arg = arg.trim();

        // Trata como Number
        if (!isNaN(arg) && arg !== '') {
            return Number(arg);
        }

        // Trata como Boolean
        if (arg === "true") return true;
        if (arg === "false") return false;

        // Trata como null / undefined
        if (arg === "null") return null;
        if (arg === "undefined") return undefined;

        // Trata como Date (exemplo simples, apenas se for exatamente 'new Date()')
        if (/^new Date\(\s*\)$/.test(arg)) {
            return new Date();
        }

        // Trata como JSON / Objeto (se começar por { ou [ )
        if ((arg.startsWith('{') && arg.endsWith('}')) || (arg.startsWith('[') && arg.endsWith(']'))) {
            try {
                return JSON.parse(arg.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'));  // Corrige JSON sem aspas nas chaves
            } catch (e) {
                return arg;  // Se der erro, retorna como string bruta
            }
        }

        // Trata como String (se estiver entre aspas simples ou duplas)
        if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
            return arg.slice(1, -1);
        }

        // Por último, se não caiu em nenhum caso: retorna como texto literal
        return arg;
    };

    // Lógica simples para separar os argumentos, mesmo com vírgulas dentro de objetos ou strings
    const splitArgs = (argsStr) => {
        const args = [];
        let current = '';
        let openBrackets = 0;
        let openBraces = 0;
        let openParens = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];

            if (inString) {
                current += char;
                if (char === stringChar && argsStr[i - 1] !== '\\') {
                    inString = false;
                }
            } else {
                if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    current += char;
                } else if (char === '{') {
                    openBraces++;
                    current += char;
                } else if (char === '}') {
                    openBraces--;
                    current += char;
                } else if (char === '[') {
                    openBrackets++;
                    current += char;
                } else if (char === ']') {
                    openBrackets--;
                    current += char;
                } else if (char === '(') {
                    openParens++;
                    current += char;
                } else if (char === ')') {
                    openParens--;
                    current += char;
                } else if (char === ',' && openBraces === 0 && openBrackets === 0 && openParens === 0) {
                    args.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
        }
        if (current.trim() !== '') {
            args.push(current.trim());
        }
        return args;
    };

    const argList = splitArgs(rawArgs);
    parsedArgs = argList.map(parseArg);

    return {
        isFunctionCall: true,
        functionName: functionName,
        rawArguments: rawArgs,
        arguments: parsedArgs
    };
  },

  // Inicializa os bindings no DOM (ou subtree)
  init(root = document) {
    root.querySelectorAll('[data-bind]').forEach(el => {
      const legacyWords = [
        'global',
        'bindings',
        'main',
        'message',
        'navbar',
        'notify',
        'themes',
        'translations',
        'utils',
      ];
      const bindStr = el.getAttribute('data-bind');
      if (!bindStr) return;

      const bindingsList = bindStr.split(';').map(b => b.trim());

      bindingsList.forEach(binding => {
        const [action, key] = binding.split(':').map(s => s.trim());
        var obs = bindings.observables[key] || key;

        let func = null;
        let hasInvoke = null;
        if (typeof key === 'string') {
          let methodStr = key.trim();
          hasInvoke = bindings._params(methodStr);
          if(hasInvoke && hasInvoke.hasOwnProperty('isFunctionCall') && hasInvoke.isFunctionCall === false) hasInvoke = null;
          else {
            methodStr = methodStr.replace(/\(.*\)$/, '');
            hasInvoke = hasInvoke.arguments;
          }

          // Remove $root. se existir
          if (methodStr.startsWith('$root.') && window['ctor']) {
            methodStr = methodStr.replace('$root.', '');
            func = ctor[methodStr];
          } 
          else {
            // Verifica se começa com alguma palavra legada
            const legacy = legacyWords.find(word => methodStr.startsWith(word + '.'));

            if (legacy) {
              const parts = methodStr.split('.');
              const objName = parts[0]; // Ex: 'global'
              const methodName = parts.slice(1).join('.'); // Ex: 'minhaFuncao'

              const obj = window[objName];
              func = obj && typeof obj[methodName] === 'function' ? obj[methodName].bind(obj) : null;
            } else {
              // Se não for $root. nem legacy, procura direto em window
              func = typeof window[methodStr] === 'function' ? window[methodStr] : null;
            }
          }
        };

        if (typeof func !== 'function') return false;
        
        if (action === 'text') {
          if(!!hasInvoke) func(hasInvoke[0]);
          func.subscribe(valueFunction => el.textContent = valueFunction);
        }
        
        else if (action === 'value') {
          if(!!hasInvoke) func(hasInvoke[0]);
          el.value = func();
          func.subscribe(val => { if (el.value !== val) el.value = val; });
          el.addEventListener('input', () => func(el.value));
        }
        
        else if (action === 'click') {
          // Atribui o click se for função válida
          if (typeof func === 'function') {
            if (!el._bindingClickHandler || el._bindingClickHandler.toString() !== func.toString()) {
              if (el._bindingClickHandler) {
                el.removeEventListener('click', el._bindingClickHandler);
              }

              const handler = () => func({ view: root, $element: !!el ? $(el) : null, params: !!hasInvoke ? {...hasInvoke} : null });
              el.addEventListener('click', handler);
              el._bindingClickHandler = handler;
            }
          }
        }
      });
    });
  },

  reload: (view=null) => {
    if(!!view && '' !== view) return bindings.init(view);
    return bindings.init();
  }
};
