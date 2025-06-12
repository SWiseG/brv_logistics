window.modal = (function () {
    let modalStack = [];

    function loadHtml(view) {
        return fetch(`/static/modals/${view}/view/modal.html`).then(r => {
            if (!r.ok) throw new Error("Erro ao carregar HTML do modal.");
            return r.text();
        });
    }

    function loadScript(view) {
        return new Promise((resolve, reject) => {
            if (!view) return resolve();
            var viewExpression = `/static/modals/${view}/view/modal.js`;
            const existing = document.querySelector(`script[src="${viewExpression}"]`);
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = viewExpression;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function createModalWrapper(contentHtml) {
        const wrapper = document.createElement("div");
        wrapper.className = "modal fade custom-fade";
        wrapper.setAttribute("tabindex", "-1");
        wrapper.setAttribute("role", "dialog");
        wrapper.innerHTML = `
            <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
                ${contentHtml}
            </div>
        `;
        document.body.appendChild(wrapper);
        return $(wrapper);
    }

    function callFunctionIfExists(name, ...args) {
        if (typeof window[name] === "function") {
            return window[name](...args);
        }
    }

    function animateShow(modal) {
        return new Promise(resolve => {
            modal.modal({ backdrop: 'static', keyboard: false });
            modal.on('shown.bs.modal', resolve);
        });
    }

    function animateHide(modal) {
        return new Promise(resolve => {
            modal.on('hidden.bs.modal', () => {
                modal.remove();
                resolve();
            });
            modal.modal('hide');
        });
    }

    async function open({ view, params = {} }) {
        const html = await loadHtml(view);
        await loadScript(view);

        // Oculta o modal anterior, se houver
        if (modalStack.length) await modalStack[modalStack.length - 1].modalEl.modal('hide');

        const modalEl = createModalWrapper(html);

        // Chamada da função activate antes de mostrar
        callFunctionIfExists('activate', params);

        // Mostra o modal com animação
        await animateShow(modalEl);

        callFunctionIfExists('onShow');
        callFunctionIfExists('compositionComplete');

        // Evento botão Enviar
        btnSend.on('click', async () => {
            const result = callFunctionIfExists('send', modalEl);
            if (result === false) return; // bloqueia o fechamento
            await animateHide(modalEl);
            modalStack.pop();
            if (modalStack.length) {
                modalStack[modalStack.length - 1].modalEl.modal('show');
            }
            modalStack[modalStack.length - 1]?.resolve?.(result);
        });

        // Evento botão Cancelar
        btnCancel.on('click', async () => {
            callFunctionIfExists('cancel');
            await animateHide(modalEl);
            modalStack.pop();
            if (modalStack.length) {
                modalStack[modalStack.length - 1].modalEl.modal('show');
            }
            modalStack[modalStack.length - 1]?.reject?.('cancelado');
        });

        // Armazena na pilha
        return new Promise((resolve, reject) => {
            modalStack.push({ modalEl, resolve, reject });
        });
    }

    return { open };
})();
