window.logger = (function () {
    function log(message, type = 'info') {
        if(allowLog()) {
            switch (type) {
                case 'error':
                    console.error('[ERROR] ' + message);
                    break;
                case 'warning':
                case 'warn':
                    console.warn('[WARN] ' + message);
                    break;
                case 'success':
                    console.log('[SUCCESS] ' + message);
                    break;
                default:
                    console.log('[INFO] ' + message);
                    break;
            }
        }
        else if(allowLog() === false) return console.log('[INFO] Logger module not allowed yet. The message tried to sent is: ' + message);
    }

    function allowLog() {
        var hasGlobal = window.hasOwnProperty('global');
        if(!hasGlobal) return false;

        var validateDebugMode = !!global && global.hasOwnProperty('options') && global.options['debug'];
        if(validateDebugMode === false) return;

        return true;
    }

    return {
        log,
        allowLog
    };
})();
