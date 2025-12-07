/* js/wilson-core.js */
const WilsonUI = {
    sidebar: {
        toggle: () => {
            document.querySelector('.w-sidebar').classList.toggle('active');
        },
        close: () => {
            document.querySelector('.w-sidebar').classList.remove('active');
        }
    },
    // Utilitário para formatar datas no padrão brasileiro
    formatDate: (isoDate) => {
        if(!isoDate) return '-';
        return new Date(isoDate).toLocaleDateString('pt-BR');
    }
};

// Fecha menu ao clicar fora no mobile
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.w-sidebar');
    const toggle = document.querySelector('.w-mobile-toggle');
    if (window.innerWidth <= 1024 && 
        sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        !toggle.contains(e.target)) {
        WilsonUI.sidebar.close();
    }
});