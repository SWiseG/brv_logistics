window.modal = (function () {
    let modalStack = [];

    async function loadHtml(view) {
        return fetch(view).then(r => {
            if (!r.ok) throw new Error("Erro ao carregar HTML do modal.");
            return r.text();
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

    function animateShow(modal) {
        return new Promise(resolve => {
            modal.modal({ backdrop: 'static', keyboard: false });
            modal.on('shown.bs.modal', () => {
                resolve();
            });
            modal.modal('show');
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

    function modalSettings(view) {
        if(!window.hasOwnProperty('global') || !global) return;
        return global.messages.find(x => x.name === view);
    }

    function $getModalView($triggerdElement) {
        if($triggerdElement && $triggerdElement?.length > 0) {
            if($triggerdElement.hasClass('modal') && $triggerdElement.attr('role') === "dialog") return $triggerdElement;
            const $modal = $triggerdElement.closest('[role="dialog"].modal');
            if($modal && $modal?.length > 0) return $modal;
        }
        return null;
    }

    async function deactivate(params, result) {
        const $modal = $getModalView(params?.$element);
        if(!$modal) return;
        await animateHide($modal);
        const modalConfig = modalStack.pop();
        if (modalStack.length) {
            modalStack[modalStack.length - 1].$modal.modal('show');
        }
        modalStack[modalStack.length - 1]?.resolve?.(result);
        window.ctor = parent;
        return modalConfig.resolve(result); 
    }

    async function send(params, result=null) {
        return deactivate(params, { status: 'ok', "result": result}); 
    }

    async function cancel(params, result=null) {
        return deactivate(params, { status: 'cancel', "result": result}); 
    }

    async function open({ view, params = {} }) {
        const modalSet = modalSettings(view);
        if(!modalSet) throw Error('Could not found the modal configuration. Modal:' + view);
        return new Promise((resolve, reject) => {
            require(modalSet.scripts, async () => {
                const html = await loadHtml('/static/' + modalSet.views);

                if (modalStack.length) await modalStack[modalStack.length - 1].modalEl.modal('hide');

                const modalEl = createModalWrapper(html);

                const extensions = {
                    activate: () => {},
                    deactivate: async () => { return await ctor.cancel() },
                    send: async (params) => {
                    },
                    cancel: async (params) => {
                    },
                    compositionComplete: () => {},
                };

                ctor = $.extend(extensions, ctor);

                var activateResult = ctor.activate(params);
                if(activateResult === false) return;

                ctor.view = modalEl;
                ctor.compositionComplete(ctor.view, params); 

                bindings.reload(ctor.view[0]);
                
                // Mostra o modal com animação
                await animateShow(modalEl);

                // Armazena na pilha
                modalStack.push({ modalEl, resolve, reject });
            }, true);
        });

    }
    
    return { open, send, cancel };
})();