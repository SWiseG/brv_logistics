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
        // Registra computed atual como dependente
        subscribers.add(bindings._currentComputed);
      }
      return _value;
    }

    obs.subscribe = cb => {
      subscribers.add(cb);
      cb(_value);
    };

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

  // Função para adicionar validação visual e lógica simples
  addValidation(el, obs, rulesStr) {
    if (!obs || typeof obs.subscribe !== 'function') return;
    const rules = rulesStr.split(',').map(r => r.trim());

    const validate = val => {
      let errors = [];

      rules.forEach(rule => {
        if (rule === 'required' && (!val || val.toString().trim() === '')) {
          errors.push('Campo obrigatório');
        } else if (rule === 'number' && isNaN(val)) {
          errors.push('Deve ser um número');
        } else if (rule === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) errors.push('Email inválido');
        }
      });

      if (errors.length > 0) {
        el.style.borderColor = 'red';
        el.title = errors.join(', ');
      } else {
        el.style.borderColor = '';
        el.title = '';
      }
    };

    obs.subscribe(validate);
    validate(obs());
  },

  // Renderiza template simples com {{key}} substituído pelos dados
  renderTemplate(templateId, data) {
    let template = bindings.templates[templateId];
    if (!template) return '';
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
  },

  // Inicializa os bindings no DOM (ou subtree)
  init(root = document) {
    root.querySelectorAll('[data-bind]').forEach(el => {
      const bindStr = el.getAttribute('data-bind');
      if (!bindStr) return;

      const bindingsList = bindStr.split(';').map(b => b.trim());

      bindingsList.forEach(binding => {
        const [action, key] = binding.split(':').map(s => s.trim());
        const obs = bindings.observables[key];

        if (action === 'text') {
          if (typeof obs === 'function' && obs.subscribe) {
            obs.subscribe(val => el.textContent = val);
          }
        }
        else if (action === 'value') {
          if (typeof obs === 'function' && obs.subscribe) {
            el.value = obs();
            obs.subscribe(val => { if (el.value !== val) el.value = val; });
            el.addEventListener('input', () => obs(el.value));
          }
        }
        else if (action === 'click') {
          if (typeof obs === 'function') {
            el.addEventListener('click', () => obs());
          }
        }
        else if (action === 'component') {
          const componentFn = bindings.components[key];
          if (typeof componentFn === 'function') {
            componentFn(el);
          }
        }
        else if (action === 'validate') {
          bindings.addValidation(el, obs, key);
        }
      });
    });
  }
};
