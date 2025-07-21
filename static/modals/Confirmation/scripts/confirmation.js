define(`/static/js/modals/Login/scripts/confimation.js`, null, 
    function ConfirmationModal() {
        return {
            name: `ConfirmationModal`,
            kind: bindings.observable(`modal`),
            msgModalConfirmation: bindings.observable(""),
            msgModalTitle: bindings.observable(""),
            msgModalSend: bindings.observable(""),
            msgModalCancel: bindings.observable(""),
            activate(params) {
                ctor.msgModalTitle(!params || !params.hasOwnProperty('title') ? translate._translate('global-messages.confirmation-title'): params.title);
                ctor.msgModalConfirmation(!params || !params.hasOwnProperty('message') ? translate._translate('global-messages.confirmation-text'): params.message);

                ctor.msgModalSend(!params || !params.hasOwnProperty('sendMessage') ? translate._translate('global-messages.confirmation-send'): params.sendMessage);
                ctor.msgModalCancel(!params || !params.hasOwnProperty('cancelMessage') ? translate._translate('global-messages.confirmation-cancel'): params.cancelMessage);

                bindings.reload();
                return true;
            },

            send(params) {
                return modal.send(params, true); 
            },

            cancel(params) {
                return modal.send(params, false); 
            },

        }
    },
    partial=true
)