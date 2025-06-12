window.notify = (function () {
    const defaultOptions = {
        position: 'top-center',
        hideAfter: 5000,
        allowToastClose: true,
        stack: 10,
        showHideTransition: 'plain',
        loader: false,
    };

    const iconMap = {
        info: 'fa fa-info-circle',
        success: 'fa fa-check-circle',
        warning: 'fa fa-exclamation-triangle',
        error: 'fa fa-times-circle',
        danger: 'fa fa-times-circle',
        neutral: 'fa fa-bell',
    };

    function show(message, type = '', options = {}, title = '', icon = '') {
        const iconClass =   icon && icon !== '' ? icon : 
                            iconMap.hasOwnProperty(type) ? iconMap[type] :
                            iconMap['neutral']
        ;

        const htmlMessage = `
            <i class="icon ${iconClass}" style="margin-right: 8px;"></i>
            ${message}
        `;

        if(title === '' || title === null) title = translate._translate(`notification.${type}`);

        const {
            onClick = null,
            closeable = true,
            duration = 5000,
            customClass = null,
            withIcon = !!iconClass && "" !== iconClass,
        } = options;

        $.toast({
            text: htmlMessage,
            heading: capitalize(title),
            icon: false,
            showHideTransition: defaultOptions.showHideTransition,
            allowToastClose: closeable,
            hideAfter: duration,
            stack: defaultOptions.stack,
            position: defaultOptions.position,
            loader: defaultOptions.loader,
            afterShown: function () {},
            beforeHide: function () {},
            afterHidden: function () {},
            textAlign: 'left',
            loader: true, 
            loaderBg: `var(--fb-${type === 'error' ? 'danger' : type}-border)`,
            click: onClick || null,
            beforeShow: function () {
                const toast = $('.jq-toast-single').last();
                toast.addClass(`notification ${type}`);
                if(withIcon) toast.addClass('iconed');
                if (customClass) toast.addClass(customClass);
            }
        });
    }

    function success(message, options = {}) {
        show(message, 'success', options);
    }

    function warning(message, options = {}) {
        show(message, 'warning', options);
    }

    function danger(message, options = {}) {
        show(message, 'error', options);
    }

    function info(message, options = {}) {
        show(message, 'info', options);
    }

    function capitalize(word) {
        return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
    }

    return {
        show,
        success,
        warning,
        danger,
        info,
    };
})();
