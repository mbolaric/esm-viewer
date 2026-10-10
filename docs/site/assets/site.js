// @ts-check

(() => {
    const { document, window, HTMLAnchorElement, HTMLButtonElement, HTMLElement, Element } = globalThis;
    const candidateButton = document.querySelector('#menu-toggle');
    const candidateNavigation = document.querySelector('#site-navigation');
    if (!(candidateButton instanceof HTMLButtonElement) || !(candidateNavigation instanceof HTMLElement)) return;
    const button = candidateButton;
    const navigation = candidateNavigation;

    const compact = window.matchMedia('(max-width: 48rem)');
    document.documentElement.classList.add('menu-ready');

    /** @param {boolean} open */
    function setOpen(open) {
        navigation.dataset.open = String(open);
        button.setAttribute('aria-expanded', String(open));
    }

    function synchronizeMenu() {
        button.hidden = !compact.matches;
        setOpen(!compact.matches);
        if (compact.matches && navigation.contains(document.activeElement)) button.focus();
    }

    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', (event) => {
        const anchor = event.target instanceof Element ? event.target.closest('a') : null;
        if (!(anchor instanceof HTMLAnchorElement) || !compact.matches) return;
        setOpen(false);
        const target = anchor.hash ? document.getElementById(anchor.hash.slice(1)) : null;
        if (!(target instanceof HTMLElement)) return;
        // Re-align after the menu closes so its previous height cannot obscure the destination.
        window.requestAnimationFrame(() => {
            target.scrollIntoView({ block: 'start' });
            const heading = target.querySelector('h2');
            if (heading instanceof HTMLElement) {
                heading.tabIndex = -1;
                heading.focus({ preventScroll: true });
            }
        });
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && compact.matches && button.getAttribute('aria-expanded') === 'true') {
            setOpen(false);
            button.focus();
        }
    });
    compact.addEventListener('change', synchronizeMenu);
    synchronizeMenu();
})();
