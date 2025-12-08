// Constantes Globais
const USERS_KEY = 'mapa_cego_users';

// --- CONFIGURAÇÃO DAS CONTAS DE TESTE ---
const testAccounts = [
    // CONFERENTES
    { username: 'Fabricio', sector: 'conferente', subType: 'ALM', role: 'user', label: 'Conferente - ALMOXARIFADO' },
    { username: 'Clodoaldo', sector: 'conferente', subType: 'ALM', role: 'user', label: 'Conferente - ALMOXARIFADO' },
    { username: 'Guilherme', sector: 'conferente', subType: 'GAVA', role: 'user', label: 'Conferente - GAVA' },
    { username: 'Outros', sector: 'conferente', subType: 'OUT', role: 'user', label: 'Conferente - OUTROS' },
    
    // RECEBIMENTO
    { username: 'Caio', sector: 'recebimento', subType: null, role: 'user', label: 'Recebimento - Caio' },
    { username: 'Balanca', sector: 'recebimento', subType: null, role: 'user', label: 'Recebimento - Balança' },
    
    // ADMIN
    { username: 'Admin', sector: 'recebimento', subType: null, role: 'admin', label: 'Administrador / Geral' }
];

// --- FUNÇÕES DE LOGIN ---

function fazerLogin() {
    const userIn = document.getElementById('loginUser').value;
    const passIn = document.getElementById('loginPass').value;
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];

    const user = users.find(u => u.username === userIn && u.password === passIn);

    if (user) {
        loginComUsuario(user);
    } else {
        alert("Usuário ou senha incorretos.");
    }
}

// Função unificada de login e redirecionamento
function loginComUsuario(user) {
    sessionStorage.setItem('loggedInUser', JSON.stringify(user));
    window.location.href = '/pages/index.html';
}

// --- FUNÇÕES DE INTERFACE (SWITCHER E REGISTRO) ---

function abrirSwitcher() {
    const lista = document.getElementById('listaContas');
    lista.innerHTML = '';
    
    testAccounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'account-item';
        
        // Define cor do ícone baseado no setor
        let bgAvatar = '#ddd';
        let colorAvatar = '#555';
        
        if(acc.sector === 'conferente') { bgAvatar = '#ffebee'; colorAvatar = '#D32F2F'; }
        else if(acc.sector === 'recebimento' && acc.role !== 'admin') { bgAvatar = '#e3f2fd'; colorAvatar = '#1976D2'; }
        else if(acc.role === 'admin') { bgAvatar = '#333'; colorAvatar = '#fff'; }

        item.innerHTML = `
            <div class="acc-avatar" style="background:${bgAvatar}; color:${colorAvatar}">${acc.username[0]}</div>
            <div>
                <div style="font-weight:bold; font-size:0.95rem;">${acc.username}</div>
                <div style="font-size:0.75rem; color:#666;">${acc.label}</div>
            </div>
        `;
        item.onclick = () => loginComUsuario(acc);
        lista.appendChild(item);
    });

    document.getElementById('modalSwitcher').style.display = 'flex';
}

// Funções de controle do modal de Registro
function abrirRegistro() { document.getElementById('modalRegistro').style.display = 'flex'; }
function fecharRegistro() { document.getElementById('modalRegistro').style.display = 'none'; }


// --- INICIALIZAÇÃO E EVENT LISTENERS ---

// Executa quando o HTML termina de carregar
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Inicializa usuários padrão se não existirem
    if (!localStorage.getItem(USERS_KEY)) {
        const defaultUsers = [
            { username: 'admin', password: '123', role: 'admin', sector: 'admin' },
            { username: 'Balanca', password: '123', role: 'user', sector: 'recebimento' }
        ];
        localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    }

    // 2. Configura o Listener do Formulário de Registro
    const formRegistro = document.getElementById('formRegistro');
    if (formRegistro) {
        formRegistro.addEventListener('submit', (e) => {
            e.preventDefault();
            const nome = document.getElementById('regNome').value;
            const user = document.getElementById('regUser').value;
            const pass = document.getElementById('regPass').value;
            const setor = document.getElementById('regSetor').value;

            const requests = JSON.parse(localStorage.getItem('register_requests') || '[]');
            requests.push({
                id: Date.now(), 
                fullName: nome, 
                desiredUsername: user, 
                desiredPassword: pass, 
                sector: setor, 
                status: 'pending', 
                requestDate: new Date().toISOString()
            });
            localStorage.setItem('register_requests', JSON.stringify(requests));
            
            alert("Solicitação enviada para aprovação do Administrador.");
            fecharRegistro();
        });
    }
});