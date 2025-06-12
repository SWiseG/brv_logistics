window.modal = (function () {
    let modalStack = [];

    function loadHtml(url) {
        return fetch(url).then(r => {
            if (!r.ok) throw new Error("Erro ao carregar HTML do modal.");
            return r.text();
        });
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            if (!url) return resolve();
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = url;
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

    async function open({ htmlUrl, scriptUrl = null, params = {}, title = null, showSend = true, showCancel = true, sendText = 'Enviar', cancelText = 'Cancelar' }) {
        const html = await loadHtml(htmlUrl);
        await loadScript(scriptUrl);

        // Oculta o modal anterior, se houver
        if (modalStack.length) {
            await modalStack[modalStack.length - 1].modalEl.modal('hide');
        }

        const modalEl = createModalWrapper(html);
        const modalContent = modalEl.find('.modal-content');

        // Setar título e botões se forem dinâmicos
        if (title) modalContent.find('.modal-title').text(title);
        const btnSend = modalContent.find('#modal-send');
        const btnCancel = modalContent.find('#modal-cancel');

        showSend ? btnSend.text(sendText).show() : btnSend.hide();
        showCancel ? btnCancel.text(cancelText).show() : btnCancel.hide();

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
