window.logger = (function () {
    function log(message, type = 'info') {
        debugger;
        if(allowLog()) {
            switch (type) {
                case 'error':
                    console.error('[ERROR] ' + message);
                    break;
                case 'warning':
                case 'warn':
                    console.warn('[WARN] ' + message);
                    break;
                case 'succeess':
                    console.log('[SUCCESS] ' + message);
                    break;
                default:
                    console.log('[INFO] ' + message);
                    break;
            }
        }
        else return console.log('[LOG] Logger module not allowed yet');
    }

    function allowLog() {
        debugger;
        return window['global'] && !!global && global.hasOwnProperty('options') && global.options['debug'];
    }

    return {
        log,
        allowLog
    };
})();
