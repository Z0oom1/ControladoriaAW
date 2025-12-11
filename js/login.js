// Constantes Globais
const USERS_KEY = 'mapa_cego_users';

// --- CONFIGURAÇÃO DAS CONTAS DE TESTE (ACESSO RÁPIDO) ---
const testAccounts = [
    // CONFERENTES
    { username: 'Fabricio', sector: 'conferente', subType: 'ALM', role: 'user', label: 'Conferente - ALMOXARIFADO' },
    { username: 'Guilherme', sector: 'conferente', subType: 'GAVA', role: 'user', label: 'Conferente - GAVA' },
    
    // NOVO: INFRAESTRUTURA
    { username: 'Wayner', sector: 'conferente', subType: 'INFRA', role: 'user', label: 'Conferente - INFRAESTRUTURA' },

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

    // Procura o usuário no banco local
    const user = users.find(u => u.username.toLowerCase() === userIn.toLowerCase() && u.password === passIn);

    if (user) {
        loginComUsuario(user);
    } else {
        alert("Usuário ou senha incorretos.");
    }
}

// Função unificada de login e redirecionamento
function loginComUsuario(user) {
    sessionStorage.setItem('loggedInUser', JSON.stringify(user));
    window.location.href = 'index.html'; // Ajuste o caminho se necessário (ex: /pages/index.html)
}

// --- FUNÇÕES DE INTERFACE (SWITCHER E REGISTRO) ---

function abrirSwitcher() {
    const lista = document.getElementById('listaContas');
    lista.innerHTML = '';
    
    testAccounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'account-item'; 
        item.style.padding = "10px";
        item.style.borderBottom = "1px solid #eee";
        item.style.cursor = "pointer";
        item.style.display = "flex";
        item.style.alignItems = "center";
        
        // Define cor do ícone baseado no setor
        let bgAvatar = '#ddd';
        let colorAvatar = '#555';
        
        if(acc.subType === 'INFRA') { bgAvatar = '#FF9800'; colorAvatar = '#FFF'; } // Laranja para Infra
        else if(acc.sector === 'conferente') { bgAvatar = '#ffebee'; colorAvatar = '#D32F2F'; }
        else if(acc.sector === 'recebimento' && acc.role !== 'admin') { bgAvatar = '#e3f2fd'; colorAvatar = '#1976D2'; }
        else if(acc.role === 'admin') { bgAvatar = '#333'; colorAvatar = '#fff'; }

        item.innerHTML = `
            <div class="acc-avatar" style="background:${bgAvatar}; color:${colorAvatar}; width:35px; height:35px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold; margin-right:10px;">${acc.username[0]}</div>
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

function abrirRegistro() { document.getElementById('modalRegistro').style.display = 'flex'; }
function fecharRegistro() { document.getElementById('modalRegistro').style.display = 'none'; }


// --- INICIALIZAÇÃO E EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    
    
    let users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    
   
    if (!users.find(u => u.username === 'Wayner')) {
        const defaultUsers = [
            { username: 'Admin', password: '123', role: 'admin', sector: 'admin' },
            { username: 'Balanca', password: '123', role: 'user', sector: 'recebimento' },
            { username: 'Wayner', password: '123', role: 'user', sector: 'conferente', subType: 'INFRA' }
        ];

        defaultUsers.forEach(newUser => {
             if (!users.find(u => u.username === newUser.username)) {
                 users.push(newUser);
             }
        });
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    // 2. Configura o Listener do Formulário de Registro (Mantido igual)
    const formRegistro = document.getElementById('formRegistro');
    if (formRegistro) {
        formRegistro.addEventListener('submit', (e) => {
            e.preventDefault();

            alert("Solicitação enviada.");
            fecharRegistro();
        });
    }
});
