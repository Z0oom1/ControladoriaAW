// ==========================================================================
// 1. SISTEMA DE SOM E NOTIFICAÇÃO (TURBINADO)
// ==========================================================================

let globalAudioCtx = null;

if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") console.log("Notificações ativadas.");
        });
    }
}

document.addEventListener('click', function unlockAudio() {
    if (!globalAudioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            globalAudioCtx = new AudioContext();
            const osc = globalAudioCtx.createOscillator();
            const gain = globalAudioCtx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(globalAudioCtx.destination);
            osc.start(0);
            osc.stop(0.1);
        }
    }
    document.removeEventListener('click', unlockAudio);
});

function playBeep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        let ctx = globalAudioCtx;
        if (!ctx || ctx.state === 'closed') {
            ctx = new AudioContext();
            globalAudioCtx = ctx;
        } else if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine'; 
        osc.frequency.value = 550; 
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
    } catch (e) { console.warn("Audio bloqueado:", e); }
}

function sendSystemNotification(title, body, targetView, targetId) {
    playBeep();
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") createVisualNotification(title, body, targetView, targetId);
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") createVisualNotification(title, body, targetView, targetId);
        });
    }
}

function createVisualNotification(title, body, targetView, targetId) {
    try {
        const tag = targetId ? `wilson-${targetId}` : 'wilson-sys';
        const notif = new Notification(title, {
            body: body,
            icon: '',
            requireInteraction: true,
            tag: tag
        });
        notif.onclick = function() {
            window.focus();
            if (targetView) navTo(targetView);
            if (targetId && targetView === 'mapas') loadMap(targetId);
            this.close();
        };
    } catch (e) { console.error("Erro visual notif:", e); }
}

// ==========================================================================
// 2. INICIALIZAÇÃO E DADOS
// ==========================================================================

function initRoleBasedUI() {
    // 1. Esconder/Mostrar botões globais baseados no perfil
    if (isConferente) {
        const fab = document.getElementById('fabAddTruck');
        if(fab) fab.style.display = 'none';
        document.getElementById('menuCarregamento').style.display = 'none';
    } else {
        const fab = document.getElementById('fabAddTruck');
        if(fab) fab.style.display = 'flex';
        document.getElementById('menuCarregamento').style.display = 'flex';
    }
    
    // Menu Matéria Prima
    if (isRecebimento) document.getElementById('menuMateriaPrima').style.display = 'flex';
    else document.getElementById('menuMateriaPrima').style.display = 'none';

    // 2. LÓGICA DE COLUNAS DA FILA
    if (isConferente && userSubType) {
        //Primeiro, esconde tudo para depois mostrar só o necessario
        const colAlm = document.getElementById('col-ALM');
        const colGava = document.getElementById('col-GAVA');
        const colOut = document.getElementById('col-OUT');
        
        colAlm.style.display = 'none';
        colGava.style.display = 'none';
        colOut.style.display = 'none';

        // título padrão da coluna Outros
        const outTitle = colOut.querySelector('h3'); 
        if(outTitle) outTitle.innerText = "OUTROS SETORES";

        // CASO 1: ALMOXARIFADO (Vê Doca e Gava)
        if (userSubType === 'ALM') {
            colAlm.style.display = 'flex';
            colGava.style.display = 'flex';
        }
        
        // CASO 2: GAVA (Vê só Gava)
        else if (userSubType === 'GAVA') {
            colGava.style.display = 'flex';
        }
        
        // CASO 3: SETORES ESPECÍFICOS (Infra, Manut, Lab, etc)
        else {
            // Mostra a coluna "Outros"
            colOut.style.display = 'flex';
            
            // Define nomes amigáveis baseados no código
            const sectorNames = {
                'INFRA': 'INFRAESTRUTURA',
                'MANUT': 'MANUTENÇÃO',
                'LAB': 'LABORATÓRIO',
                'PESAGEM': 'SALA DE PESAGEM',
                'SST': 'SST',
                'CD': 'CD',
                'COMPRAS': 'COMPRAS'
            };

            
            if (sectorNames[userSubType]) {
                if(outTitle) outTitle.innerText = sectorNames[userSubType]; 
            }
        }
    }

    // Ajuste mobile
    if (window.innerWidth <= 1024) document.querySelector('.mobile-header-bar').style.display = 'flex';

    // Datas padrão
    const dateInputStart = document.getElementById('repDateStart');
    const dateInputEnd = document.getElementById('repDateEnd');
    if(dateInputStart && dateInputEnd) {
        const d = new Date();
        dateInputEnd.value = d.toISOString().split('T')[0];
        d.setDate(1); 
        dateInputStart.value = d.toISOString().split('T')[0];
    }
}

const today = new Date().toISOString().split('T')[0];
// Define datas padrão nos inputs de filtro simples
const filters = ['patioDateFilter', 'mapDate', 'mpDateFilter', 'carrDateFilter', 'mapListDateFilter'];
filters.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = today;
});

// --- VARIÁVEIS GLOBAIS ---
let patioData = JSON.parse(localStorage.getItem('aw_caminhoes_v2')) || [];
let mapData = JSON.parse(localStorage.getItem('mapas_cegos_v3')) || [];
let mpData = JSON.parse(localStorage.getItem('aw_materia_prima')) || [];
let carregamentoData = JSON.parse(localStorage.getItem('aw_carregamento')) || [];
let requests = JSON.parse(localStorage.getItem('aw_requests')) || [];
let tmpItems = [];
let currentMapId = null;
let contextMapId = null;
let contextMPId = null;
let contextCarrId = null;
let contextTruckId = null; 
let editTmpItems = []; 
let isEditingMode = false;
let filteredReportData = [];
let currentReportType = '';

const defaultProducts = ["CX PAP 125A", "AÇ CRISTAL", "AÇ LIQUIDO", "AÇ REFINADO", "SAL REFINADO"];

// --- NAVEGAÇÃO ---
function toggleMobileMenu() { document.querySelector('.main-sidebar').classList.toggle('show-mobile'); }
function toggleMapListMobile() { document.getElementById('mobileMapList').classList.toggle('open'); }

function navTo(view, el) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + view);
    if(target) target.classList.add('active');

    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    if (el) el.classList.add('active');
    document.querySelector('.main-sidebar').classList.remove('show-mobile');

    const titles = { 
        patio: 'Controle de Pátio', 
        mapas: 'Mapas Cegos', 
        relatorios: 'Relatórios', 
        notificacoes: 'Notificações', 
        'materia-prima': 'Matéria Prima', 
        'carregamento': 'Carregamento',
        'configuracoes': 'Configurações'
    };
    document.getElementById('pageTitle').textContent = titles[view] || 'Sistema';

    if (view === 'patio') renderPatio();
    if (view === 'mapas') { renderMapList(); if (mapData.length > 0 && !currentMapId) loadMap(mapData[mapData.length - 1].id); }
    if (view === 'materia-prima') renderMateriaPrima();
    if (view === 'carregamento') renderCarregamento();
    if (view === 'notificacoes') renderRequests();
    if (view === 'configuracoes') updatePermissionStatus();
}

function logout() { sessionStorage.removeItem('loggedInUser'); window.location.href = 'login.html'; }

// ==========================================================================
// 3. CONTROLE DE PÁTIO
// ==========================================================================

function modalTruckOpen() {
    tmpItems = []; 
    document.getElementById('tmpList').innerHTML = '';
    document.getElementById('addPlaca').value = ''; 
    document.getElementById('addEmpresa').value = '';
    document.getElementById('chkBalan').checked = false;
    document.getElementById('chkLaudo').checked = false; 
    document.getElementById('modalTruck').style.display = 'flex';
}

function openProdSelect() {
    const list = document.getElementById('prodList'); list.innerHTML = '';
    defaultProducts.forEach(p => { list.innerHTML += `<div class="prod-select-item" onclick="selectProd('${p}')">${p}</div>`; });
    document.getElementById('modalProductSelect').style.display = 'flex';
    document.getElementById('prodSearch').value = ''; document.getElementById('prodSearch').focus();
}

function filterProducts() {
    const term = document.getElementById('prodSearch').value.toUpperCase(); const list = document.getElementById('prodList'); list.innerHTML = '';
    defaultProducts.filter(p => p.includes(term)).forEach(p => { list.innerHTML += `<div class="prod-select-item" onclick="selectProd('${p}')">${p}</div>`; });
}

function selectProd(name) { 
    if(isEditingMode) {
        document.getElementById('editTmpProd').value = name;
    } else {
        document.getElementById('tmpProd').value = name; 
    }
    document.getElementById('modalProductSelect').style.display = 'none';
    isEditingMode = false; 
}

function addTmpItem() {
    const nf = document.getElementById('tmpNF').value; const prod = document.getElementById('tmpProd').value;
    if (nf && prod) { tmpItems.push({ nf, prod }); document.getElementById('tmpList').innerHTML += `<li><b>${nf}</b>: ${prod}</li>`; document.getElementById('tmpProd').value = ''; document.getElementById('tmpProd').focus(); }
}

function saveTruckAndMap() {
    const empresa = document.getElementById('addEmpresa').value;
    const placa = document.getElementById('addPlaca').value;
    const destinoKey = document.getElementById('addDestino').value;
    const isBalan = document.getElementById('chkBalan').checked;
    const hasLaudo = document.getElementById('chkLaudo').checked; 

    const sectorMapping = { 'DOCA': { name: 'DOCA (ALM)', col: 'ALM' }, 'GAVA': { name: 'GAVA', col: 'GAVA' }, 'MANUTENCAO': { name: 'MANUTENÇÃO', col: 'OUT' }, 'INFRA': { name: 'INFRAESTRUTURA', col: 'OUT' }, 'PESAGEM': { name: 'SALA DE PESAGEM', col: 'OUT' }, 'LAB': { name: 'LABORATÓRIO', col: 'OUT' }, 'SST': { name: 'SST', col: 'OUT' } };
    const sectorData = sectorMapping[destinoKey] || { name: 'OUTROS', col: 'OUT' };

    if (!empresa || tmpItems.length === 0 || !placa) { alert('Preencha todos os campos.'); return; }

    const idBase = Date.now().toString();
    const sequencia = patioData.filter(t => t.chegada.startsWith(today)).length + 1;
    const nowIso = new Date().toISOString();

    const caminhao = { 
        id: idBase, 
        empresa: empresa, 
        local: sectorData.col, 
        localSpec: sectorData.name, 
        status: 'FILA', 
        placa: placa.toUpperCase(), 
        sequencia: sequencia, 
        recebimentoNotified: false, 
        saidaNotified: false, 
        comLaudo: hasLaudo, 
        releasedBy: null,
        chegada: nowIso, 
        saida: null, 
        cargas: [{ numero: 'Várias', produtos: tmpItems.map(i => ({ nome: i.prod, qtd: '-', nf: i.nf })) }] 
    };
    patioData.push(caminhao);

    const rows = tmpItems.map((item, idx) => ({
        id: idBase + '_' + idx, 
        desc: item.prod, 
        qty: '',      // Quantidade Física (Conferente)
        qty_nf: '',   // Quantidade Fiscal (Recebimento)
        nf: item.nf, 
        forn: empresa, 
        owners: { desc: 'sistema', nf: 'sistema', forn: 'sistema' }
    }));
    
    // Linhas extras vazias também precisam do campo
    for (let i = 0; i < 3; i++) {
        rows.push({ id: idBase + '_extra_' + i, desc: '', qty: '', qty_nf: '', nf: '', forn: '', owners: {} });
    }
    const novoMapa = { id: idBase, date: today, rows: rows, placa: placa.toUpperCase(), setor: sectorData.name, alm: false, manut: false, launched: false, finishedNotified: false, signatures: { receb: null, conf: null }, forceUnlock: false, divergence: null };
    mapData.push(novoMapa);

    if (isBalan) {
        const firstProd = tmpItems[0] ? tmpItems[0].prod : 'Diversos'; const firstNF = tmpItems[0] ? tmpItems[0].nf : '';
        mpData.push({ id: idBase, date: today, produto: firstProd, empresa: empresa, placa: placa.toUpperCase(), local: sectorData.name, chegada: nowIso, entrada: null, saida: null, tara: 0, bruto: 0, liq: 0, pesoNF: 0, difKg: 0, difPerc: 0, nf: firstNF, notes: '' });
        localStorage.setItem('aw_materia_prima', JSON.stringify(mpData));
    }

    localStorage.setItem('aw_caminhoes_v2', JSON.stringify(patioData)); 
    localStorage.setItem('mapas_cegos_v3', JSON.stringify(mapData));
    document.getElementById('modalTruck').style.display = 'none'; 
    renderPatio(); 
    alert(`Caminhão (Seq #${sequencia}) registrado!`);
}

function renderPatio() {
    const filterDate = document.getElementById('patioDateFilter').value;
    
    // Limpa colunas
    ['ALM', 'GAVA', 'OUT', 'SAIU'].forEach(c => { 
        document.getElementById('list-' + c).innerHTML = ''; 
        if (c !== 'SAIU') document.getElementById('count-' + c).textContent = '0'; 
    });

    // Filtros
    const list = patioData.filter(c => { 
        const cDate = c.chegada.split('T')[0]; 
        const isSaiu = c.status === 'SAIU';
        if (isSaiu && !c.saida.startsWith(filterDate)) return false;
        if (!isSaiu && cDate !== filterDate) return false;

        // Filtros de Setor 
        if (isAdmin || isRecebimento || !loggedUser) return true;
        if (isConferente && userSubType) {
            if (userSubType === 'ALM') return c.local === 'ALM' || c.local === 'GAVA';
            if (userSubType === 'GAVA') return c.local === 'GAVA';
            if (userSubType !== 'OUT') return c.localSpec && c.localSpec.toUpperCase().includes(userSubType);
            return c.local === 'OUT';
        }
        return true; 
    }).sort((a, b) => new Date(a.chegada) - new Date(b.chegada));

    // Renderização
    list.forEach(c => {
        const isSaiu = c.status === 'SAIU'; 
        let col = isSaiu ? 'SAIU' : c.local; 
        if (!col) col = 'OUT';
        
        const container = document.getElementById('list-' + col); 
        if (!container) return;
        
        if (!isSaiu) { 
            const cnt = document.getElementById('count-' + col); 
            cnt.textContent = parseInt(cnt.textContent) + 1; 
        }

        const card = document.createElement('div'); card.className = 'truck-card';
        card.onclick = function (e) { if (e.target.tagName !== 'BUTTON') this.classList.toggle('expanded'); };
        card.oncontextmenu = function(e) { e.preventDefault(); if(!isSaiu) openTruckContextMenu(e.pageX, e.pageY, c.id); };

        // --- LÓGICA NOVA DOS BOTÕES ---
        let btns = '';
        if (c.status === 'FILA') {
            // Passo 1: Conferente chama o caminhão
            btns = `<button onclick="changeStatus('${c.id}','LIBERADO')" style="width:100%; background:#1976D2; color:white; border:none; padding:12px; margin-top:5px; border-radius:3px; font-weight:bold;">CHAMAR MOTORISTA</button>`;
        } 
        else if (c.status === 'LIBERADO') {
            // Passo 2: Recebimento confirma que ele entrou
            btns = `<button onclick="changeStatus('${c.id}','ENTROU')" style="width:100%; background:#2e7d32; color:white; border:none; padding:12px; margin-top:5px; border-radius:3px; font-weight:bold; animation: pulse 2s infinite;">CONFIRMAR ENTRADA</button>`;
        }
        else if (c.status === 'ENTROU') {
            // Passo 3: Finalizar
            btns = `<button onclick="changeStatus('${c.id}','SAIU')" style="width:100%; background:#555; color:white; border:none; padding:12px; margin-top:5px; border-radius:3px;">REGISTRAR SAÍDA</button>`;
        }

        // --- BADGES NOVAS ---
        let statusBadge = '';
        if (c.status === 'FILA') statusBadge = '<div class="status-badge st-wait">Aguardando</div>';
        else if (c.status === 'LIBERADO') statusBadge = '<div class="status-badge st-called"><i class="fas fa-bullhorn"></i> Chamado</div>';
        else if (c.status === 'ENTROU') statusBadge = '<div class="status-badge st-ok">No Pátio</div>';
        else statusBadge = '<div class="status-badge st-out">Saiu</div>';

        let prodsHtml = ''; if (c.cargas && c.cargas[0]) c.cargas[0].produtos.forEach(p => { prodsHtml += `<div class="prod-row"><span>${p.nome}</span><span>${p.qtd}</span></div>`; });
        let laudoHtml = c.comLaudo ? '<span class="laudo-badge laudo-sim"><i class="fas fa-check"></i> COM LAUDO</span>' : '<span class="laudo-badge laudo-nao">SEM LAUDO</span>';

        card.innerHTML = `<div class="card-basic"><div><div class="card-company">${c.empresa} <small>(#${c.sequencia})</small></div><small>${new Date(c.chegada).toLocaleTimeString().slice(0, 5)} - Placa: ${c.placa}</small><br>${laudoHtml}<div class="sector-tag">${c.localSpec || c.local}</div></div><span class="card-nf">NF: ${c.cargas ? c.cargas[0].produtos[0].nf : '?'}</span></div>${statusBadge}<div class="card-expanded-content">${prodsHtml}${!isSaiu ? btns : ''}</div>`;
        container.appendChild(card);
    });
}

function changeStatus(id, st) {
    const idx = patioData.findIndex(c => c.id === id);
    if (idx > -1) {
        const now = new Date().toISOString(); 
        patioData[idx].status = st;
        
        // Se mudou para LIBERADO (Chamou o motorista)
        if (st === 'LIBERADO') {
            patioData[idx].recebimentoNotified = false; // Reseta para disparar o popup pro Recebimento
            patioData[idx].releasedBy = loggedUser.username; // Quem chamou foi quem clicou agora
        }

        // Se mudou para ENTROU (Motorista chegou na cancela)
        if (st === 'ENTROU') {
            // Se tiver registro de matéria prima, marca a hora da entrada agora
            const mpIdx = mpData.findIndex(m => m.id === id);
            if (mpIdx > -1) mpData[mpIdx].entrada = now;
        }

        // Se mudou para SAIU
        if (st === 'SAIU') { 
            patioData[idx].saida = now; 
            const mpIdx = mpData.findIndex(m => m.id === id);
            if (mpIdx > -1) mpData[mpIdx].saida = now; 
        }

        localStorage.setItem('aw_caminhoes_v2', JSON.stringify(patioData)); 
        localStorage.setItem('aw_materia_prima', JSON.stringify(mpData));
        renderPatio();
    }
}

// ==========================================================================
// 4. MONITORAMENTO E NOTIFICAÇÕES (LÓGICA)
// ==========================================================================

function checkForNotifications() {
    patioData = JSON.parse(localStorage.getItem('aw_caminhoes_v2')) || [];
    mapData = JSON.parse(localStorage.getItem('mapas_cegos_v3')) || [];
    requests = JSON.parse(localStorage.getItem('aw_requests')) || [];
    
    if(document.getElementById('view-patio') && document.getElementById('view-patio').classList.contains('active')) {
        renderPatio(); 
    }

    // 1. NOTIFICAÇÃO DE LIBERAÇÃO (Mudou de ENTROU para LIBERADO)
    // O Conferente clicou em "Chamar". O Recebimento recebe o alerta.
    const truckCall = patioData.find(c => c.status === 'LIBERADO' && !c.recebimentoNotified);
    
    if (truckCall) {
        if (isRecebimento) { // Só mostra pro Recebimento/Portaria
            showNotificationPopup('release', truckCall);
            
            // Toca o som e manda notificação do navegador
            sendSystemNotification(
                "Motorista Chamado!",
                `Setor: ${truckCall.localSpec}\nEmpresa: ${truckCall.empresa}\nPlaca: ${truckCall.placa}\n\nPor favor, encaminhe o motorista para a doca.`,
                'patio',
                truckCall.id
            );
        }
    }

    // 2. NOTIFICAÇÃO DE SAÍDA (Mantida)
    const truckExit = patioData.find(c => c.status === 'SAIU' && !c.saidaNotified && c.saida && c.saida.startsWith(today));
    
    if (truckExit) {
        const liberadoPor = truckExit.releasedBy || "Recebimento";
        sendSystemNotification(
            "Descarga Finalizada!",
            `O caminhão da ${truckExit.empresa} (Placa: ${truckExit.placa}) já terminou. Motorista liberado!`,
            'patio',
            truckExit.id
        );
        truckExit.saidaNotified = true;
        localStorage.setItem('aw_caminhoes_v2', JSON.stringify(patioData));
    }

    // 3. NOTIFICAÇÃO DE DIVERGÊNCIA
    const divReq = requests.find(r => r.type === 'divergence' && r.target === loggedUser.username && r.status === 'pending');
    if (divReq) {
        if(document.getElementById('modalNotification').style.display !== 'flex') {
            showNotificationPopup('divergence', divReq);
            sendSystemNotification(
                "⚠️ DIVERGÊNCIA RELATADA",
                `Motivo: ${divReq.msg}`,
                'mapas',
                divReq.mapId
            );
        }
    }

    // 4. NOTIFICAÇÃO DE MAPA FINALIZADO
    const mapFinished = mapData.find(m => m.launched === true && !m.finishedNotified && m.date === today);
    if (mapFinished && (isConferente || isAdmin)) { 
        sendSystemNotification(
            "Mapa Finalizado",
            `O Mapa Cego (Placa: ${mapFinished.placa}) foi lançado definitivo.`,
            'mapas',
            mapFinished.id
        );
        mapFinished.finishedNotified = true;
        localStorage.setItem('mapas_cegos_v3', JSON.stringify(mapData));
    }
    
    updateBadge();
}

setInterval(checkForNotifications, 4000);

function showNotificationPopup(type, data) {
    if(document.getElementById('modalNotification').style.display === 'flex') return;

    const p = document.getElementById('notifPopupContent');
    const liberadoPor = data.releasedBy || "Sistema";

    if (type === 'release') {
        p.innerHTML = `
            <div class="popup-header"><h2 style="color:green;">Liberado para Descarga!</h2></div>
            <div class="popup-body">
                <p><b>Liberado por:</b> ${liberadoPor}</p>
                <p><b>Empresa:</b> ${data.empresa}</p>
                <p><b>Placa:</b> ${data.placa}</p>
                <p style="margin-top:10px; color:#555;">O veículo foi liberado na portaria.</p>
            </div>
            <div style="padding:20px"><button class="btn btn-save" style="width:100%" onclick="confirmNotification('release','${data.id}')">CIENTE</button></div>`;
    } else {
        p.innerHTML = `
            <div class="popup-header"><h2 style="color:red;"><i class="fas fa-exclamation-triangle"></i> Divergência!</h2></div>
            <div class="popup-body"><b>Motivo:</b> ${data.msg}</div>
            <div style="padding:20px"><button class="btn btn-edit" style="width:100%" onclick="confirmNotification('divergence','${data.id}')">VERIFICAR</button></div>`;
    }
    document.getElementById('modalNotification').style.display = 'flex';
}

function confirmNotification(type, id) {
    if (type === 'release') {
        const i = patioData.findIndex(c => c.id === id);
        if (i > -1) {
            patioData[i].recebimentoNotified = true;
            localStorage.setItem('aw_caminhoes_v2', JSON.stringify(patioData));
        }
    } else {
        const i = requests.findIndex(r => r.id == id);
        if (i > -1) {
            requests[i].status = 'seen';
            localStorage.setItem('aw_requests', JSON.stringify(requests));
            navTo('mapas');
            if(requests[i].mapId) loadMap(requests[i].mapId);
            updateBadge();
        }
    }
    document.getElementById('modalNotification').style.display = 'none';
}

// ==========================================================================
// 5. MATÉRIA PRIMA (RESTAURADO)
// ==========================================================================

function renderMateriaPrima() {
    const tbody = document.getElementById('mpBody'); tbody.innerHTML = '';
    const list = mpData.filter(m => m.date === document.getElementById('mpDateFilter').value);
    if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:20px;">Nenhum registro.</td></tr>'; return; }
    list.forEach(item => {
        const tr = document.createElement('tr');
        let noteIcon = item.notes ? `<i class="fas fa-sticky-note mp-note-icon" onclick="viewNoteMP('${item.id}')"></i>` : '';
        tr.oncontextmenu = function (e) { e.preventDefault(); contextMPId = item.id; openMPContextMenu(e.pageX, e.pageY); };
        tr.innerHTML = `<td style="text-align:center;">${new Date(item.date).toLocaleDateString()}</td><td style="font-weight:bold;">${item.produto}<br><small style="color:#666">${item.empresa}</small></td><td style="text-align:center;">${item.placa}</td><td style="text-align:center;">${item.local}</td><td style="text-align:center;">${item.chegada ? new Date(item.chegada).toLocaleTimeString().slice(0, 5) : '-'}</td><td style="text-align:center;">${item.entrada ? new Date(item.entrada).toLocaleTimeString().slice(0, 5) : '-'}</td><td><input type="number" class="mp-input" value="${item.tara}" onchange="updateWeights('${item.id}','tara',this.value)"></td><td><input type="number" class="mp-input" value="${item.bruto}" onchange="updateWeights('${item.id}','bruto',this.value)"></td><td><input type="text" class="mp-read" value="${item.liq}" readonly></td><td><input type="number" class="mp-input" value="${item.pesoNF}" onchange="updateWeights('${item.id}','pesoNF',this.value)"></td><td><input type="text" class="mp-read" value="${item.difKg}" readonly></td><td><input type="text" class="mp-read" value="${item.difPerc}%" readonly></td><td style="text-align:center;">${item.saida ? new Date(item.saida).toLocaleTimeString().slice(0, 5) : '-'}</td><td style="text-align:center;">${item.nf} ${noteIcon}</td>`;
        tbody.appendChild(tr);
    });
}

function openMPContextMenu(x, y) {
    const menu = document.getElementById('ctxMenuMP');
    menu.innerHTML = `<div class="ctx-item" onclick="openEditMPModal()"><i class="fas fa-edit"></i> Editar Dados</div><div class="ctx-item" onclick="openNoteMPModal()"><i class="fas fa-sticky-note"></i> Deixar Observação</div>`;
    menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.style.display = 'block';
    document.getElementById('ctxMenu').style.display = 'none'; document.getElementById('ctxMenuCarr').style.display = 'none';
    document.getElementById('ctxMenuTruck').style.display = 'none';
}

function openEditMPModal() {
    const item = mpData.find(m => m.id === contextMPId);
    if (item) { document.getElementById('editMPId').value = item.id; document.getElementById('editMPEmpresa').value = item.empresa; document.getElementById('editMPPlaca').value = item.placa; document.getElementById('editMPProduto').value = item.produto; document.getElementById('modalEditMP').style.display = 'flex'; }
    closeContextMenu();
}
function saveEditMP() {
    const id = document.getElementById('editMPId').value; const emp = document.getElementById('editMPEmpresa').value; const placa = document.getElementById('editMPPlaca').value; const prod = document.getElementById('editMPProduto').value;
    const mpIdx = mpData.findIndex(m => m.id === id); if (mpIdx > -1) { mpData[mpIdx].empresa = emp; mpData[mpIdx].placa = placa; mpData[mpIdx].produto = prod; localStorage.setItem('aw_materia_prima', JSON.stringify(mpData)); }
    document.getElementById('modalEditMP').style.display = 'none'; renderMateriaPrima();
}
function openNoteMPModal() { const item = mpData.find(m => m.id === contextMPId); if (item) { document.getElementById('noteMPId').value = item.id; document.getElementById('noteMPText').value = item.notes || ''; document.getElementById('modalNoteMP').style.display = 'flex'; } closeContextMenu(); }
function saveNoteMP() { const id = document.getElementById('noteMPId').value; const txt = document.getElementById('noteMPText').value; const mpIdx = mpData.findIndex(m => m.id === id); if (mpIdx > -1) { mpData[mpIdx].notes = txt; localStorage.setItem('aw_materia_prima', JSON.stringify(mpData)); } document.getElementById('modalNoteMP').style.display = 'none'; renderMateriaPrima(); }
function viewNoteMP(id) { const item = mpData.find(m => m.id === id); if (item) alert("OBSERVAÇÃO:\n\n" + item.notes); }
function updateWeights(id, field, val) {
    const idx = mpData.findIndex(m => m.id === id);
    if (idx > -1) {
        mpData[idx][field] = parseFloat(val) || 0;
        mpData[idx].liq = (mpData[idx].bruto || 0) - (mpData[idx].tara || 0);
        mpData[idx].difKg = mpData[idx].liq - (mpData[idx].pesoNF || 0);
        mpData[idx].difPerc = mpData[idx].pesoNF ? ((mpData[idx].difKg / mpData[idx].pesoNF) * 100).toFixed(2) : 0;
        localStorage.setItem('aw_materia_prima', JSON.stringify(mpData)); renderMateriaPrima();
    }
}

// ==========================================================================
// 6. CARREGAMENTO (RESTAURADO)
// ==========================================================================

function openModalCarregamento() { document.getElementById('carrMotorista').value = ''; document.getElementById('carrCavalo').value = ''; document.getElementById('carretaContainer').innerHTML = '<div style="margin-bottom:10px;"><label style="display:block; font-weight:bold;">Placa Carreta 1</label><input type="text" class="carrCarretaInput" style="width:100%; padding:8px; border:1px solid #ccc;"></div>'; document.getElementById('modalCarregamento').style.display = 'flex'; }
function addCarretaField() { document.getElementById('carretaContainer').innerHTML += `<div style="margin-bottom:10px;"><label style="display:block; font-weight:bold;">Placa Carreta</label><input type="text" class="carrCarretaInput" style="width:100%; padding:8px; border:1px solid #ccc;"></div>`; }
function saveCarregamento() {
    const mot = document.getElementById('carrMotorista').value; const cav = document.getElementById('carrCavalo').value; const carretas = [];
    document.querySelectorAll('.carrCarretaInput').forEach(inp => { if (inp.value) carretas.push(inp.value); });
    if (!mot || !cav) { alert("Preencha motorista e cavalo."); return; }
    carregamentoData.push({ id: Date.now().toString(), date: today, motorista: mot, cavalo: cav, carretas: carretas, tara: 0, bruto: 0, liq: 0, status: 'AGUARDANDO', checkin: new Date().toISOString(), start: null, checkout: null, notes: '' });
    localStorage.setItem('aw_carregamento', JSON.stringify(carregamentoData)); document.getElementById('modalCarregamento').style.display = 'none'; renderCarregamento();
}
function renderCarregamento() {
    const tbody = document.getElementById('carrBody'); tbody.innerHTML = '';
    const list = carregamentoData.filter(c => c.status !== 'SAIU' || c.date === document.getElementById('carrDateFilter').value);
    if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;">Nenhum carregamento.</td></tr>'; return; }
    list.forEach(c => {
        const tr = document.createElement('tr');
        let badgeClass = c.status === 'CARREGANDO' ? 'carr-ok' : (c.status === 'SAIU' ? 'carr-out' : 'carr-wait');
        let actionBtn = c.status === 'AGUARDANDO' ? `<button class="btn btn-resolve btn-small" onclick="changeStatusCarregamento('${c.id}', 'CARREGANDO')">LIBERAR</button>` : (c.status === 'CARREGANDO' ? `<button class="btn btn-edit btn-small" onclick="changeStatusCarregamento('${c.id}', 'SAIU')">FINALIZAR</button>` : '-');
        let noteIcon = c.notes ? `<i class="fas fa-sticky-note mp-note-icon" onclick="viewNoteCarr('${c.id}')"></i>` : '';

        tr.oncontextmenu = function (e) { e.preventDefault(); contextCarrId = c.id; openCarrContextMenu(e.pageX, e.pageY); };

        tr.innerHTML = `<td style="text-align:center;"><span class="carr-badge ${badgeClass}">${c.status}</span></td><td>${c.motorista} ${noteIcon}</td><td style="text-align:center;">${c.cavalo}</td><td>${c.carretas.join(', ')}</td><td><input type="number" class="mp-input" value="${c.tara}" onchange="updateCarrWeight('${c.id}', 'tara', this.value)"></td><td><input type="number" class="mp-input" value="${c.bruto}" onchange="updateCarrWeight('${c.id}', 'bruto', this.value)"></td><td><input type="text" class="mp-read" value="${c.liq}" readonly></td><td style="text-align:center;">${new Date(c.checkin).toLocaleTimeString().slice(0, 5)}</td><td style="text-align:center;">${c.start ? new Date(c.start).toLocaleTimeString().slice(0, 5) : '-'}</td><td style="text-align:center;">${c.checkout ? new Date(c.checkout).toLocaleTimeString().slice(0, 5) : '-'}</td><td style="text-align:center;">${actionBtn}</td>`;
        tbody.appendChild(tr);
    });
}
function updateCarrWeight(id, field, val) {
    const idx = carregamentoData.findIndex(c => c.id === id);
    if (idx > -1) { carregamentoData[idx][field] = parseFloat(val) || 0; carregamentoData[idx].liq = (carregamentoData[idx].bruto || 0) - (carregamentoData[idx].tara || 0); localStorage.setItem('aw_carregamento', JSON.stringify(carregamentoData)); renderCarregamento(); }
}
function changeStatusCarregamento(id, status) {
    const idx = carregamentoData.findIndex(c => c.id === id);
    if (idx > -1) { carregamentoData[idx].status = status; if (status === 'CARREGANDO') carregamentoData[idx].start = new Date().toISOString(); if (status === 'SAIU') carregamentoData[idx].checkout = new Date().toISOString(); localStorage.setItem('aw_carregamento', JSON.stringify(carregamentoData)); renderCarregamento(); }
}
function openCarrContextMenu(x, y) {
    const menu = document.getElementById('ctxMenuCarr');
    menu.innerHTML = `<div class="ctx-item" onclick="openEditCarrModal()"><i class="fas fa-edit"></i> Editar Dados</div><div class="ctx-item" onclick="openNoteCarrModal()"><i class="fas fa-sticky-note"></i> Deixar Observação</div><div class="ctx-divider"></div><div class="ctx-item" onclick="deleteCarregamento()" style="color:red"><i class="fas fa-trash"></i> Excluir Registro</div>`;
    menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.style.display = 'block';
    document.getElementById('ctxMenu').style.display = 'none'; document.getElementById('ctxMenuMP').style.display = 'none';
    document.getElementById('ctxMenuTruck').style.display = 'none';
}
function deleteCarregamento() {
    if (confirm("Excluir este carregamento?")) { carregamentoData = carregamentoData.filter(c => c.id !== contextCarrId); localStorage.setItem('aw_carregamento', JSON.stringify(carregamentoData)); renderCarregamento(); }
    closeContextMenu();
}
function openEditCarrModal() {
    const c = carregamentoData.find(x => x.id === contextCarrId);
    if (c) { document.getElementById('editCarrId').value = c.id; document.getElementById('editCarrMot').value = c.motorista; document.getElementById('editCarrCav').value = c.cavalo; document.getElementById('modalEditCarr').style.display = 'flex'; }
    closeContextMenu();
}
function saveEditCarr() {
    const id = document.getElementById('editCarrId').value; const idx = carregamentoData.findIndex(c => c.id === id);
    if (idx > -1) { carregamentoData[idx].motorista = document.getElementById('editCarrMot').value; carregamentoData[idx].cavalo = document.getElementById('editCarrCav').value; localStorage.setItem('aw_carregamento', JSON.stringify(carregamentoData)); renderCarregamento(); }
    document.getElementById('modalEditCarr').style.display = 'none';
}
function openNoteCarrModal() { const c = carregamentoData.find(x => x.id === contextCarrId); if (c) { document.getElementById('noteCarrId').value = c.id; document.getElementById('noteCarrText').value = c.notes || ''; document.getElementById('modalNoteCarr').style.display = 'flex'; } closeContextMenu(); }
function saveNoteCarr() { const id = document.getElementById('noteCarrId').value; const idx = carregamentoData.findIndex(c => c.id === id); if (idx > -1) { carregamentoData[idx].notes = document.getElementById('noteCarrText').value; localStorage.setItem('aw_carregamento', JSON.stringify(carregamentoData)); renderCarregamento(); } document.getElementById('modalNoteCarr').style.display = 'none'; }
function viewNoteCarr(id) { const c = carregamentoData.find(x => x.id === id); if (c) alert("OBSERVAÇÃO:\n\n" + c.notes); }

// ==========================================================================
// 7. MAPAS CEGOS (RESTAURADO E ATUALIZADO)
// ==========================================================================

function renderMapList() {
    const filterDate = document.getElementById('mapListDateFilter').value;
    const listEl = document.getElementById('mapList'); 
    listEl.innerHTML = '';
    
    // --- FILTRAGEM INTELIGENTE DE MAPAS ---
    const filteredMaps = mapData.filter(m => {
        // 1. Filtro de Data
        if (m.date !== filterDate) return false;

        // 2. Filtro de Permissão
        if (isAdmin || isRecebimento || !loggedUser) return true;

        if (isConferente && userSubType) {
            const setorMapa = (m.setor || '').toUpperCase();

            // REGRA: ALMOXARIFADO VÊ DOCA (ALM) E GAVA
            if (userSubType === 'ALM') {
                return setorMapa.includes('ALM') || setorMapa.includes('DOCA') || setorMapa.includes('GAVA');
            }

            // REGRA: GAVA SÓ VÊ GAVA
            if (userSubType === 'GAVA') {
                return setorMapa.includes('GAVA');
            }

            // REGRA: INFRAESTRUTURA SÓ VÊ INFRA
            if (userSubType === 'INFRA') {
                return setorMapa.includes('INFRA');
            }
            
            // REGRA: OUTROS VÊ O RESTO (Menos Infra, Doca e Gava)
            if (userSubType === 'OUT') {
                return !setorMapa.includes('INFRA') && !setorMapa.includes('GAVA') && !setorMapa.includes('ALM') && !setorMapa.includes('DOCA');
            }
        }
        return true;
    });

    // --- RENDERIZAÇÃO ---
    filteredMaps.slice().reverse().forEach(m => {
        const forn = m.rows.find(r => r.forn)?.forn || 'Sem Fornecedor';
        const divClass = (m.divergence && m.divergence.active) ? 'mc-item has-divergence' : 'mc-item';
        const selectedClass = currentMapId === m.id ? ' selected' : '';
        const el = document.createElement('div'); 
        el.className = divClass + selectedClass;
        el.innerHTML = `<b>${forn}</b><br><small>${m.date} | ${m.launched ? 'Lançado' : 'Rascunho'}</small><br><span style="font-size:0.7rem; color:#666;">${m.setor}</span>${(m.divergence && m.divergence.active) ? '<div style="color:red; font-weight:bold; font-size:0.7rem;">[DIVERGÊNCIA]</div>' : ''}`;
        el.onclick = () => { loadMap(m.id); if (window.innerWidth <= 1024) toggleMapListMobile(); };
        el.oncontextmenu = function (e) { e.preventDefault(); contextMapId = m.id; openContextMenu(e.pageX, e.pageY, m); };
        listEl.appendChild(el);
    });
}

function openContextMenu(x, y, map) {
    const menu = document.getElementById('ctxMenu'); let html = `<div class="ctx-item" onclick="openDivergenceModal('${map.id}')" style="color:#b71c1c"><i class="fas fa-exclamation-triangle"></i> Relatar Divergência</div><div class="ctx-divider"></div>`;
    if (isConferente) { html += `<div class="ctx-item" onclick="triggerRequest('edit', '${map.id}')"><i class="fas fa-edit"></i> Solicitar Edição</div><div class="ctx-item" onclick="triggerRequest('delete', '${map.id}')"><i class="fas fa-trash-alt"></i> Solicitar Exclusão</div>`; }
    else { html += `<div class="ctx-item" onclick="forceUnlockMap('${map.id}')"><i class="fas fa-unlock"></i> Forçar Edição</div><div class="ctx-divider"></div><div class="ctx-item" onclick="deleteMap('${map.id}')" style="color:red"><i class="fas fa-trash"></i> Excluir Mapa</div>`; }
    menu.innerHTML = html; menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.style.display = 'block';
    document.getElementById('ctxMenuMP').style.display = 'none'; document.getElementById('ctxMenuCarr').style.display = 'none';
}

function loadMap(id) {
    currentMapId = id; const map = mapData.find(m => m.id === id); if (!map) return;
    document.getElementById('mapDate').value = map.date; document.getElementById('mapPlaca').value = map.placa || ''; document.getElementById('mapSetor').value = map.setor || '';

    const statusDiv = document.getElementById('mapStatus'); const divBanner = document.getElementById('divBanner');
    if (map.divergence && map.divergence.active) {
        divBanner.style.display = 'block'; document.getElementById('divBannerText').innerHTML = `Relatado por: <b>${map.divergence.reporter}</b><br>"${map.divergence.reason}"`;
        document.getElementById('divResolveBtn').innerHTML = isRecebimento ? `<button class="btn btn-resolve" onclick="resolveDivergence('${map.id}')">Resolver</button>` : '';
    } else divBanner.style.display = 'none';

    if (map.forceUnlock) { statusDiv.textContent = "EM EDIÇÃO (DESBLOQUEADO)"; statusDiv.className = "status status-open"; statusDiv.style.background = "#fff3cd"; statusDiv.style.color = "#856404"; }
    else { statusDiv.textContent = map.launched ? 'LANÇADO (Bloqueado)' : 'Rascunho'; statusDiv.className = map.launched ? 'status status-closed' : 'status status-open'; statusDiv.style.background = ""; statusDiv.style.color = ""; }
    document.getElementById('sigReceb').textContent = map.signatures.receb || ''; document.getElementById('sigConf').textContent = map.signatures.conf || '';

    renderRows(map); renderMapList();
    const btnReq = document.getElementById('btnRequestEdit'); const btnLaunch = document.getElementById('btnLaunch');
    if (map.forceUnlock) { btnReq.style.display = 'none'; btnLaunch.style.display = 'inline-block'; btnLaunch.textContent = "Salvar Alterações e Re-Bloquear"; btnLaunch.onclick = function () { if (confirm("Re-Bloquear?")) { map.forceUnlock = false; saveData(); loadMap(id); } }; }
    else { btnLaunch.textContent = "Lançar Definitivo"; btnLaunch.onclick = launchMap; btnLaunch.style.display = map.launched ? 'none' : 'inline-block'; btnReq.style.display = (isConferente && (map.launched || isRecebimentoLockedForConferente(map))) ? 'inline-block' : 'none'; }
}

function isRecebimentoLockedForConferente(map) { return true; }
function isFieldLocked(map, field) {
    if (map.forceUnlock) {
        if (isConferente && field === 'qty') return false;
        if (isRecebimento && field !== 'qty') return false;
        if (isAdmin) return false;
        return true; 
    }
    if (!map.launched) {
        if (isAdmin) return false;
        if (isConferente) return field !== 'qty';
        if (isRecebimento) return field === 'qty';
    }
    return true;
}

function renderRows(map) {
    const tbody = document.getElementById('mapBody'); 
    tbody.innerHTML = '';
    const highlightArea = (map.divergence && map.divergence.active) ? map.divergence.area : null;

    map.rows.forEach(row => {
        const tr = document.createElement('tr');
        
        // Função auxiliar para criar células com lógica de bloqueio
        const createCell = (field, cls, isBlind) => {
            let val = row[field] || '';
            const owner = row.owners && row.owners[field] ? row.owners[field] : '';
            const locked = isFieldLocked(map, field);
            
            // Lógica de Mapa Cego: Se for Conferente e o campo for 'qty_nf', ESCONDE O VALOR
            let extraClass = '';
            if (isBlind && isConferente && field === 'qty_nf') {
                val = "---"; // Mascara o valor visualmente
                extraClass = ' blind-mask'; // Aplica o borrão CSS
            }

            let finalClass = locked ? `cell ${cls} cell-locked` : `cell ${cls}`;
            if (highlightArea === 'geral' || highlightArea === field) finalClass += ' div-highlight';
            finalClass += extraClass;

            let editMarker = owner ? `<div class="owner-label">${owner}</div>` : '';
            if (owner && (!locked || map.forceUnlock)) finalClass += ' cell-edited';
            
            // Se estiver bloqueado OU for campo cego para conferente, fica readonly
            const isReadOnly = locked || (isConferente && field === 'qty_nf');

            return `<td><input type="text" class="${finalClass}" value="${val}" onchange="updateRow('${row.id}', '${field}', this.value)" ${isReadOnly ? 'readonly' : ''}>${editMarker}</td>`;
        };

        // MONTAGEM DA LINHA COM AS NOVAS COLUNAS
        // qty_nf = Recebimento (Cego para conferente)
        // qty = Conferente (Contagem Física)
        tr.innerHTML = `
            ${createCell('desc', 'cell-recebimento')}
            ${createCell('qty_nf', 'cell-recebimento', true)} 
            ${createCell('qty', 'cell-conferente')}
            ${createCell('nf', 'cell-recebimento')}
            ${createCell('forn', 'cell-recebimento')}
        `;
        tbody.appendChild(tr);
    });
}

function updateRow(rowId, field, val) { const map = mapData.find(m => m.id === currentMapId); const row = map.rows.find(r => r.id === rowId); if (row) { row[field] = val; if (!row.owners) row.owners = {}; row.owners[field] = loggedUser.username; saveData(); renderRows(map); } }
function createNewMap() { 
    const id = Date.now().toString(); 
    const rows = []; 
    for(let i=0; i<8; i++) rows.push({ id: id+'_'+i, desc:'', qty:'', nf:'', forn:'', owners:{} }); 
    
    mapData.push({ 
        id: id, 
        date: today, 
        rows: rows, 
        placa: '', 
        setor: '', 
        launched: false, 
        finishedNotified: false, 
        signatures: {}, 
        divergence: null 
    }); 
    
    saveData(); 
    renderMapList(); 
    loadMap(id); 
    if(window.innerWidth<=1024) toggleMapListMobile(); 
}
function saveCurrentMap() { const map = mapData.find(m => m.id === currentMapId); if (map) { map.date = document.getElementById('mapDate').value; map.placa = document.getElementById('mapPlaca').value; map.setor = document.getElementById('mapSetor').value; saveData(); alert('Salvo.'); renderMapList(); } }
function launchMap() { const map = mapData.find(m => m.id === currentMapId); if (!map.signatures.receb || !map.signatures.conf) { alert('Precisa assinar.'); return; } if (confirm('Lançar?')) { map.launched = true; saveData(); loadMap(currentMapId); } }
function signMap(role) { const map = mapData.find(m => m.id === currentMapId); if (map.launched && !map.forceUnlock) return; if (role === 'receb' && !isRecebimento) { alert('Só Recebimento'); return; } if (role === 'conf' && !isConferente) { alert('Só Conferente'); return; } const sig = loggedUser.username + ' (' + new Date().toLocaleTimeString().slice(0, 5) + ')'; if (role === 'receb') map.signatures.receb = sig; if (role === 'conf') map.signatures.conf = sig; saveData(); loadMap(currentMapId); }
function triggerRequest(type, mapId) { const targetId = mapId || currentMapId; if (!targetId) return; let targetUser = prompt(`Solicitar para quem?`); if (targetUser) { const reason = prompt("Motivo:"); if (reason) { requests.push({ id: Date.now(), mapId: targetId, user: loggedUser.username, target: targetUser, type: type, msg: reason, status: 'pending' }); localStorage.setItem('aw_requests', JSON.stringify(requests)); alert(`Solicitado.`); closeContextMenu(); } } }
function forceUnlockMap(id) { const map = mapData.find(m => m.id === id); if (map) { map.forceUnlock = true; saveData(); loadMap(id); closeContextMenu(); } }
function deleteMap(id) { if (confirm('Excluir?')) { mapData = mapData.filter(m => m.id !== id); saveData(); renderMapList(); if (currentMapId === id) { document.getElementById('mapBody').innerHTML = ''; currentMapId = null; } closeContextMenu(); } }

function openDivergenceModal(mapId) { contextMapId = mapId; document.getElementById('divUserList').innerHTML = [{ name: 'Caio', id: 'Caio' }, { name: 'Balanca', id: 'Balanca' }, { name: 'Fabricio', id: 'Fabricio' }, { name: 'Admin', id: 'Admin' }].map(u => `<label class="user-check-item"><input type="checkbox" value="${u.id}"> ${u.name}</label>`).join(''); document.getElementById('divReason').value = ''; document.getElementById('modalDivergence').style.display = 'flex'; closeContextMenu(); }
function submitDivergence() { const mapId = contextMapId; const reason = document.getElementById('divReason').value; const targets = Array.from(document.querySelectorAll('#divUserList input:checked')).map(c => c.value); if (!reason) return alert('Descreva'); const m = mapData.find(x => x.id === mapId); if (m) { m.divergence = { active: true, reason: reason, reporter: loggedUser.username, date: new Date().toISOString(), area: document.getElementById('divArea').value }; saveData(); targets.forEach(t => requests.push({ id: Date.now() + Math.random(), type: 'divergence', user: loggedUser.username, target: t, mapId: mapId, msg: reason, status: 'pending' })); localStorage.setItem('aw_requests', JSON.stringify(requests)); alert('Enviado'); document.getElementById('modalDivergence').style.display = 'none'; loadMap(mapId); renderMapList(); } }
function resolveDivergence(mapId) { if (confirm("Resolver?")) { const m = mapData.find(x => x.id === mapId); if (m) { m.divergence = null; saveData(); requests.push({ id: Date.now(), type: 'divergence_resolved', user: loggedUser.username, target: 'all', mapId: mapId, msg: 'Resolvido', status: 'done' }); localStorage.setItem('aw_requests', JSON.stringify(requests)); loadMap(mapId); renderMapList(); } } }

// --- OUTROS ---
function renderRequests() {
    const list = document.getElementById('reqList'); const hist = document.getElementById('historyList'); list.innerHTML = ''; hist.innerHTML = '';
    const myDivs = requests.filter(r => r.type === 'divergence' && r.target === loggedUser.username && r.status !== 'seen');
    myDivs.forEach(r => list.innerHTML += `<div class="notif-card" style="background:#ffebee; padding:10px; border:1px solid red; margin-bottom:5px;"><b>Divergência:</b> ${r.msg}<br><button class="btn btn-edit btn-small" onclick="confirmNotification('divergence','${r.id}')">Ler</button></div>`);
    if (!isConferente) {
        requests.filter(r => r.status === 'pending' && r.type !== 'divergence').forEach(r => { list.innerHTML += `<div class="card-extra" style="display:block; margin-bottom:5px;"><b>${r.type}:</b> ${r.msg} (de ${r.user})<br><button class="btn btn-save btn-small" onclick="resolveRequest(${r.id},'approved')">Aceitar</button> <button class="btn btn-launch btn-small" onclick="resolveRequest(${r.id},'rejected')">Recusar</button></div>`; });
    }
    requests.filter(r => r.status === 'approved' || r.status === 'rejected').slice(0, 10).forEach(r => hist.innerHTML += `<div class="hist-item"><div class="hist-text">Solicitação ${r.type} ${r.status}</div></div>`);
}
function resolveRequest(id, action) {
    const idx = requests.findIndex(r => r.id === id);
    if (idx > -1) {
        requests[idx].status = action; requests[idx].resolvedBy = loggedUser.username;
        if (action === 'approved') {
            if (requests[idx].type === 'edit') { const m = mapData.find(x => x.id === requests[idx].mapId); if (m) m.forceUnlock = true; }
            if (requests[idx].type === 'delete') mapData = mapData.filter(x => x.id !== requests[idx].mapId);
        }
        localStorage.setItem('aw_requests', JSON.stringify(requests)); saveData(); renderRequests(); updateBadge();
    }
}
function updateBadge() { const c = requests.filter(r => r.status === 'pending' && (r.target === loggedUser.username || (!isConferente && r.type !== 'divergence'))).length; const b = document.getElementById('badgeNotif'); if (c > 0) { b.innerText = c; b.style.display = 'inline-block'; } else { b.style.display = 'none'; } }

function saveData() { localStorage.setItem('mapas_cegos_v3', JSON.stringify(mapData)); }

// --- EDIÇÃO DE VEÍCULO (NOVO) ---
function openTruckContextMenu(x, y, id) {
    if(!isRecebimento) return; 
    contextTruckId = id;
    const menu = document.getElementById('ctxMenuTruck');
    menu.innerHTML = `<div class="ctx-item" onclick="openEditTruck('${id}')"><i class="fas fa-edit"></i> Editar Veículo / Produtos</div>`;
    menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.style.display = 'block';
    document.getElementById('ctxMenu').style.display = 'none';
    document.getElementById('ctxMenuMP').style.display = 'none';
    document.getElementById('ctxMenuCarr').style.display = 'none';
}

function openEditTruck(id) {
    const truck = patioData.find(t => t.id === id);
    if(!truck) return;

    // --- PROTEÇÃO CONTRA HTML DESATUALIZADO ---
    const elId = document.getElementById('editTruckId');
    const elDestino = document.getElementById('editTruckDestino');

    if (!elId || !elDestino) {
        alert("ERRO: O HTML da página parece desatualizado.\n\nPor favor, atualize a página com CTRL + F5.");
        console.error("Faltam elementos no DOM: editTruckId ou editTruckDestino não encontrados.");
        return;
    }
    // -------------------------------------------

    document.getElementById('editTruckId').value = id;
    document.getElementById('editTruckPlaca').value = truck.placa;
    document.getElementById('editTruckLaudo').checked = truck.comLaudo || false;

    // Tenta identificar o setor atual
    let found = false;
    for(let i=0; i < elDestino.options.length; i++) {
        if(truck.localSpec && elDestino.options[i].text.includes(truck.localSpec)) {
            elDestino.selectedIndex = i;
            found = true;
            break;
        }
    }
    if(!found && truck.local) {
        if(truck.local === 'ALM') elDestino.value = 'DOCA';
        else if(truck.local === 'GAVA') elDestino.value = 'GAVA';
        else elDestino.value = 'MANUTENCAO'; 
    }

    // Carrega produtos
    editTmpItems = [];
    if(truck.cargas && truck.cargas[0]) {
        editTmpItems = truck.cargas[0].produtos.map(p => ({ nf: p.nf, prod: p.nome }));
    }
    renderEditTmpList();
    
    // Abre o modal usando a classe correta
    const modal = document.getElementById('modalEditTruck');
    modal.style.display = 'flex';
    
    // Fecha o menu de contexto
    closeContextMenu();
}

function renderEditTmpList() {
    const list = document.getElementById('editTmpList'); list.innerHTML = '';
    editTmpItems.forEach((item, index) => {
        list.innerHTML += `
            <li style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:3px;">
                <span><b>${item.nf}</b>: ${item.prod}</span>
                <button onclick="removeEditTmpItem(${index})" style="background:#ff3535; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-size:0.7rem;">X</button>
            </li>`;
    });
}

function addEditTmpItem() {
    const nf = document.getElementById('editTmpNF').value; const prod = document.getElementById('editTmpProd').value;
    if (nf && prod) { editTmpItems.push({ nf, prod }); renderEditTmpList(); document.getElementById('editTmpProd').value = ''; document.getElementById('editTmpProd').focus(); }
}
function removeEditTmpItem(index) { editTmpItems.splice(index, 1); renderEditTmpList(); }
function openProdSelectForEdit() { isEditingMode = true; openProdSelect(); }

function saveEditTruck() {
    const id = document.getElementById('editTruckId').value;
    const novaPlaca = document.getElementById('editTruckPlaca').value.toUpperCase();
    const novoLaudo = document.getElementById('editTruckLaudo').checked;
    const novoDestinoKey = document.getElementById('editTruckDestino').value;

    if(!novaPlaca || editTmpItems.length === 0) { 
        alert("A placa e pelo menos um produto são obrigatórios."); 
        return; 
    }

    // Mapeamento de Setores (Igual ao do Registro Inicial)
    const sectorMapping = { 
        'DOCA': { name: 'DOCA (ALM)', col: 'ALM' }, 
        'GAVA': { name: 'GAVA (ALM)', col: 'GAVA' }, 
        'MANUTENCAO': { name: 'MANUTENÇÃO', col: 'OUT' }, 
        'INFRA': { name: 'INFRAESTRUTURA', col: 'OUT' }, 
        'PESAGEM': { name: 'SALA DE PESAGEM', col: 'OUT' }, 
        'LAB': { name: 'LABORATÓRIO', col: 'OUT' }, 
        'SST': { name: 'SST', col: 'OUT' },
        'CD': { name: 'CD / EXPEDIÇÃO', col: 'OUT' },
        'COMPRAS': { name: 'COMPRAS', col: 'OUT' }
    };
    const sectorData = sectorMapping[novoDestinoKey] || { name: 'OUTROS', col: 'OUT' };

    // Atualiza Pátio
    const idx = patioData.findIndex(t => t.id === id);
    if(idx > -1) {
        patioData[idx].placa = novaPlaca;
        patioData[idx].comLaudo = novoLaudo;
        patioData[idx].local = sectorData.col;      // Atualiza Coluna (ALM, GAVA, OUT)
        patioData[idx].localSpec = sectorData.name; // Atualiza Nome bonito
        patioData[idx].cargas[0].produtos = editTmpItems.map(i => ({ nome: i.prod, qtd: '-', nf: i.nf }));
    }

    // Atualiza Mapa Cego
    const mapIdx = mapData.findIndex(m => m.id === id);
    if(mapIdx > -1) {
         // Se o mapa não foi lançado, atualiza os produtos tambem
         if(!mapData[mapIdx].launched) {
             const rows = editTmpItems.map((item, i) => ({ 
                 id: id + '_' + i, 
                 desc: item.prod, 
                 qty: '', 
                 nf: item.nf, 
                 forn: mapData[mapIdx].rows[0]?.forn || 'Diversos', 
                 owners: { desc: 'sistema', nf: 'sistema', forn: 'sistema' } 
             }));
             // Completa com linhas vazias até 8
             for (let i = rows.length; i < 8; i++) {
                 rows.push({ id: id + '_extra_' + i, desc: '', qty: '', nf: '', forn: '', owners: {} });
             }
             mapData[mapIdx].rows = rows;
         }
         mapData[mapIdx].placa = novaPlaca;
         mapData[mapIdx].setor = sectorData.name; // Atualiza o setor no mapa
    }

    // Atualiza Matéria Prima (Se houver)
    const mpIdx = mpData.findIndex(m => m.id === id);
    if(mpIdx > -1) { 
        mpData[mpIdx].placa = novaPlaca; 
        mpData[mpIdx].local = sectorData.name;
        if(editTmpItems[0]) { 
            mpData[mpIdx].produto = editTmpItems[0].prod; 
            mpData[mpIdx].nf = editTmpItems[0].nf; 
        } 
    }

    // Salva Tudo
    localStorage.setItem('aw_caminhoes_v2', JSON.stringify(patioData));
    localStorage.setItem('mapas_cegos_v3', JSON.stringify(mapData));
    localStorage.setItem('aw_materia_prima', JSON.stringify(mpData));
    
    renderPatio();
    document.getElementById('modalEditTruck').style.display = 'none';
    alert("Dados e Fila atualizados com sucesso!");
}

function deleteTruck() {
    const id = document.getElementById('editTruckId').value;
    const senhaDigitada = prompt("⚠️ AÇÃO IRREVERSÍVEL\n\nDigite a senha da sua conta para confirmar a exclusão:");

    if (!senhaDigitada) return; // Cancelou

    // Verifica a senha baseada no usuário logado atualmente
    // (Lógica simples baseada no login.js)
    const role = loggedUser.role; // admin, portaria, recebimento, conferente
    const senhas = {
        'admin': 'admin123',
        'portaria': 'portaria123',
        'recebimento': 'receb123',
        'conferente': 'conf123'
    };

    if (senhaDigitada !== senhas[role]) {
        alert("Senha incorreta! Exclusão cancelada.");
        return;
    }

    if(!confirm("Tem certeza absoluta? Isso apagará o caminhão, o mapa cego e os registros de pesagem.")) {
        return;
    }

    // Remove de todas as listas
    patioData = patioData.filter(t => t.id !== id);
    mapData = mapData.filter(m => m.id !== id);
    mpData = mpData.filter(m => m.id !== id);
    
    // Remove notificações pendentes desse ID
    requests = requests.filter(r => r.mapId !== id);

    // Salva Tudo
    localStorage.setItem('aw_caminhoes_v2', JSON.stringify(patioData));
    localStorage.setItem('mapas_cegos_v3', JSON.stringify(mapData));
    localStorage.setItem('aw_materia_prima', JSON.stringify(mpData));
    localStorage.setItem('aw_requests', JSON.stringify(requests));

    renderPatio();
    document.getElementById('modalEditTruck').style.display = 'none';
    alert("Registro excluído com sucesso.");
}

function closeContextMenu() { 
    document.getElementById('ctxMenu').style.display = 'none'; 
    document.getElementById('ctxMenuMP').style.display = 'none'; 
    document.getElementById('ctxMenuCarr').style.display = 'none';
    document.getElementById('ctxMenuTruck').style.display = 'none';
}

// --- CONFIGURAÇÕES ---
function manualRequestPermission() {
    Notification.requestPermission().then(permission => {
        updatePermissionStatus();
        if (permission === "granted") {
            new Notification("Sistema Wilson", { body: "Permissão concedida!", icon: 'https://cdn-icons-png.flaticon.com/512/3209/3209994.png' });
        } else { alert("Permissão negada. Verifique o cadeado na barra de endereço."); }
    });
}
function updatePermissionStatus() {
    const el = document.getElementById('permStatus'); if(!el) return;
    if (Notification.permission === 'granted') el.innerHTML = '<span style="color:green"><i class="fas fa-check-circle"></i> ATIVADO</span>';
    else if (Notification.permission === 'denied') el.innerHTML = '<span style="color:red"><i class="fas fa-times-circle"></i> BLOQUEADO</span>';
    else el.innerHTML = '<span style="color:orange"><i class="fas fa-exclamation-circle"></i> PENDENTE</span>';
}
function testNotification() { sendSystemNotification("Teste Manual", "Funcionando!", null, null); }


// ==========================================================================
// 8. RELATÓRIOS AVANÇADOS E PDF (NOVO)
// ==========================================================================

function generateAdvancedReport() {
    const type = document.getElementById('repType').value;
    const dateStartStr = document.getElementById('repDateStart').value;
    const dateEndStr = document.getElementById('repDateEnd').value;
    const term = document.getElementById('repSearchTerm').value.toUpperCase().trim();
    const resDiv = document.getElementById('repResultArea');
    
    currentReportType = type;

    if (!dateStartStr || !dateEndStr) {
        alert("Por favor, selecione a Data Inicial e Final.");
        return;
    }

    // --- LÓGICA ESPECIAL PARA RELATÓRIO DE DIVERGÊNCIAS ---
    if (type === 'divergencias') {
        resDiv.innerHTML = '';
        let reportData = {}; // { 'Fornecedor': { 'Produto': Saldo } }

        // 1. Varre todos os mapas (independente da data selecionada ou filtrando se preferir)

        let mapasNoPeriodo = mapData.filter(item => {
            let d = item.date; // Mapas já salvam data como YYYY-MM-DD
            return d >= dateStartStr && d <= dateEndStr;
        });

        mapasNoPeriodo.forEach(m => {
            if (!m.rows) return;
            m.rows.forEach(r => {
                // Tenta converter para número
                let qNf = parseFloat(r.qty_nf);
                let qCont = parseFloat(r.qty);

                // Só processa se ambos forem números válidos (evita erros com texto vazio)
                if (!isNaN(qNf) && !isNaN(qCont)) {
                    let diff = qCont - qNf; // Positivo = Sobra, Negativo = Falta

                    if (diff !== 0) {
                        let fornecedor = r.forn ? r.forn.toUpperCase().trim() : 'SEM FORNECEDOR';
                        let produto = r.desc ? r.desc.toUpperCase().trim() : 'PRODUTO INDEFINIDO';

                        if (!reportData[fornecedor]) reportData[fornecedor] = {};
                        if (!reportData[fornecedor][produto]) reportData[fornecedor][produto] = 0;

                        reportData[fornecedor][produto] += diff;
                    }
                }
            });
        });

        // 2. Renderiza o Relatório
        let hasContent = false;
        const sortedForns = Object.keys(reportData).sort();

        if (sortedForns.length === 0) {
            resDiv.innerHTML = '<div style="text-align:center; padding:30px; color:#2e7d32;"><i class="fas fa-check-circle" style="font-size:2rem;"></i><br><br><b>Tudo certo!</b><br>Nenhuma divergência encontrada no período.</div>';
            return;
        }

        sortedForns.forEach(forn => {
            const produtos = reportData[forn];
            let produtosHtml = '';
            let countItens = 0;

            Object.keys(produtos).forEach(prod => {
                let saldo = produtos[prod];
                if (saldo !== 0) {
                    countItens++;
                    // Estilo Verde (Sobra) ou Vermelho (Falta)
                    let styleClass = saldo > 0 ? 'diff-pos' : 'diff-neg';
                    let label = saldo > 0 ? `SOBRA (+${saldo})` : `FALTA (${saldo})`;
                    let icon = saldo > 0 ? '<i class="fas fa-plus-circle"></i>' : '<i class="fas fa-minus-circle"></i>';

                    // Filtro de busca por texto
                    if (term && !forn.includes(term) && !prod.includes(term)) return;

                    produtosHtml += `
                        <div class="div-row-detail">
                            <span style="font-weight:500;">${prod}</span>
                            <span class="diff-badge ${styleClass}">${icon} ${label}</span>
                        </div>`;
                }
            });

            if (countItens > 0 && produtosHtml !== '') {
                hasContent = true;
                const card = document.createElement('div');
                card.className = 'rep-card status-divergence';
                card.innerHTML = `
                    <div class="rep-header" style="border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px;">
                        <div class="rep-title"><i class="fas fa-building"></i> ${forn}</div>
                        <span class="rep-badge bg-red">${countItens} Item(s)</span>
                    </div>
                    <div style="background:#fff;">${produtosHtml}</div>
                `;
                resDiv.appendChild(card);
            }
        });

        if (!hasContent) {
            resDiv.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum registro encontrado para o termo buscado.</p>';
        }
        
        // Atualiza rodapé
        document.getElementById('repFooter').style.display = 'block';
        document.getElementById('repTotalCount').textContent = sortedForns.length; // Conta fornecedores com problema
        return;
    }

    // --- LÓGICA PADRÃO (PATIO, MAPAS, CARREGAMENTO) ---
    
    let sourceData = [];
    if (type === 'patio') sourceData = patioData;
    else if (type === 'mapas') sourceData = mapData;
    else if (type === 'carregamento') sourceData = carregamentoData;

    filteredReportData = sourceData.filter(item => {
        let itemDateOriginal = item.chegada || item.date || item.checkin; 
        if(!itemDateOriginal) return false;
        let d = new Date(itemDateOriginal);
        let year = d.getFullYear();
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let day = String(d.getDate()).padStart(2, '0');
        let itemDateStr = (itemDateOriginal.length === 10) ? itemDateOriginal : `${year}-${month}-${day}`;

        if (itemDateStr < dateStartStr || itemDateStr > dateEndStr) return false;
        if (!term) return true; 

        let searchableText = '';
        if (type === 'patio') {
            searchableText += `${item.empresa} ${item.placa} ${item.local} ${item.status} `;
            if (item.cargas) item.cargas.forEach(c => c.produtos.forEach(p => searchableText += `${p.nome} ${p.nf} `));
        } else if (type === 'mapas') {
            searchableText += `${item.placa} ${item.id} ${item.setor} `;
            if (item.rows) item.rows.forEach(r => searchableText += `${r.desc} ${r.nf} ${r.forn} `);
        } else if (type === 'carregamento') {
            searchableText += `${item.motorista} ${item.cavalo} ${item.carretas.join(' ')} ${item.status} `;
        }
        return searchableText.toUpperCase().includes(term);
    });

    renderReportTable(type, filteredReportData, resDiv);
    document.getElementById('repFooter').style.display = 'block';
    document.getElementById('repTotalCount').textContent = filteredReportData.length;
}


function renderReportTable(type, data, container) {
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum registro encontrado para este filtro.</p>';
        return;
    }

    // Estilo para o cursor parecer clicável
    let html = '<table class="mc-table" style="font-size:0.85rem;">';
    
    if (type === 'patio') {
        html += `
        <thead>
            <tr style="background:#333; color:white;">
                <th>Seq</th>
                <th>Data/Hora</th>
                <th>Empresa</th>
                <th>Placa</th>
                <th>Produtos / NF</th>
                <th>Setor</th>
                <th>Status</th>
                <th>Resp.</th>
            </tr>
        </thead>
        <tbody>`;
        
        data.forEach((item, index) => {
            let infoResumo = [];
            if(item.cargas) {
                item.cargas.forEach(c => c.produtos.forEach(p => {
                    infoResumo.push(`${p.nome} <small>(NF:${p.nf})</small>`);
                }));
            }
            let infoStr = infoResumo.join('<br>');

            // Adiciona onclick para abrir o preview
            html += `
            <tr onclick="openReportDetails(${index}, 'patio')" style="cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
                <td style="text-align:center; font-weight:bold;">${item.sequencia || '-'}</td>
                <td>${new Date(item.chegada).toLocaleString()}</td>
                <td>${item.empresa}</td>
                <td style="font-weight:bold;">${item.placa}</td>
                <td>${infoStr}</td>
                <td>${item.localSpec || item.local}</td>
                <td>${item.status}</td>
                <td>${item.releasedBy || '-'}</td>
            </tr>`;
        });

    } else if (type === 'mapas') {
        // NOVAS COLUNAS PARA MAPA CEGO
        html += `
        <thead>
            <tr style="background:#333; color:white;">
                <th>Data</th>
                <th>Placa</th>
                <th>Empresa (Forn.)</th>
                <th>Produtos / NFs</th>
                <th>Setor</th>
                <th>Estado</th>
            </tr>
        </thead>
        <tbody>`;
        
        data.forEach((item, index) => {
            // Extrair informações de dentro das linhas do mapa
            let fornecedores = new Set();
            let produtosNfs = [];
            
            item.rows.forEach(r => {
                if(r.forn) fornecedores.add(r.forn);
                if(r.desc) produtosNfs.push(`${r.desc} <small>(NF:${r.nf})</small>`);
            });

            let fornStr = Array.from(fornecedores).join(', ') || 'Não inf.';
            let prodStr = produtosNfs.join('<br>') || 'Vazio';

            // Adiciona onclick para abrir o preview
            html += `
            <tr onclick="openReportDetails(${index}, 'mapas')" style="cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
                <td>${item.date}</td>
                <td style="font-weight:bold;">${item.placa}</td>
                <td>${fornStr}</td>
                <td>${prodStr}</td>
                <td>${item.setor || '-'}</td>
                <td>${item.launched ? '<span style="color:green">Lançado</span>' : '<span style="color:orange">Rascunho</span>'}</td>
            </tr>`;
        });

    } else if (type === 'carregamento') {
        html += `<thead><tr style="background:#333; color:white;"><th>Data</th><th>Motorista</th><th>Cavalo</th><th>Carretas</th><th>Peso Líq.</th><th>Status</th></tr></thead><tbody>`;
        data.forEach(item => {
            html += `<tr><td>${new Date(item.checkin).toLocaleDateString()}</td><td>${item.motorista}</td><td>${item.cavalo}</td><td>${item.carretas.join(', ')}</td><td>${item.liq} kg</td><td>${item.status}</td></tr>`;
        });
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

function exportReportToPDF() {
    if (filteredReportData.length === 0) {
        alert("Gere o relatório primeiro (clique em filtrar) para ter dados para exportar.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const orientation = currentReportType === 'mapas' ? 'portrait' : 'landscape';
    const doc = new jsPDF({ orientation: orientation });

    // --- MAPAS CEGOS ---
    if (currentReportType === 'mapas') {
        let yCursor = 10;
        const mapHeight = 135; 
        let mapsOnPage = 0;

        filteredReportData.forEach((map, index) => {
            if (mapsOnPage >= 2) {
                doc.addPage();
                yCursor = 10;
                mapsOnPage = 0;
            }
            drawMapVisual(doc, map, 10, yCursor);
            yCursor += mapHeight + 10;
            mapsOnPage++;
        });
        
        doc.save(`Mapas_Cegos_${document.getElementById('repDateStart').value}.pdf`);
    } 
    
    // --- RELATÓRIO DE PÁTIO (FILA) ---
    else {
        // Cabeçalho Vermelho
        doc.setFillColor(183, 28, 28); 
        doc.rect(0, 0, 297, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("RELATÓRIO DETALHADO - CONTROLE DE PÁTIO", 10, 13);
        
        doc.setFontSize(10);
        const dataStr = `Gerado em: ${new Date().toLocaleDateString()}`;
        doc.text(dataStr, 230, 13); 

        let y = 30;
        
        // --- COLUNAS OTIMIZADAS PARA PAISAGEM ---
        const cols = {
            seq: 10,
            chegada: 25,
            empresa: 65,   
            placa: 110,     
            detalhes: 140,  // Onde ficam os produtos
            setor: 235,
            status: 265
        };

        // Títulos das Colunas
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("SEQ", cols.seq, y);
        doc.text("DATA/HORA", cols.chegada, y);
        doc.text("EMPRESA", cols.empresa, y);
        doc.text("PLACA", cols.placa, y);
        doc.text("PRODUTOS / NFs / LAUDO", cols.detalhes, y);
        doc.text("SETOR", cols.setor, y);
        doc.text("STATUS", cols.status, y);
        
        doc.setLineWidth(0.5);
        doc.line(10, y+2, 285, y+2);
        y += 8;

        doc.setFont("helvetica", "normal");
        
        filteredReportData.forEach(item => {
            if (y > 190) { doc.addPage(); y = 20; }

            // Formata Produtos
            let prodText = "";
            if(item.cargas) {
                item.cargas.forEach(c => {
                    c.produtos.forEach(p => {
                        prodText += `• ${p.nome.substring(0,30)} (NF:${p.nf})\n`;
                    });
                });
            }
            if(item.comLaudo) prodText += "[COM LAUDO]";
            else prodText += "[SEM LAUDO]";

            // Dados
            doc.text((item.sequencia || '-').toString(), cols.seq, y);
            doc.text(new Date(item.chegada).toLocaleString(), cols.chegada, y, {maxWidth: 35});
            doc.text(item.empresa.substring(0, 25), cols.empresa, y);
            doc.text(item.placa, cols.placa, y);
            
            // Texto longo com quebra de linha automática (largura 90)
            const prodLines = doc.splitTextToSize(prodText, 90);
            doc.text(prodLines, cols.detalhes, y);

            doc.text(item.localSpec || item.local || '-', cols.setor, y);
            doc.text(item.status, cols.status, y);

            // Calcula altura da linha
            const lineHeight = Math.max(8, prodLines.length * 4) + 4;
            
            // Linha divisória fina cinza
            doc.setDrawColor(230, 230, 230);
            doc.line(10, y + lineHeight - 2, 285, y + lineHeight - 2);
            
            y += lineHeight;
        });

        doc.save(`Relatorio_Patio_${document.getElementById('repDateStart').value}.pdf`);
    }
}
// ==========================================================================
// 9. FUNÇÕES DE INTERATIVIDADE DO RELATÓRIO (NOVO)
// ==========================================================================

// Cria o modal de detalhes dinamicamente se não existir
if (!document.getElementById('modalReportDetail')) {
    const modalHtml = `
    <div id="modalReportDetail" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; width:90%; max-width:600px; padding:20px; border-radius:8px; position:relative; max-height:90vh; overflow-y:auto;">
            <button onclick="document.getElementById('modalReportDetail').style.display='none'" style="position:absolute; top:10px; right:10px; border:none; background:transparent; font-size:1.5rem; cursor:pointer;">&times;</button>
            <h2 id="repDetailTitle" style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:10px;">Detalhes</h2>
            <div id="repDetailContent" style="margin:20px 0;"></div>
            <div id="repDetailActions" style="text-align:right; border-top:1px solid #eee; padding-top:15px;"></div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openReportDetails(index, type) {
    const item = filteredReportData[index];
    const modal = document.getElementById('modalReportDetail');
    const content = document.getElementById('repDetailContent');
    const title = document.getElementById('repDetailTitle');
    const actions = document.getElementById('repDetailActions');
    
    actions.innerHTML = ''; // Limpa botões antigos

    if (type === 'mapas') {
        title.innerText = `Mapa Cego #${item.id}`;
        
        // Coleta dados dos itens do mapa
        let rowsHtml = '<table style="width:100%; border-collapse:collapse; margin-top:10px;">';
        rowsHtml += '<tr style="background:#eee; font-weight:bold;"><td style="padding:5px;">Produto</td><td style="padding:5px;">NF</td><td style="padding:5px;">Forn.</td></tr>';
        
        item.rows.forEach(r => {
            if(r.desc || r.nf) {
                rowsHtml += `<tr>
                    <td style="padding:5px; border-bottom:1px solid #eee;">${r.desc}</td>
                    <td style="padding:5px; border-bottom:1px solid #eee;">${r.nf}</td>
                    <td style="padding:5px; border-bottom:1px solid #eee;">${r.forn}</td>
                </tr>`;
            }
        });
        rowsHtml += '</table>';

        content.innerHTML = `
            <p><b>Data:</b> ${item.date}</p>
            <p><b>Placa:</b> ${item.placa}</p>
            <p><b>Setor:</b> ${item.setor || 'Não informado'}</p>
            <p><b>Status:</b> ${item.launched ? '<span style="color:green; font-weight:bold;">LANÇADO</span>' : '<span style="color:orange; font-weight:bold;">RASCUNHO</span>'}</p>
            ${item.signatures.receb ? '<p><small>Ass. Receb: ' + item.signatures.receb + '</small></p>' : ''}
            <hr>
            <h3>Itens do Mapa:</h3>
            ${rowsHtml}
        `;

        // O BOTÃO MÁGICO
        const btn = document.createElement('button');
        btn.innerText = "VER MAPA CEGO (ABRIR)";
        btn.className = "btn btn-save"; 
        btn.style.width = "100%";
        btn.onclick = function() {
            document.getElementById('modalReportDetail').style.display = 'none';
            navTo('mapas');
            loadMap(item.id);
        };
        actions.appendChild(btn);

    } else if (type === 'patio') {
        title.innerText = `Detalhes do Veículo (Seq: ${item.sequencia})`;
        
        let prodsHtml = '';
        if(item.cargas) {
            item.cargas.forEach(c => {
                c.produtos.forEach(p => {
                    prodsHtml += `<li><b>${p.nome}</b> (NF: ${p.nf})</li>`;
                });
            });
        }

        content.innerHTML = `
            <div style="background:#f9f9f9; padding:15px; border-radius:5px;">
                <p style="font-size:1.2rem; font-weight:bold;">${item.empresa}</p>
                <p>Placa: <b>${item.placa}</b></p>
                <p>Status: <b>${item.status}</b></p>
            </div>
            <p><b>Chegada:</b> ${new Date(item.chegada).toLocaleString()}</p>
            <p><b>Saída:</b> ${item.saida ? new Date(item.saida).toLocaleString() : '-'}</p>
            <p><b>Local/Setor:</b> ${item.localSpec || item.local}</p>
            <p><b>Liberado por:</b> ${item.releasedBy || '-'}</p>
            <p><b>Possui Laudo?</b> ${item.comLaudo ? 'SIM' : 'NÃO'}</p>
            <hr>
            <h3>Cargas:</h3>
            <ul>${prodsHtml}</ul>
        `;
        
        const btn = document.createElement('button');
        btn.innerText = "FECHAR";
        btn.className = "btn"; 
        btn.style.background = "#555";
        btn.style.color = "white";
        btn.onclick = function() { document.getElementById('modalReportDetail').style.display = 'none'; };
        actions.appendChild(btn);
    }

    modal.style.display = 'flex';
}

function drawMapVisual(doc, map, x, y) {
    const w = 190; 
    const h = 130; 

    // --- 1. Fundo Geral ---
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(220, 220, 220); 
    doc.roundedRect(x, y, w, h, 3, 3, 'FD'); 

    // --- 2. Cabeçalho ---
    // Logo Fundo Vermelho
    doc.setFillColor(183, 28, 28); 
    doc.rect(x + 5, y + 5, 30, 14, 'F'); 
    
    // Texto Logo
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Wilson", x + 8, y + 14);
    doc.setFontSize(7);
    doc.text("ALIMENTOS", x + 15, y + 17);

    // Título Central (Fonte ajustada para 10 para não encavalar)
    doc.setTextColor(0, 0, 0); 
    doc.setFontSize(10); // Era 11
    doc.setFont("helvetica", "bold");
    doc.text("RECEBIMENTO DIÁRIO DE MATERIAIS — MAPA CEGO DIGITAL", x + 38, y + 12);

    // Data (Formatada para PT-BR)
    const dataFormatada = map.date.split('-').reverse().join('/'); // Transforma 2025-12-08 em 08/12/2025

    // Rótulo "Dia:"
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Dia:", x + 148, y + 12); 
    
    // Caixinha da Data
    doc.setFillColor(255, 255, 255); 
    doc.setDrawColor(150, 150, 150); 
    doc.rect(x + 155, y + 7, 30, 7, 'FD'); 
    doc.setTextColor(0,0,0);
    doc.text(dataFormatada, x + 157, y + 12);

    // --- 3. Cabeçalho da Tabela ---
    const tableY = y + 25;
    const col1 = x + 5;   
    const col2 = x + 105; 
    const col3 = x + 125; 
    const col4 = x + 150; 

    doc.setFillColor(30, 30, 30); // Preto
    doc.rect(x + 5, tableY, w - 10, 8, 'F');
    
    doc.setTextColor(255, 255, 255); 
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Descrição dos Materiais", col1 + 2, tableY + 5);
    doc.text("Qtd.", col2 + 2, tableY + 5);
    doc.text("Nota Fiscal", col3 + 2, tableY + 5);
    doc.text("Fornecedor", col4 + 2, tableY + 5);

    // --- 4. Linhas ---
    doc.setFont("helvetica", "normal");
    let rowY = tableY + 8;
    const rowH = 10; 
    
    for (let i = 0; i < 6; i++) {
        const r = (map.rows && map.rows[i]) ? map.rows[i] : null;

        // Fundo Branco
        doc.setFillColor(255, 255, 255); 
        doc.setDrawColor(200, 200, 200);
        doc.rect(x + 5, rowY, w - 10, rowH, 'FD');

        // Qtd Vazia (Cinza)
        if (!r || !r.qty) {
            doc.setFillColor(235, 235, 235); 
            doc.rect(col2, rowY, (col3 - col2), rowH, 'FD'); 
        }

        // Divisórias
        doc.setDrawColor(200, 200, 200);
        doc.line(col2, rowY, col2, rowY + rowH);
        doc.line(col3, rowY, col3, rowY + rowH);
        doc.line(col4, rowY, col4, rowY + rowH);

        // Dados
        if (r) {
            if (r.desc) {
                doc.setTextColor(0, 100, 0); // Verde
                doc.setFontSize(9);
                doc.text(r.desc.substring(0, 48), col1 + 2, rowY + 4);
                doc.setTextColor(150, 150, 150); // Cinza
                doc.setFontSize(7);
                doc.text("sistema", col1 + 2, rowY + 8);
            }
            if (r.qty) {
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(9);
                doc.text(r.qty.toString(), col2 + 2, rowY + 6);
            }
            if (r.nf) {
                doc.setTextColor(0, 100, 0);
                doc.setFontSize(9);
                doc.text(r.nf.toString(), col3 + 2, rowY + 6);
            }
            if (r.forn) {
                doc.setTextColor(0, 100, 0);
                doc.setFontSize(9);
                doc.text(r.forn.substring(0, 18), col4 + 2, rowY + 6);
            }
        }
        rowY += rowH;
    }

    // --- 5. Rodapé ---
    const footerY = y + 100;

    // Setor
    doc.setFillColor(255, 255, 255); 
    doc.setDrawColor(200, 200, 200);
    doc.rect(x + 5, footerY, 60, 15, 'FD'); 
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Setor de Entrega:", x + 8, footerY + 5);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(map.setor || '', x + 8, footerY + 11);

    // Placa
    doc.setFillColor(255, 255, 255); 
    doc.rect(x + 70, footerY, 40, 15, 'FD'); 
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Placa:", x + 73, footerY + 5);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(map.placa || '', x + 73, footerY + 11);

    // Status
    const statusText = map.launched ? "Definitivo" : "Rascunho";
    if(map.launched) doc.setFillColor(200, 255, 200);
    else doc.setFillColor(255, 243, 205); 
    doc.setDrawColor(255, 255, 255); 
    doc.rect(x + 160, footerY - 5, 30, 8, 'F');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(statusText, x + 165, footerY);

    // Assinaturas
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245); 
    doc.rect(x + 120, footerY + 5, 75, 20, 'FD'); 
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(6);
    doc.text("Ass. Recebimento:", x + 122, footerY + 9);
    if(map.signatures && map.signatures.receb) {
        doc.setFont("courier", "normal");
        doc.setFontSize(7);
        doc.text(map.signatures.receb.substring(0,25), x + 122, footerY + 15);
    } else {
        doc.line(x+122, footerY+18, x+155, footerY+18);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text("Ass. Conferente:", x + 160, footerY + 9);
    if(map.signatures && map.signatures.conf) {
        doc.setFont("courier", "normal");
        doc.setFontSize(7);
        doc.text(map.signatures.conf.substring(0,25), x + 160, footerY + 15);
    } else {
        doc.line(x+160, footerY+18, x+190, footerY+18);
    }
}

// --- INIT ---
initRoleBasedUI();
if (loggedUser) navTo(isConferente ? 'patio' : 'patio');
