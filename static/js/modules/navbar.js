define(`/static/js/mixins/mixin.test.js`, '/static/js/mixins/mixin.test.js,/static/js/mixins/mixin.test2.js', 
    function Navbar() {
        return {
            kind: bindings.observable(`module`),
            name: bindings.observable(`Navbar`),
            modules: bindings.observable([]),
            compositionComplete: (name, path, dependencies, callback, params) => {
                return ctor.loadSubNavbarRow();
            },
            loadSubNavbarRow: () => {
                var $subNav = $('subnav');
                if ($subNav && $subNav.length > 0) {
                    var $next = $subNav.find('#subnav-scroll-arrow-left');
                    var $previous = $subNav.find('#subnav-scroll-arrow-right');
                    var $containerList = $subNav.find('.subnav-controll-list');

                    let scrollInterval;

                    if ($next?.length > 0 && $previous?.length > 0 && $containerList?.length > 0) {
                        const container = $containerList[0];

                        function reloadArrows() {
                            const overflow = container.scrollWidth > container.clientWidth;
                            $previous[0].style.display = $next[0].style.display = overflow ? 'block' : 'none';
                        }

                        function startScroll(direction) {
                            stopScroll();
                            scrollInterval = setInterval(() => {
                                container.scrollBy({
                                    left: direction === 'left' ? -80 : 80,
                                    behavior: 'smooth'
                                });
                            }, 100);
                        }

                        function stopScroll() {
                            if (scrollInterval) {
                                clearInterval(scrollInterval);
                                scrollInterval = null;
                            }
                        }

                        $next.on("mouseenter", () => startScroll('left'));
                        $previous.on("mouseenter", () => startScroll('right'));

                        $next.on("mouseleave", stopScroll);
                        $previous.on("mouseleave", stopScroll);

                        $(window).on("resize", reloadArrows);
                        $(window).on("load", reloadArrows);

                        reloadArrows();
                    }
                }
            },

            onAddress: () => {
                modal.open({
                    view: 'Example',
                    params: { nome: 'Usuário' },
                }).then(result => {
                    console.log('Resultado do modal:', result);
                }).catch(err => {
                    console.warn('Modal cancelado:', err);
                });
            }
        }
    }
)