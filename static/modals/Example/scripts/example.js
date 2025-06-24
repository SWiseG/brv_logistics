function activate(params) {
    console.log("Params recebidos:", params);
}

function onShow() {
    console.log("Modal exibido!");
}

function compositionComplete() {
    console.log("DOM do modal completo.");
}

function send(modal) {
    let valor = modal.find('#meu-campo').val();
    if (!valor) {
        alert("Campo obrigatório");
        return false;
    }
    return { valor };
}

function cancel() {
    console.log("Modal cancelado.");
}
