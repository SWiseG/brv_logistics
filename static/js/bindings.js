window.bindings = {
  observables: {},
  components: {},
  templates: {},

  _currentComputed: null,

  _legacyWords: [
      'global',
      'bindings',
      'main',
      'message',
      'navbar',
      'notify',
      'themes',
      'translations',
      'utils',
  ],

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

  _startHandlers: () => {
    bindings._handlerOptions = 
      function () {
        var mapped = [];
        Object.keys(bindings._handlers).forEach((handler) => {
          if(handler.endsWith("RequiredParameters")) return;
          bindings[handler] = bindings._handlers[handler];
          mapped.push(handler);
        });
        return mapped;
      }();
  },

  _findFunction: (key, action=null) => {
    if(!action) action = key;
    var obs = bindings.observables[key] || key;

    let func = null;
    let hasInvoke = null;
    if (typeof key === 'string') {
      let methodStr = key.trim();
      hasInvoke = bindings._params(methodStr);
      if(hasInvoke && hasInvoke.hasOwnProperty('isFunctionCall') && hasInvoke.isFunctionCall === false) hasInvoke = false;
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
        const legacy = bindings._legacyWords.find(word => methodStr.startsWith(word + '.'));

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

    return {action, key, obs, func, hasInvoke};
  },

  _find: (binding) => {
    var foundedActions = [];
    const actions = binding.split(', ').map(s => s.trim());
    actions.forEach(act => {
      const [action, key] = act.split(':').map(s => s.trim());
      foundedActions.push(bindings._findFunction(key, action));
    });
    return foundedActions;
  },

  // Inicializa os bindings no DOM (ou subtree)
  init(root = document) {
    bindings._startHandlers();
    root.querySelectorAll('[data-bind]').forEach(el => {
      const bindStr = el.getAttribute('data-bind');
      if (!bindStr) return;

      const bindingsList = bindStr.split(';').map(b => b.trim());

      bindingsList.forEach(binding => {
        const bindedSubActions = bindings._find(binding);
        bindedSubActions.forEach(binded => {
          var { action, key, obs, func, hasInvoke } = binded;

          var isBindingHandler = bindings._handlerOptions.find(x => x === action);
          if(!!isBindingHandler) return bindings[action]($(el), bindings._handlerParams(action, obs, $(el).attr('id'), binding, func, hasInvoke), binding, action, func, hasInvoke);

          if (typeof func !== 'function') return false;

          if (action === 'text') {
            if(!!hasInvoke) func(hasInvoke[0]);
            func.subscribe(valueFunction => el.textContent = valueFunction);
          }
          
          else if (action === 'value') {
            if(!!hasInvoke) func(hasInvoke[0]);
            el.value = func();
            func.subscribe(val => { if (el.value !== val) el.value = val; });
            $(el).off('input');
            el.addEventListener('input', () => func(el.value));
          }
          
          else if (action === 'click') {
            if (typeof func === 'function') {
              const handler = function(e = null) {
                func({
                  event: e,
                  view: root,
                  $element: !!el ? $(el) : null,
                  params: !!hasInvoke ? { ...hasInvoke } : null
                });
              };

              if (!el._bindingClickHandler || el._bindingClickHandler.toString() !== handler.toString()) {
                if (el._bindingClickHandler) {
                  el.removeEventListener('click', el._bindingClickHandler);
                }

                $(el).off('click');

                el.addEventListener('click', handler);

                el._bindingClickHandler = handler;
              }
            }
          }

        });
      });
    });
  },

  reload: (view=null) => {
    if(!!view && '' !== view) return bindings.init(view);
    return bindings.init();
  }
};

$.extend(bindings, {
  _handlerParams: (handler, params, id='', originalBinding='', func=null, hasInvoke=false) => {
    originalBinding = originalBinding.replace(`${handler}: `, '');
    params = originalBinding.replaceAll('=',':').replaceAll("'",'"');
    var customParams = bindings._handlers.hasOwnProperty(`${handler}RequiredParameters`) && bindings._handlers[`${handler}RequiredParameters`].length > 1 ? bindings._handlers[`${handler}RequiredParameters`] : null;
    var paramsReaded = JSON.tryParse(params);
    if(!paramsReaded) 
      throw Error('Trying to Parse: ' + params + '. Handler: ' + handler + '. Element: ' + id);

    var recivedParams = Object.keys(paramsReaded);
    if(customParams) {
      function missingAttrs(required, recived) {
        const missing = required.filter(elem => !recived.includes(elem));
        return missing.join(",");
      }
      const result = missingAttrs(customParams, recivedParams);
      if("" !== result)
        throw Error('Trying to BuildParameters: ' + params + '. Handler: ' + handler + '. Element: ' + id + '. Missing required properties: ' + result);
    };
    return paramsReaded;
  },
  _handlers: {
    editInplaceRequiredParameters: ['callbackSuccess'],
    editInplace: ($element, params, originalBinding, action, func, hasInvoke) => {
      var id = $element.attr('id'),
          inputId = `${id}-edit-inplace`,
          callbackSuccess = (bindings._findFunction(params.callbackSuccess)),
          type = params.hasOwnProperty('type') ? params.type : 'text',
          customInputClass = params.hasOwnProperty('customInputClass') ? params.customInputClass : '',
          customTextBindClass = params.hasOwnProperty('customTextBindClass') ? params.customTextBindClass : ''
      ;

      if(callbackSuccess && callbackSuccess.func) callbackSuccess = callbackSuccess.func;
      else return;

      function formatType(currentValue, typeVal='text') {
        if('' !== currentValue && null !== currentValue && undefined !== currentValue) {
          switch (typeVal) {
            case 'number':
              currentValue = parseInt(currentValue);
              break;
            case 'float':
              currentValue = parseFloat(currentValue);
              break;
            case 'date':
              currentValue = new Date(moment(currentValue));
              break;
            case 'currency':
              currentValue = utils.formatPrice(currentValue);
              break;
            default:
              break;
          };
        };
        return currentValue
      }

      $element
        .attr('data-inplace-state', 'active')
        .addClass(customTextBindClass)
        .css('cursor', 'pointer')
        .addClass('active')
      ;

      const configWidthParent = $element.outerWidth();
      const configHeightParent = $element.outerHeight();
      
      const $editInplaceComponent = $('<input>')
                                    .attr('id', inputId)
                                    .attr('type', type)
                                    .attr('data-role', `edit-inplace`)
                                    .attr('data-inplace-for', id)
                                    .attr('data-inplace-state', 'inactive')
                                    .addClass(`edit-inplace-input ${customInputClass} hidden`)
                                    .width(`${configWidthParent}px`)
                                    .height(`${configHeightParent}px`)
      ;

      $editInplaceComponent.appendAfter($element);

      $editInplaceComponent.off('blur');
      $editInplaceComponent.on('blur', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const $targetInput = $(e.currentTarget);
        const parentId = $targetInput.attr('data-inplace-for');
        const $parent = $(`#${parentId}`);
        
        const oldValue = formatType($parent.val() || $parent.text(), type);
        const currentVal = formatType($targetInput.val(), type);
        
        const res = await callbackSuccess(parentId, oldValue, currentVal);

        if(res !== false) {
          $parent.val(currentVal)
                 .text(currentVal);
        }
        else {
          $targetInput.val(oldValue)
                 .text(oldValue);
        };

        $parent.addClass('active');
        $parent.removeClass('hidden');

        $targetInput.addClass('hidden');
        $targetInput.removeClass('active');

        $targetInput.attr('data-inplace-state', 'inactive');
        $parent.attr('data-inplace-state', 'active');
      });

      $element.off('click');
      $element.on('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        function toggleState($elem) {
          const val = formatType($elem.val() || $elem.text(), type);
          
          $elemFor = $(`[data-inplace-for=${$elem.attr('id')}]`);
          if($elemFor?.length > 0) {
            $elemFor.val(val).text(val);

            $elem.addClass('hidden');
            $elem.removeClass('active');

            $elemFor.addClass('active');
            $elemFor.removeClass('hidden');

            $elem.attr('data-inplace-state', 'inactive');
            $elemFor.attr('data-inplace-state', 'active');
          };
        };
        return toggleState($(e.currentTarget));
      });
    }
  }
});
