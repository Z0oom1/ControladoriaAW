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
    if (isConferente) {
        document.getElementById('fabAddTruck').style.display = 'none';
        document.getElementById('menuCarregamento').style.display = 'none';
    } else {
        document.getElementById('fabAddTruck').style.display = 'flex';
        document.getElementById('menuCarregamento').style.display = 'flex';
    }
    if (isRecebimento) document.getElementById('menuMateriaPrima').style.display = 'flex';
    else document.getElementById('menuMateriaPrima').style.display = 'none';

    if (isConferente && userSubType) {
        document.getElementById('col-ALM').style.display = 'none';
        document.getElementById('col-GAVA').style.display = 'none';
        document.getElementById('col-OUT').style.display = 'none';
        if (userSubType === 'ALM') document.getElementById('col-ALM').style.display = 'flex';
        if (userSubType === 'GAVA') document.getElementById('col-GAVA').style.display = 'flex';
        if (userSubType === 'OUT') document.getElementById('col-OUT').style.display = 'flex';
    }
    if (window.innerWidth <= 1024) document.querySelector('.mobile-header-bar').style.display = 'flex';
}

const today = new Date().toISOString().split('T')[0];
document.getElementById('patioDateFilter').value = today;
document.getElementById('mapDate').value = today;
document.getElementById('repDate').value = today;
document.getElementById('mpDateFilter').value = today;
document.getElementById('carrDateFilter').value = today;
document.getElementById('mapListDateFilter').value = today;

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
        placa: placa, 
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

    const rows = tmpItems.map((item, idx) => ({ id: idBase + '_' + idx, desc: item.prod, qty: '', nf: item.nf, forn: empresa, owners: { desc: 'sistema', nf: 'sistema', forn: 'sistema' } }));
    for (let i = 0; i < 3; i++) rows.push({ id: idBase + '_extra_' + i, desc: '', qty: '', nf: '', forn: '', owners: {} });

    const novoMapa = { id: idBase, date: today, rows: rows, placa: placa, setor: sectorData.name, alm: false, manut: false, launched: false, finishedNotified: false, signatures: { receb: null, conf: null }, forceUnlock: false, divergence: null };
    mapData.push(novoMapa);

    if (isBalan) {
        const firstProd = tmpItems[0] ? tmpItems[0].prod : 'Diversos'; const firstNF = tmpItems[0] ? tmpItems[0].nf : '';
        mpData.push({ id: idBase, date: today, produto: firstProd, empresa: empresa, placa: placa, local: sectorData.name, chegada: nowIso, entrada: null, saida: null, tara: 0, bruto: 0, liq: 0, pesoNF: 0, difKg: 0, difPerc: 0, nf: firstNF, notes: '' });
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
    ['ALM', 'GAVA', 'OUT', 'SAIU'].forEach(c => { document.getElementById('list-' + c).innerHTML = ''; if (c !== 'SAIU') document.getElementById('count-' + c).textContent = '0'; });
    const list = patioData.filter(c => { const cDate = c.chegada.split('T')[0]; if (c.status === 'SAIU') return c.saida && c.saida.startsWith(filterDate); return c.status !== 'SAIU' || cDate === filterDate; }).sort((a, b) => new Date(a.chegada) - new Date(b.chegada));

    list.forEach(c => {
        const isSaiu = c.status === 'SAIU'; let col = isSaiu ? 'SAIU' : c.local; if (!col) col = 'OUT';
        const container = document.getElementById('list-' + col); if (!container) return;
        if (!isSaiu) { const cnt = document.getElementById('count-' + col); cnt.textContent = parseInt(cnt.textContent) + 1; }

        const card = document.createElement('div'); card.className = 'truck-card';
        card.onclick = function (e) { if (e.target.tagName !== 'BUTTON') this.classList.toggle('expanded'); };
        
        card.oncontextmenu = function(e) {
            e.preventDefault();
            if(!isSaiu) openTruckContextMenu(e.pageX, e.pageY, c.id); 
        };

        let btns = '';
        if (c.status === 'FILA') btns = `<button onclick="changeStatus('${c.id}','ENTROU')" style="width:100%; background:#2e7d32; color:white; border:none; padding:12px; margin-top:5px; border-radius:3px; font-weight:bold;">LIBERAR ENTRADA</button>`;
        else if (c.status === 'ENTROU') btns = `<button onclick="changeStatus('${c.id}','SAIU')" style="width:100%; background:#555; color:white; border:none; padding:12px; margin-top:5px; border-radius:3px;">REGISTRAR SAÍDA</button>`;

        let statusBadge = c.status === 'FILA' ? '<div class="status-badge st-wait">Aguardando</div>' : (c.status === 'ENTROU' ? '<div class="status-badge st-ok">No Pátio</div>' : '<div class="status-badge st-out">Saiu</div>');
        let prodsHtml = ''; if (c.cargas && c.cargas[0]) c.cargas[0].produtos.forEach(p => { prodsHtml += `<div class="prod-row"><span>${p.nome}</span><span>${p.qtd}</span></div>`; });

        let laudoHtml = c.comLaudo 
            ? '<span class="laudo-badge laudo-sim"><i class="fas fa-check"></i> COM LAUDO</span>' 
            : '<span class="laudo-badge laudo-nao">SEM LAUDO</span>';

        card.innerHTML = `<div class="card-basic"><div><div class="card-company">${c.empresa} <small>(#${c.sequencia})</small></div><small>${new Date(c.chegada).toLocaleTimeString().slice(0, 5)} - Placa: ${c.placa}</small><br>${laudoHtml}<div class="sector-tag">${c.localSpec || c.local}</div></div><span class="card-nf">NF: ${c.cargas ? c.cargas[0].produtos[0].nf : '?'}</span></div>${statusBadge}<div class="card-expanded-content">${prodsHtml}${!isSaiu ? btns : ''}</div>`;
        container.appendChild(card);
    });
}

function changeStatus(id, st) {
    const idx = patioData.findIndex(c => c.id === id);
    if (idx > -1) {
        const now = new Date().toISOString(); 
        patioData[idx].status = st;
        patioData[idx].releasedBy = loggedUser.username;

        const mpIdx = mpData.findIndex(m => m.id === id);
        if (st === 'ENTROU') { 
            patioData[idx].recebimentoNotified = false; 
            if (mpIdx > -1) mpData[mpIdx].entrada = now; 
        }
        if (st === 'SAIU') { 
            patioData[idx].saida = now; 
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
    
    if(document.getElementById('view-patio').classList.contains('active')) {
        renderPatio(); 
    }

    // 1. NOTIFICAÇÃO DE ENTRADA
    const truckEntry = patioData.find(c => c.status === 'ENTROU' && !c.recebimentoNotified);
    
    if (truckEntry) {
        if (isRecebimento) {
            showNotificationPopup('release', truckEntry);
            const liberadoPor = truckEntry.releasedBy || "Portaria";
            sendSystemNotification(
                "Veículo Liberado para Descarga!",
                `Liberado por: ${liberadoPor}\nEmpresa: ${truckEntry.empresa}\nPlaca: ${truckEntry.placa}\nNotifique o motorista.`,
                'patio',
                truckEntry.id
            );
        }
    }

    // 2. NOTIFICAÇÃO DE SAÍDA
    const truckExit = patioData.find(c => c.status === 'SAIU' && !c.saidaNotified && c.saida && c.saida.startsWith(today));
    
    if (truckExit) {
        const liberadoPor = truckExit.releasedBy || "Recebimento";
        sendSystemNotification(
            "Descarga Finalizada!",
            `Liberado por: ${liberadoPor}\nO caminhão da ${truckExit.empresa} (Placa: ${truckExit.placa}) já terminou. Motorista liberado!`,
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
    
    mapData.filter(m => m.date === filterDate).slice().reverse().forEach(m => {
        const forn = m.rows.find(r => r.forn)?.forn || 'Sem Fornecedor';
        const divClass = (m.divergence && m.divergence.active) ? 'mc-item has-divergence' : 'mc-item';
        const selectedClass = currentMapId === m.id ? ' selected' : '';
        const el = document.createElement('div'); el.className = divClass + selectedClass;
        el.innerHTML = `<b>${forn}</b><br><small>${m.date} | ${m.launched ? 'Lançado' : 'Rascunho'}</small>${(m.divergence && m.divergence.active) ? '<div style="color:red; font-weight:bold; font-size:0.7rem;">[DIVERGÊNCIA]</div>' : ''}`;
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
    const tbody = document.getElementById('mapBody'); tbody.innerHTML = '';
    const highlightArea = (map.divergence && map.divergence.active) ? map.divergence.area : null;
    map.rows.forEach(row => {
        const tr = document.createElement('tr');
        const createCell = (field, cls) => {
            const val = row[field] || ''; const owner = row.owners && row.owners[field] ? row.owners[field] : '';
            const locked = isFieldLocked(map, field);
            let finalClass = locked ? `cell ${cls} cell-locked` : `cell ${cls}`;
            if (highlightArea === 'geral' || highlightArea === field) finalClass += ' div-highlight';
            let editMarker = owner ? `<div class="owner-label">${owner}</div>` : '';
            if (owner && (!locked || map.forceUnlock)) finalClass += ' cell-edited';
            return `<td><input type="text" class="${finalClass}" value="${val}" onchange="updateRow('${row.id}', '${field}', this.value)" ${locked ? 'readonly' : ''}>${editMarker}</td>`;
        };
        tr.innerHTML = `${createCell('desc', 'cell-recebimento')}${createCell('qty', 'cell-conferente')}${createCell('nf', 'cell-recebimento')}${createCell('forn', 'cell-recebimento')}`;
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

function generateReport() {
    const date = document.getElementById('repDate').value; const type = document.getElementById('repType').value; const resDiv = document.getElementById('repResult'); resDiv.innerHTML = '';
    if (type === 'carregamento') {
        const list = carregamentoData.filter(c => c.date === date);
        if (list.length === 0) { resDiv.innerHTML = '<p>Nenhum carregamento.</p>'; return; }
        list.forEach(c => {
            const el = document.createElement('div'); el.className = `rep-card ${c.status === 'SAIU' ? 'status-launched' : 'status-draft'}`;
            el.innerHTML = `<div class="rep-header"><div class="rep-title">${c.motorista}</div><span class="rep-badge bg-green">${c.status}</span></div><div class="rep-body"><div class="rep-col">Placa: ${c.cavalo}</div><div class="rep-col">Carretas: ${c.carretas.length}</div></div>`;
            resDiv.appendChild(el);
        }); return;
    }
    if (type === 'patio') {
        const filtered = patioData.filter(c => c.chegada.startsWith(date));
        if (filtered.length === 0) { resDiv.innerHTML = '<p>Nenhum registro.</p>'; return; }
        filtered.forEach(c => {
            const statusClass = c.status === 'SAIU' ? 'status-launched' : 'status-draft'; const badgeClass = c.status === 'SAIU' ? 'bg-green' : 'bg-orange';
            const el = document.createElement('div'); el.className = `rep-card ${statusClass}`; el.onclick = function () { showTruckPreviewReport(c); };
            el.innerHTML = `<div class="rep-header"><div class="rep-title">${c.empresa}</div><span class="rep-badge ${badgeClass}">${c.status}</span></div><div class="rep-body"><div class="rep-col"><div>Ent: ${c.chegada.slice(11, 16)}</div><div>Sai: ${c.saida ? c.saida.slice(11, 16) : '-'}</div></div><div class="rep-col"><div>${c.localSpec || c.local}</div></div></div>`;
            resDiv.appendChild(el);
        });
    } else {
        const filtered = mapData.filter(m => m.date === date);
        if (filtered.length === 0) { resDiv.innerHTML = '<p>Nenhum mapa.</p>'; return; }
        filtered.forEach(m => {
            let statusClass = m.launched ? 'status-launched' : 'status-draft'; let badgeClass = m.launched ? 'bg-green' : 'bg-orange';
            if (m.divergence && m.divergence.active) { statusClass = 'status-divergence'; badgeClass = 'bg-red'; }
            const el = document.createElement('div'); el.className = `rep-card ${statusClass}`; el.onclick = function () { previewMapFromReport(m.id); };
            el.innerHTML = `<div class="rep-header"><div class="rep-title">MAPA #${m.id.slice(-4)}</div><span class="rep-badge ${badgeClass}">${(m.divergence && m.divergence.active) ? 'DIVERGÊNCIA' : (m.launched ? 'LANÇADO' : 'ABERTO')}</span></div><div class="rep-body"><div class="rep-col"><div>Clique para ver</div></div></div>`;
            resDiv.appendChild(el);
        });
    }
}

function showTruckPreviewReport(c) {
    const modal = document.getElementById('modalTruckPreview'); const content = document.getElementById('prevTContent'); let prods = '';
    if (c.cargas && c.cargas[0]) c.cargas[0].produtos.forEach(p => prods += `<li>${p.nome} (NF: ${p.nf})</li>`);
    content.innerHTML = `<b>Empresa:</b> ${c.empresa}<br><b>Placa:</b> ${c.placa}<br><b>Destino:</b> ${c.localSpec || c.local}<br><b>Sequência Dia:</b> #${c.sequencia}<hr><b>Chegada (Fila):</b> ${new Date(c.chegada).toLocaleTimeString()}<br><b>Saída:</b> ${c.saida ? new Date(c.saida).toLocaleTimeString() : 'Ainda no pátio'}<br><hr><b>Cargas:</b><ul>${prods}</ul>`;
    modal.style.display = 'flex';
}

function previewMapFromReport(id) {
    const map = mapData.find(m => m.id === id); if (!map) return;
    document.getElementById('prevDate').textContent = map.date; document.getElementById('prevInfo').innerHTML = `ID: ${map.id} | Placa: ${map.placa}`;
    const tbody = document.getElementById('prevBody'); tbody.innerHTML = '';
    map.rows.forEach(row => { if (row.desc || row.qty || row.nf) tbody.innerHTML += `<tr><td>${row.desc}</td><td>${row.qty}</td><td>${row.nf}</td><td>${row.forn}</td></tr>`; });
    document.getElementById('prevSigRec').textContent = map.signatures.receb || 'Pendente'; document.getElementById('prevSigConf').textContent = map.signatures.conf || 'Pendente';
    document.getElementById('modalReportPreview').style.display = 'flex';
}

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
    document.getElementById('editTruckId').value = id;
    document.getElementById('editTruckPlaca').value = truck.placa;
    document.getElementById('editTruckLaudo').checked = truck.comLaudo || false;
    editTmpItems = [];
    if(truck.cargas && truck.cargas[0]) {
        editTmpItems = truck.cargas[0].produtos.map(p => ({ nf: p.nf, prod: p.nome }));
    }
    renderEditTmpList();
    document.getElementById('modalEditTruck').style.display = 'flex';
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
    const novaPlaca = document.getElementById('editTruckPlaca').value;
    const novoLaudo = document.getElementById('editTruckLaudo').checked;
    if(!novaPlaca || editTmpItems.length === 0) { alert("A placa e pelo menos um produto são obrigatórios."); return; }
    const idx = patioData.findIndex(t => t.id === id);
    if(idx > -1) {
        patioData[idx].placa = novaPlaca;
        patioData[idx].comLaudo = novoLaudo;
        patioData[idx].cargas[0].produtos = editTmpItems.map(i => ({ nome: i.prod, qtd: '-', nf: i.nf }));
        const mapIdx = mapData.findIndex(m => m.id === id);
        if(mapIdx > -1 && !mapData[mapIdx].launched) {
             const rows = editTmpItems.map((item, i) => ({ id: id + '_' + i, desc: item.prod, qty: '', nf: item.nf, forn: mapData[mapIdx].rows[0].forn, owners: { desc: 'sistema', nf: 'sistema', forn: 'sistema' } }));
             for (let i = 0; i < 3; i++) rows.push({ id: id + '_extra_' + i, desc: '', qty: '', nf: '', forn: '', owners: {} });
             mapData[mapIdx].rows = rows;
             mapData[mapIdx].placa = novaPlaca;
        }
        const mpIdx = mpData.findIndex(m => m.id === id);
        if(mpIdx > -1) { mpData[mpIdx].placa = novaPlaca; if(editTmpItems[0]) { mpData[mpIdx].produto = editTmpItems[0].prod; mpData[mpIdx].nf = editTmpItems[0].nf; } }
        localStorage.setItem('aw_caminhoes_v2', JSON.stringify(patioData));
        localStorage.setItem('mapas_cegos_v3', JSON.stringify(mapData));
        localStorage.setItem('aw_materia_prima', JSON.stringify(mpData));
        renderPatio();
        document.getElementById('modalEditTruck').style.display = 'none';
        alert("Dados atualizados com sucesso!");
    }
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

// --- INIT ---
initRoleBasedUI();
if (loggedUser) navTo(isConferente ? 'patio' : 'patio');