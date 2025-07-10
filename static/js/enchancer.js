(function () {
    const enchancer = {
        init: function () {
            this.handleDropdowns();
            this.handleCollapses();
            this.handleTooltips();
            this.handlePopovers();
            this.handleTabs();
        },

        log: function (message, data) {
            if (window.DEBUG_MODE) console.log(`[Enchancer]: ${message}`, data);
        },

        handleDropdowns: function () {
            document.addEventListener('show.bs.dropdown', (e) => {
                const currentDropdown = e.target;
                document.querySelectorAll('.dropdown.show').forEach(dropdown => {
                    if (dropdown !== currentDropdown) {
                        const toggleBtn = dropdown.querySelector('[data-bs-toggle="dropdown"]');
                        const instance = bootstrap.Dropdown.getInstance(toggleBtn);
                        instance?.hide();
                    }
                });
            });

            document.addEventListener('shown.bs.dropdown', (e) => {
                const toggleBtn = e.target;
                const menu = toggleBtn.nextElementSibling;
                if (!menu || !menu.classList.contains('dropdown-menu')) return;
                if (menu.isAnimating) return;

                // Forçar posicionamento via classes
                if (toggleBtn.classList.contains('data-direction-right')) {
                    menu.classList.add('dropdown-menu-end');
                } else if (toggleBtn.classList.contains('data-direction-left')) {
                    // Por padrão o Bootstrap já abre pra esquerda, então apenas certifica que 'end' não está presente
                } else if (toggleBtn.classList.contains('data-direction-up')) {
                    toggleBtn.closest('.dropdown')?.classList.add('dropup');
                } else if (toggleBtn.classList.contains('data-direction-down')) {
                    toggleBtn.closest('.dropdown')?.classList.remove('dropup');
                } else {
                    // Ajuste automático se encostar na borda da tela
                    const rect = menu.getBoundingClientRect();
                    if (rect.right > window.innerWidth - 20) {
                        menu.classList.add('dropdown-menu-end');
                    }
                }

                // Animação
                menu.isAnimating = true;
                menu.style.display = 'block';
                menu.style.height = '0';
                menu.style.overflow = 'hidden';
                menu.style.transition = 'height 300ms ease-out';

                const fullHeight = menu.scrollHeight + 'px';
                requestAnimationFrame(() => {
                    menu.style.height = fullHeight;
                });

                menu.addEventListener('transitionend', function handler() {
                    menu.style.height = '';
                    menu.style.overflow = '';
                    menu.style.transition = '';
                    menu.isAnimating = false;
                    menu.removeEventListener('transitionend', handler);
                }, { once: true });
            });

            document.addEventListener('hide.bs.dropdown', (e) => {
                const toggleBtn = e.target;
                const menu = toggleBtn.nextElementSibling;
                if (!menu || !menu.classList.contains('dropdown-menu')) return;
                if (menu.isAnimating) {
                    e.preventDefault();
                    return;
                }

                e.preventDefault();

                menu.isAnimating = true;
                menu.style.height = menu.scrollHeight + 'px';
                menu.style.overflow = 'hidden';
                menu.style.transition = 'height 300ms ease-out';

                requestAnimationFrame(() => {
                    menu.style.height = '0';
                });

                menu.addEventListener('transitionend', function handler() {
                    menu.style.display = 'none';
                    menu.style.height = '';
                    menu.style.overflow = '';
                    menu.style.transition = '';
                    menu.isAnimating = false;

                    toggleBtn.classList.remove('show');
                    menu.classList.remove('show');
                    toggleBtn.setAttribute('aria-expanded', 'false');

                    const hiddenEvent = new Event('hidden.bs.dropdown', { bubbles: true });
                    toggleBtn.dispatchEvent(hiddenEvent);

                    menu.removeEventListener('transitionend', handler);
                }, { once: true });
            });
        },

        handleCollapses: function () {
            document.addEventListener('show.bs.collapse', (e) => {
                const el = e.target;
                $(el).stop(true, true).slideDown(300, () => {
                    el.classList.add('show');
                });
                e.preventDefault();
            });

            document.addEventListener('hide.bs.collapse', (e) => {
                const el = e.target;
                $(el).stop(true, true).slideUp(300, () => {
                    el.classList.remove('show');
                });
                e.preventDefault();
            });
        },

        handleTooltips: function () {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.forEach(function (tooltipTriggerEl) {
                const customDelay = tooltipTriggerEl.getAttribute('data-delay') || 200;

                let placement = 'auto';
                if (tooltipTriggerEl.classList.contains('data-direction-left')) placement = 'left';
                else if (tooltipTriggerEl.classList.contains('data-direction-right')) placement = 'right';
                else if (tooltipTriggerEl.classList.contains('data-direction-up')) placement = 'top';
                else if (tooltipTriggerEl.classList.contains('data-direction-down')) placement = 'bottom';

                new bootstrap.Tooltip(tooltipTriggerEl, {
                    placement: placement,
                    delay: { show: parseInt(customDelay), hide: 100 },
                    boundary: 'viewport',
                    customClass: 'fade-custom',
                });
            });
        },

        handlePopovers: function () {
            const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
            popoverTriggerList.forEach(function (popoverTriggerEl) {
                const customDelay = popoverTriggerEl.getAttribute('data-delay') || 200;

                let placement = 'auto';
                if (popoverTriggerEl.classList.contains('data-direction-left')) placement = 'left';
                else if (popoverTriggerEl.classList.contains('data-direction-right')) placement = 'right';
                else if (popoverTriggerEl.classList.contains('data-direction-up')) placement = 'top';
                else if (popoverTriggerEl.classList.contains('data-direction-down')) placement = 'bottom';

                new bootstrap.Popover(popoverTriggerEl, {
                    placement: placement,
                    delay: { show: parseInt(customDelay), hide: 100 },
                    boundary: 'viewport',
                    offset: [0, 10],
                    customClass: 'fade-custom',
                });
            });
        },

        handleTabs: function () {
            document.addEventListener('show.bs.tab', (e) => {
                const targetId = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
                document.querySelectorAll('.tab-pane.show.active').forEach(tab => {
                    tab.classList.remove('show', 'active');
                    tab.style.opacity = 0;
                    tab.style.display = 'none';
                });

                const targetTab = document.querySelector(targetId);
                if (targetTab) {
                    targetTab.style.display = 'block';
                    setTimeout(() => {
                        targetTab.classList.add('show', 'active');
                        targetTab.style.opacity = 1;
                    }, 50);
                }
            });
        },
    };

    window.enchancer = enchancer;
})();
