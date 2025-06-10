/**
 * InstaBot v1.0 - Interface Script Refatorado
 * Sistema de Navegação, Estatísticas e Automação
 * Última atualização: Refatoração completa v2.0 - Código limpo e otimizado
 */

const { ipcRenderer } = require('electron');

// ════════════════════════════════════════════════════════════════════════════════
//                            UTILITÁRIOS COMUNS v2.0
// ════════════════════════════════════════════════════════════════════════════════
class Utils {
    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        } else {
            return num.toString();
        }
    }

    static parseNumber(text) {
        if (!text || typeof text !== 'string') return 0;
        
        const cleanText = text.toLowerCase().replace(/[^0-9.,kmb]/g, '');
        
        if (cleanText.includes('k')) {
            return Math.floor(parseFloat(cleanText) * 1000);
        } else if (cleanText.includes('m')) {
            return Math.floor(parseFloat(cleanText) * 1000000);
        } else if (cleanText.includes('b')) {
            return Math.floor(parseFloat(cleanText) * 1000000000);
        } else {
            return parseInt(cleanText.replace(/[,.]/g, '')) || 0;
        }
    }

    static createElement(tag, className, innerHTML = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    static removeElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.remove();
    }

    static showMessage(message, type = 'success', duration = 3000) {
        const colors = {
            success: '#00FF5E',
            error: '#FF4D4D',
            warning: '#FFAA00'
        };

        const messageDiv = Utils.createElement('div', '', `
            <div style="
                position: fixed;
                top: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: ${colors[type]};
                color: ${type === 'success' ? '#000' : '#FFF'};
                padding: 15px 25px;
                border-radius: 5px;
                font-weight: bold;
                z-index: 10001;
                font-family: 'Consolas', monospace;
                box-shadow: 0 0 20px ${colors[type]}80;
            ">
                ${message}
            </div>
        `);
        
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), duration);
    }

    static addAnimatedClass(element, className, duration = 300) {
        element.classList.add(className);
        setTimeout(() => element.classList.remove(className), duration);
    }
}

// ════════════════════════════════════════════════════════════════════════════════
//                            SISTEMA DE LOGS INTELIGENTE v2.0
// ════════════════════════════════════════════════════════════════════════════════
class TaggedLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.enabledTags = ['WEBVIEW', 'COOKIES', 'USERNAME', 'CSP', 'CACHE', 'SPLASH', 'STATUSBAR', 'NAV'];
        this.init();
    }
    
    init() {
        this.interceptConsole();
    }
    
    interceptConsole() {
        const originalMethods = {
            log: console.log,
            error: console.error,
            warn: console.warn
        };
        
        ['log', 'error', 'warn'].forEach(method => {
            console[method] = (...args) => {
                this.processLog(method.toUpperCase(), args);
                originalMethods[method].apply(console, args);
            };
        });
    }
    
    processLog(level, args) {
        const message = args.join(' ');
        const tagMatch = message.match(/^\[([A-Z-]+)\]/);
        
        if (tagMatch && this.enabledTags.includes(tagMatch[1])) {
            this.addLog(tagMatch[1], level, message, args);
        }
    }
    
    addLog(tag, level, message, originalArgs) {
        const logEntry = {
            tag,
            level,
            message,
            timestamp: new Date().toISOString(),
            args: originalArgs
        };
        
        this.logs.unshift(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
        
        this.notifyLogAdded(logEntry);
    }
    
    notifyLogAdded(logEntry) {
        if (logEntry.level === 'ERROR' || logEntry.tag === 'SPLASH') {
            try {
                ipcRenderer.send('log-entry', logEntry);
            } catch (error) {
                // Falha silenciosa se IPC não disponível
            }
        }
    }
    
    getLogsByTag(tag) {
        return this.logs.filter(log => log.tag === tag);
    }
    
    getRecentLogs(count = 50) {
        return this.logs.slice(0, count);
    }
    
    exportLogs() {
        return {
            logs: this.logs,
            exported_at: new Date().toISOString(),
            total_count: this.logs.length,
            tags: this.enabledTags
        };
    }
}

// Inicializar sistema de logs
const logger = new TaggedLogger();

// ════════════════════════════════════════════════════════════════════════════════
//                         BARRA DE STATUS INTELIGENTE v2.0
// ════════════════════════════════════════════════════════════════════════════════
class IntelligentStatusBar {
    constructor() {
        this.element = document.getElementById('profile-status');
        this.statusIcon = document.getElementById('status-icon');
        this.statusText = document.getElementById('status-text');
        this.statusDetails = document.getElementById('status-details');
        
        this.currentStatus = 'INICIALIZANDO';
        this.statusHistory = [];
        this.maxHistoryLength = 10;
        
        this.init();
    }
    
    init() {
        if (!this.element) {
            console.error('[STATUSBAR] Elemento profile-status não encontrado!');
            return;
        }
        
        this.element.addEventListener('click', () => this.showStatusModal());
        this.updateStatus('INICIALIZANDO', 'Sistema carregando...', '');
        this.setupStatusListeners();
    }
    
    setupStatusListeners() {
        const statusEvents = {
            'login-status-update': (data) => {
                const status = data.status === 'LOGADO' ? 'LOGADO' : 'DESLOGADO';
                const text = status === 'LOGADO' ? 'Online' : 'Login necessário';
                const details = status === 'LOGADO' ? 'Sessão ativa' : 'Clique para acessar o Instagram';
                this.updateStatus(status, text, details);
            },
            
            'username-detected': (data) => {
                if (data.username) {
                    this.updateStatus('LOGADO', `@${data.username}`, `Online - ${this.getMethodLabel(data.method)}`);
                }
            },
            
            'webview-loading': () => {
                this.updateStatus('CARREGANDO', 'Carregando dados do Instagram...', 'Aguarde...');
            },
            
            'webview-error': (data) => {
                this.updateStatus('ERRO', 'Erro ao carregar o feed', data.message || 'Verifique sua conexão');
            },
            
            'session-expired': () => {
                this.updateStatus('ERRO', 'Sessão expirada', 'Faça login novamente');
            }
        };
        
        Object.entries(statusEvents).forEach(([event, handler]) => {
            ipcRenderer.on(event, (_, data) => handler(data));
        });
    }
    
    updateStatus(status, text, details, sessionInfo = '') {
        const previousStatus = this.currentStatus;
        this.currentStatus = status;
        
        if (!this.element) return;
        
        // Remover classes anteriores e adicionar nova
        this.element.classList.remove('status-deslogado', 'status-carregando', 'status-logado', 'status-erro');
        this.element.classList.add(`status-${status.toLowerCase()}`);
        
        // Atualizar conteúdo
        if (this.statusText) this.statusText.textContent = text;
        if (this.statusDetails) this.statusDetails.textContent = details;
        
        // Salvar no histórico
        this.addToHistory(status, text, details);
        
        if (previousStatus !== status && status !== 'INICIALIZANDO') {
            this.notifyStatusChange(previousStatus, status);
        }
    }
    
    addToHistory(status, text, details) {
        const historyEntry = {
            status,
            text,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.statusHistory.unshift(historyEntry);
        
        if (this.statusHistory.length > this.maxHistoryLength) {
            this.statusHistory = this.statusHistory.slice(0, this.maxHistoryLength);
        }
    }
    
    notifyStatusChange(previousStatus, newStatus) {
        if (window.saveStatusLog) {
            window.saveStatusLog({
                from: previousStatus,
                to: newStatus,
                timestamp: new Date().toISOString(),
                history: this.statusHistory
            });
        }
    }
    
    getMethodLabel(method) {
        const labels = {
            'local_mapping': 'Cache Local',
            'api_fallback': 'API Instagram',
            'manual_configuration': 'Config. Manual',
            'force_extraction': 'Extração DOM'
        };
        
        return labels[method] || method;
    }
    
    showStatusModal() {
        const modal = this.createStatusModal();
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('visible'), 10);
    }
    
    createStatusModal() {
        const modal = document.createElement('div');
        modal.className = 'status-modal-overlay';
        
        const content = document.createElement('div');
        content.className = 'status-modal-content';
        
        // Título
        const title = document.createElement('h3');
        title.textContent = 'Status do Sistema';
        title.className = 'status-modal-title';
        
        // Status atual
        const currentStatus = document.createElement('div');
        currentStatus.className = 'status-modal-current';
        currentStatus.innerHTML = `
            <div class="status-current-item">
                <span class="status-current-label">Status Atual:</span>
                <span class="status-current-value ${this.currentStatus.toLowerCase()}">${this.currentStatus}</span>
            </div>
            <div class="status-current-item">
                <span class="status-current-label">Detalhes:</span>
                <span class="status-current-details">${this.statusDetails.textContent}</span>
            </div>
        `;
        
        // Histórico
        const historyTitle = document.createElement('h4');
        historyTitle.textContent = 'Últimas Transições';
        historyTitle.className = 'status-history-title';
        
        const historyList = document.createElement('div');
        historyList.className = 'status-history-list';
        
        this.statusHistory.slice(0, 5).forEach(entry => {
            const item = document.createElement('div');
            item.className = 'status-history-item';
            item.innerHTML = `
                <span class="status-history-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span class="status-history-status ${entry.status.toLowerCase()}">${entry.status}</span>
                <span class="status-history-text">${entry.text}</span>
            `;
            historyList.appendChild(item);
        });
        
        // Botões
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Atualizar Status';
        refreshButton.className = 'status-modal-refresh';
        refreshButton.addEventListener('click', () => {
            this.refreshStatus();
            modal.remove();
        });
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<img src="../assets/icons/close.svg" alt="Fechar" class="modal-close-icon">';
        closeButton.className = 'status-modal-close';
        closeButton.addEventListener('click', () => modal.remove());
        
        // Montar modal
        content.appendChild(closeButton);
        content.appendChild(title);
        content.appendChild(currentStatus);
        content.appendChild(historyTitle);
        content.appendChild(historyList);
        content.appendChild(refreshButton);
        
        modal.appendChild(content);
        
        // Fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        return modal;
    }
    
    
    async refreshStatus() {
        this.updateStatus('CARREGANDO', 'Verificando status...', 'Aguarde...');
        
        try {
            const result = await ipcRenderer.invoke('check-instagram-status');
            
            if (result.success) {
                if (result.status === 'LOGADO') {
                    this.updateStatus('LOGADO', 'Online', 'Status verificado');
                } else {
                    this.updateStatus('DESLOGADO', 'Login necessário', 'Não autenticado');
                }
            } else {
                this.updateStatus('ERRO', 'Erro na verificação', result.message || 'Falha na verificação');
            }
            
        } catch (error) {
            console.error('[STATUSBAR] Erro ao atualizar status:', error);
            this.updateStatus('ERRO', 'Erro na verificação', error.message);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════════
//                     SISTEMA DE PERSISTÊNCIA DE STATUS LOGS v2.0
// ════════════════════════════════════════════════════════════════════════════════

window.saveStatusLog = function(logData) {
    try {
        const logs = JSON.parse(localStorage.getItem('statusLogs') || '[]');
        logs.unshift(logData);
        
        if (logs.length > 10) {
            logs.splice(10);
        }
        
        localStorage.setItem('statusLogs', JSON.stringify(logs));
        
        // Tentar salvar via IPC se disponível
        try {
            ipcRenderer.send('save-status-log', logData);
        } catch (ipcError) {
            // IPC não disponível - ignorar silenciosamente
        }
        
    } catch (error) {
        console.error('[STATUSBAR] Erro ao salvar log:', error);
    }
};

// ════════════════════════════════════════════════════════════════════════════════
//                         CONTROLADOR PRINCIPAL DE NAVEGAÇÃO v2.0
// ════════════════════════════════════════════════════════════════════════════════
class NavigationController {
    constructor() {
        // Estado da aplicação
        this.state = {
            currentPage: 'instagram',
            isLoggedIn: false,
            profileDataCaptured: false,
            realProfileData: null
        };
        
        // Componentes
        this.components = {
            charts: {},
            statusBar: null
        };
        
        this.init();
    }

    init() {
        // Configuração básica
        this.setupWindowControls();
        this.setupNavigation();
        this.loadStatsData();
        
        // Inicializar StatusBar e bloquear módulos até login
        this.components.statusBar = new IntelligentStatusBar();
        this.blockAllModules();
        
        // Configurar sistemas de detecção e monitoramento
        this.setupAllListeners();
        
        // Iniciar detecção automática após delay
        setTimeout(() => this.setupAutomaticLoginDetection(), 500);
        setTimeout(() => this.startAutomaticMonitoring(), 1000);
    }
    
    setupAllListeners() {
        this.setupLoginStatusListener();
        this.setupUsernameDetection();
        this.setupRefreshButton();
        this.setupWebViewFailureListener();
    }

    blockAllModules() {
        const menuIcons = document.querySelectorAll('.menu-icon');
        const titles = {
            'stats': 'Estatísticas',
            'instagram': 'Instagram', 
            'automation': 'Automação',
            'posts': 'Posts',
            'schedule': 'Agendamento',
            'settings': 'Configurações'
        };
        
        menuIcons.forEach((icon, index) => {
            const action = icon.dataset.action;
            
            if (action !== 'instagram') {
                icon.classList.add('blocked');
                icon.style.opacity = '0.5';
                icon.style.pointerEvents = 'none';
                icon.title = 'Login necessário';
                
                if (window.cyberEffects) {
                    window.cyberEffects.updateBlockedState(index, true);
                }
            }
        });
        
        this.state.isLoggedIn = false;
        this.updateLoginStatus(false);
        this.showTopAlert();
        this.hideRefreshButton();
        
        if (this.components.statusBar) {
            this.components.statusBar.updateStatus('DESLOGADO', 'Login necessário', 'Módulos bloqueados até autenticação');
        }
    }

    unlockAllModules() {
        const menuIcons = document.querySelectorAll('.menu-icon');
        const titles = {
            'stats': 'Estatísticas',
            'instagram': 'Instagram', 
            'automation': 'Automação',
            'posts': 'Posts',
            'schedule': 'Agendamento',
            'settings': 'Configurações'
        };
        
        menuIcons.forEach((icon, index) => {
            icon.classList.remove('blocked');
            icon.style.opacity = '1';
            icon.style.pointerEvents = 'auto';
            
            const action = icon.dataset.action;
            icon.title = titles[action] || action;
            
            // Aplicar efeitos cyber para módulos desbloqueados
            if (window.cyberEffects) {
                window.cyberEffects.updateBlockedState(index, false);
            }
        });
        
        this.state.isLoggedIn = true;
        this.updateLoginStatus(true);
        this.hideTopAlert();
        this.showRefreshButton();
        
        // Notificar StatusBar sobre desbloqueio
        if (this.components.statusBar) {
            this.components.statusBar.updateStatus('LOGADO', 'Online', 'Todos os módulos desbloqueados');
        }
        
        // Auto-extração desabilitada - disponível apenas via botão manual
    }

    async setupAutomaticLoginDetection() {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const loginResult = await ipcRenderer.invoke('verify-instagram-login');
            
            if (loginResult.success && loginResult.loggedIn) {
                this.unlockAllModules();
            } else {
                this.blockAllModules();
            }
            
        } catch (error) {
            console.error('[AUTO-LOGIN] Erro na detecção automática:', error);
            this.blockAllModules();
        }
    }

    shouldRefreshProfile() {
        const lastExtraction = localStorage.getItem('lastProfileExtraction');
        if (!lastExtraction) return true;
        
        const now = new Date().getTime();
        const lastTime = parseInt(lastExtraction);
        const fiveMinutes = 5 * 60 * 1000;
        
        return (now - lastTime) > fiveMinutes;
    }

    markProfileExtraction() {
        localStorage.setItem('lastProfileExtraction', new Date().getTime().toString());
    }

    startAutomaticMonitoring() {
        // Parar monitoramento anterior e iniciar novo
        ipcRenderer.send('stop-login-monitoring');
        
        setTimeout(() => {
            ipcRenderer.send('start-login-monitoring');
        }, 1000);
    }

    // Controles da janela
    setupWindowControls() {
        const controls = {
            'btn-close': () => {
                if (confirm("Tem certeza que deseja fechar o InstaBot?")) {
                    ipcRenderer.send('window-close');
                }
            },
            'btn-minimize': () => ipcRenderer.send('window-minimize'),
            'btn-tray': () => ipcRenderer.send('hide-to-tray')
        };

        Object.entries(controls).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        });
    }

    // Sistema de navegação
    setupNavigation() {
        const menuIcons = document.querySelectorAll('.menu-icon');
        
        menuIcons.forEach((icon, index) => {
            const action = icon.dataset.action;
            
            icon.addEventListener('click', async (e) => {
                e.preventDefault();
                
                // Verificar se módulo está bloqueado
                if (icon.classList.contains('blocked')) {
                    this.showLoginRequiredWidget(action);
                    return;
                }

                await this.showPage(action);
                this.setActiveMenu(icon);
            });
        });

        // Definir Instagram como ativo por padrão
        const instagramIcon = document.querySelector('[data-action="instagram"]');
        if (instagramIcon) {
            this.setActiveMenu(instagramIcon);
            this.showPage('instagram');
            
            // Configurar WebView após carregamento
            setTimeout(() => {
                const webview = document.getElementById('insta');
                if (webview && (!webview.src || webview.src === 'about:blank')) {
                    webview.src = 'https://www.instagram.com/';
                }
            }, 1000);
        }
    }

    async showPage(pageName) {
        // Esconder todas as páginas
        document.querySelectorAll('.page-content').forEach(page => {
            page.style.display = 'none';
        });

        // Mapear nomes para IDs das páginas
        const pageMap = {
            stats: 'pagina-estatisticas',
            instagram: 'insta',
            automation: 'pagina-automation',
            posts: 'pagina-posts',
            schedule: 'pagina-schedule',
            settings: 'pagina-settings'
        };

        const pageId = pageMap[pageName] || 'insta';
        const targetPage = document.getElementById(pageId);
        
        if (targetPage) {
            targetPage.style.display = 'block';
            this.state.currentPage = pageName;
            
            // Operações específicas por página
            if (pageName === 'stats') {
                await this.loadStatsData();
                this.updateStatsData();
                this.renderCharts();
                
                if (this.state.isLoggedIn) {
                    this.showRefreshButton();
                }
            }
        }
    }

    // Exibir widget centralizado para módulos que requerem login
    showLoginRequiredWidget(moduleName) {
        console.log(`[WIDGET] Exibindo widget de login para: ${moduleName}`);
        
        // Remover widget existente se houver
        const existingWidget = document.getElementById('login-required-widget');
        if (existingWidget) {
            existingWidget.remove();
        }
        
        // Traduzir nome do módulo
        const moduleNames = {
            'stats': 'Estatísticas',
            'automation': 'Automação',
            'posts': 'Posts',
            'schedule': 'Agendamento',
            'settings': 'Configurações'
        };
        
        const displayName = moduleNames[moduleName] || moduleName;
        
        // Criar widget centralizado
        const widget = document.createElement('div');
        widget.id = 'login-required-widget';
        widget.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #000000;
                border: 2px solid #00FF5E;
                border-radius: 10px;
                padding: 30px 40px;
                text-align: center;
                font-family: 'Consolas', monospace;
                color: #00FF5E;
                box-shadow: 0 0 30px rgba(0, 255, 94, 0.5);
                z-index: 9999;
                min-width: 350px;
                animation: fadeInScale 0.3s ease-out;
            ">
                <div style="font-size: 24px; margin-bottom: 15px; text-shadow: 0 0 10px #00FF5E;">
                    <span class="lock-icon">LOGIN NECESSÁRIO</span>
                </div>
                <div style="font-size: 16px; margin-bottom: 20px; color: #FFFFFF; line-height: 1.5;">
                    Para acessar <strong style="color: #00FF5E;">${displayName}</strong>,<br/>
                    você precisa fazer login no Instagram primeiro.
                </div>
                <div style="font-size: 14px; color: #00FF5E; opacity: 0.8; margin-bottom: 25px;">
                    Faça login na tela do Instagram ao lado →
                </div>
                <button onclick="document.getElementById('login-required-widget').remove()" style="
                    background: #00FF5E;
                    color: #000000;
                    border: none;
                    padding: 10px 25px;
                    border-radius: 5px;
                    font-family: 'Consolas', monospace;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    box-shadow: 0 0 10px rgba(0, 255, 94, 0.3);
                " onmouseover="this.style.background='#FFFFFF'; this.style.boxShadow='0 0 20px rgba(0, 255, 94, 0.7)'" 
                   onmouseout="this.style.background='#00FF5E'; this.style.boxShadow='0 0 10px rgba(0, 255, 94, 0.3)'">
                    ENTENDIDO
                </button>
            </div>
            
            <style>
                @keyframes fadeInScale {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
            </style>
        `;
        
        document.body.appendChild(widget);
        
        // Remover automaticamente após 8 segundos
        setTimeout(() => {
            if (widget.parentElement) {
                widget.style.animation = 'fadeOutScale 0.3s ease-in forwards';
                setTimeout(() => {
                    if (widget.parentElement) {
                        widget.remove();
                    }
                }, 300);
            }
        }, 8000);
        
        // Adicionar animação de saída
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOutScale {
                0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // NOVA FUNÇÃO: Exibir alerta superior responsivo (substitui modal)
    showTopAlert() {
        console.log('[ALERT] Exibindo alerta superior de login necessário');
        
        // Remover alerta anterior se existir
        const existingAlert = document.getElementById('top-login-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // Criar alerta superior
        const alert = document.createElement('div');
        alert.id = 'top-login-alert';
        alert.innerHTML = `
            <div class="login-alert-content">
                <div class="alert-icon lock-icon-visual"></div>
                <div class="alert-message">
                    <strong>Login necessário para acessar todas as funcionalidades</strong>
                    <span>Faça login no Instagram ao lado para desbloquear todos os módulos</span>
                </div>
                <div class="alert-close" onclick="this.parentElement.parentElement.style.display='none'">
                    <img src="../assets/icons/close.svg" alt="Fechar" class="alert-close-icon">
                </div>
            </div>
        `;
        
        // Estilos do alerta
        const style = document.createElement('style');
        style.id = 'top-alert-styles';
        style.textContent = `
            #top-login-alert {
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999;
                width: calc(100% - 120px);
                max-width: 600px;
                background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
                border: 2px solid #00FF5E;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 255, 94, 0.3);
                animation: slideDownAlert 0.5s ease-out;
            }
            
            .login-alert-content {
                display: flex;
                align-items: center;
                padding: 15px 20px;
                color: #ffffff;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .alert-icon {
                font-size: 24px;
                margin-right: 15px;
                filter: drop-shadow(0 0 5px rgba(0, 255, 94, 0.5));
            }
            
            .alert-message {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .alert-message strong {
                color: #00FF5E;
                font-size: 16px;
                margin-bottom: 4px;
                text-shadow: 0 0 5px rgba(0, 255, 94, 0.3);
            }
            
            .alert-message span {
                color: #cccccc;
                font-size: 14px;
                opacity: 0.9;
            }
            
            .alert-close {
                font-size: 24px;
                font-weight: bold;
                color: #00FF5E;
                cursor: pointer;
                padding: 0 5px;
                transition: all 0.3s ease;
                line-height: 1;
            }
            
            .alert-close:hover {
                color: #ffffff;
                transform: scale(1.2);
            }
            
            @keyframes slideDownAlert {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
            
            @keyframes slideUpAlert {
                from {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
            }
        `;
        
        // Adicionar estilos e alerta ao DOM
        document.head.appendChild(style);
        document.body.appendChild(alert);
        
        console.log('[ALERT] Alerta superior exibido');
    }

    // NOVA FUNÇÃO: Ocultar alerta superior
    hideTopAlert() {
        console.log('[ALERT] Ocultando alerta superior');
        
        const alert = document.getElementById('top-login-alert');
        const styles = document.getElementById('top-alert-styles');
        
        if (alert) {
            alert.style.animation = 'slideUpAlert 0.3s ease-in forwards';
            setTimeout(() => {
                if (alert.parentElement) {
                    alert.remove();
                }
                if (styles && styles.parentElement) {
                    styles.remove();
                }
                         }, 300);
         }
     }

    // Configurar botão de atualizar perfil
    setupRefreshButton() {
        const refreshBtn = document.getElementById('refresh-profile-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.refreshProfileData();
            });
        }
        
        // Configurar botão de extração de username manual
        const extractBtn = document.getElementById('extract-username-btn');
        if (extractBtn) {
            extractBtn.addEventListener('click', async () => {
                await this.manualExtractUsername();
            });
        }
    }

    // Mostrar botão de atualizar perfil (apenas se logado)
    showRefreshButton() {
        const refreshBtn = document.getElementById('refresh-profile-btn');
        const extractBtn = document.getElementById('extract-username-btn');
        
        if (refreshBtn && this.state.isLoggedIn) {
            refreshBtn.style.display = 'block';
            console.log('[REFRESH-BTN] Botão "Atualizar Perfil" exibido');
        }
        
        if (extractBtn && this.state.isLoggedIn) {
            extractBtn.style.display = 'inline-block';
            console.log('[EXTRACT-BTN] Botão "Extrair Username" exibido');
        }
    }

    // Ocultar botão de atualizar perfil
    hideRefreshButton() {
        const refreshBtn = document.getElementById('refresh-profile-btn');
        const extractBtn = document.getElementById('extract-username-btn');
        
        if (refreshBtn) {
            refreshBtn.style.display = 'none';
            console.log('[REFRESH-BTN] Botão "Atualizar Perfil" ocultado');
        }
        
        if (extractBtn) {
            extractBtn.style.display = 'none';
            console.log('[EXTRACT-BTN] Botão "Extrair Username" ocultado');
        }
    }

    // Atualizar dados do perfil forçadamente com cache inteligente
    async refreshProfileData() {
        const refreshBtn = document.getElementById('refresh-profile-btn');
        
        try {
            if (refreshBtn) {
                refreshBtn.classList.add('loading');
                refreshBtn.textContent = 'Atualizando...';
                refreshBtn.disabled = true;
            }

            console.log('[MANUAL] Botão "Atualizar Perfil" clicado - forçando extração');
            
            // CACHE INTELIGENTE: Resetar cache ao forçar atualização manual
            localStorage.removeItem('lastProfileExtraction');
            console.log('[CACHE] Cache de perfil resetado para extração forçada manual');
            
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('force-profile-refresh');
            
            if (result.success) {
                console.log('[MANUAL] Extração forçada concluída com sucesso');
                this.updateDashboardWithRealProfile(result.profile);
                this.state.realProfileData = result.profile;
                
                // CACHE INTELIGENTE: Marcar nova extração
                this.markProfileExtraction();
                
                this.showSuccessMessage('Perfil atualizado com sucesso!');
            } else {
                console.error('[MANUAL] Falha na extração forçada:', result.message);
            }

        } catch (error) {
            console.error('[MANUAL] Erro na atualização manual:', error);
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
                refreshBtn.textContent = 'Atualizar Perfil';
                refreshBtn.disabled = false;
            }
        }
    }

    // Configurar listener para falhas de WebView
    setupWebViewFailureListener() {
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'webview-failure') {
                console.log('[WEBVIEW-FAILURE] Falha definitiva recebida:', event.data.message);
                
                // Notificar StatusBar sobre erro
                if (this.components.statusBar) {
                    this.components.statusBar.updateStatus('ERRO', 'Erro no navegador', event.data.message || 'Falha na conexão com Instagram');
                }
                
                // Exibir alerta apenas se estiver logado
                if (this.state.isLoggedIn) {
                    this.showWebViewFailureAlert(event.data.message);
                } else {
                    console.log('[WEBVIEW-FAILURE] Usuário não logado - ignorando alerta');
                }
            }
        });
        
        console.log('[WEBVIEW-FAILURE] Listener configurado');
    }

    // Exibir alerta de falha da WebView
    showWebViewFailureAlert(message) {
        console.log('[FAILURE-ALERT] Exibindo alerta de falha:', message);
        
        // Remover alerta anterior se existir
        const existingAlert = document.getElementById('webview-failure-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // Criar alerta de falha
        const alert = document.createElement('div');
        alert.id = 'webview-failure-alert';
        alert.innerHTML = `
            <div class="failure-alert-content">
                <div class="failure-alert-message">${message}</div>
            </div>
        `;
        
        // Estilos do alerta
        const style = document.createElement('style');
        style.id = 'failure-alert-styles';
        style.textContent = `
            #webview-failure-alert {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                background: #000000;
                border: 2px solid #00FF5E;
                border-radius: 8px;
                padding: 20px 30px;
                color: #00FF5E;
                font-family: 'Consolas', monospace;
                font-size: 16px;
                text-align: center;
                box-shadow: 0 0 20px rgba(0, 255, 94, 0.4);
                animation: fadeInFailure 0.3s ease-out;
                min-width: 300px;
                max-width: 500px;
            }
            
            .failure-alert-content {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .failure-alert-message {
                font-weight: bold;
                letter-spacing: 0.5px;
                line-height: 1.4;
                text-shadow: 0 0 10px rgba(0, 255, 94, 0.3);
            }
            
            @keyframes fadeInFailure {
                from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }
            
            @keyframes fadeOutFailure {
                from {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                }
            }
        `;
        
        // Adicionar estilos e alerta ao DOM
        document.head.appendChild(style);
        document.body.appendChild(alert);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            if (alert.parentElement) {
                alert.style.animation = 'fadeOutFailure 0.3s ease-in forwards';
                setTimeout(() => {
                    if (alert.parentElement) {
                        alert.remove();
                    }
                    if (style.parentElement) {
                        style.remove();
                    }
                }, 300);
            }
        }, 5000);
        
        console.log('[FAILURE-ALERT] Alerta de falha exibido');
    }

    // Definir menu ativo
    setActiveMenu(activeIcon) {
        document.querySelectorAll('.menu-icon').forEach(icon => {
            icon.classList.remove('active');
        });
        activeIcon.classList.add('active');
    }

    // Monitor de login
    setupLoginMonitoring() {
        const webview = document.getElementById('insta');
        if (!webview) return;

        let perfilExtraido = false;

        webview.addEventListener("did-finish-load", async () => {
            console.log('Instagram carregado, verificando login...');
            
            setTimeout(async () => {
                try {
                    // PRIMEIRO: Verificar se o usuário está logado
                    const isLoggedIn = await webview.executeJavaScript(`
                        // Verificação confiável de login
                        !!(document.querySelector('img[alt*="profile picture"]') ||
                           document.querySelector('a[href="/accounts/edit/"]') ||
                           document.querySelector('a[href*="/accounts/edit"]') ||
                           document.querySelector('[data-testid="user-avatar"]') ||
                           document.querySelector('nav img[alt*="photo"]'))
                    `);

                    console.log('Status de login detectado:', isLoggedIn);
                    this.updateLoginStatus(isLoggedIn);

                    // SEGUNDO: Se estiver logado E ainda não extraiu o perfil, extrair dados
                    if (isLoggedIn && !perfilExtraido) {
                        console.log('Usuario logado detectado, extraindo dados do perfil...');
                        
                        const dados = await webview.executeJavaScript(`
                            (() => {
                                // Extrair dados APENAS do usuário logado atual
                                const profileImg = document.querySelector('img[alt*="profile picture"]') ||
                                                  document.querySelector('nav img[alt*="photo"]') ||
                                                  document.querySelector('[data-testid="user-avatar"] img');
                                
                                const editLink = document.querySelector('a[href="/accounts/edit/"]') ||
                                               document.querySelector('a[href*="/accounts/edit"]');
                                
                                // Buscar nome e username do perfil logado
                                let nome = "Usuario Instagram";
                                let usuario = "usuario";
                                
                                if (editLink) {
                                    // Se tem link de edição, está na própria página do perfil
                                    const headerName = document.querySelector('header h1, header h2');
                                    if (headerName) {
                                        nome = headerName.innerText.trim();
                                        usuario = nome.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    }
                                } else {
                                    // Tentar encontrar username na navegação
                                    const navLinks = document.querySelectorAll('nav a[href^="/"]');
                                    for (const link of navLinks) {
                                        const href = link.getAttribute('href');
                                        if (href && href !== '/' && !href.includes('explore') && !href.includes('direct')) {
                                            usuario = href.replace('/', '');
                                            nome = usuario;
                                            break;
                                        }
                                    }
                                }
                                
                                // Buscar estatísticas apenas se estiver na página do perfil
                                const estatisticas = [...document.querySelectorAll('header ul li span, main header section ul li span')].map(e => e.innerText.trim());
                                
                                return {
                                    nome,
                                    usuario,
                                    imagem: profileImg ? profileImg.src : null,
                                    seguidores: estatisticas[1] || "0", // Típica ordem: posts, seguidores, seguindo
                                    seguindo: estatisticas[2] || "0",
                                    posts: estatisticas[0] || "0",
                                    loggedIn: true
                                };
                            })()
                        `);

                        console.log('Dados do perfil extraidos:', dados);
                        
                        if (dados && dados.usuario && dados.usuario !== "usuario") {
                            this.updateDashboardWithProfile(dados);
                            
                            // Salvar dados do perfil para uso posterior
                            if (dados.nome && dados.usuario) {
                                await this.saveProfileData({
                                    username: dados.usuario,
                                    display_name: dados.nome,
                                    profile_pic: dados.imagem,
                                    followers: this.parseNumber(dados.seguidores),
                                    following: this.parseNumber(dados.seguindo),
                                    posts: this.parseNumber(dados.posts),
                                    timestamp: new Date().toISOString()
                                });
                            }
                            
                            perfilExtraido = true;
                            console.log('Perfil extraido e salvo com sucesso:', dados.usuario);
                        } else {
                            console.log('Nao foi possivel extrair dados do perfil, tentando novamente em 5s...');
                            setTimeout(() => { perfilExtraido = false; }, 5000);
                        }
                    } else if (!isLoggedIn) {
                        console.log('Usuario nao logado, resetando dados...');
                        perfilExtraido = false;
                    }

                } catch (e) {
                    console.error("Erro ao verificar login ou extrair perfil:", e.message);
                    this.updateLoginStatus(false);
                }
            }, 4000); // Aguarda DOM estabilizar completamente
        });

        // Monitorar navegações
        webview.addEventListener('did-navigate', (event) => {
            console.log('Navegacao Instagram:', event.url);
            
            // Reset quando navegar para páginas de login/logout
            if (event.url.includes('/accounts/login') || 
                event.url.includes('/accounts/logout') || 
                event.url.includes('logout')) {
                console.log('Detectada navegacao para login/logout, resetando estado...');
                perfilExtraido = false;
                this.updateLoginStatus(false);
            }
            
            // Reset quando sair do Instagram
            if (!event.url.includes('instagram.com')) {
                perfilExtraido = false;
                this.updateLoginStatus(false);
            }
        });
    }

    // Função para atualizar a interface da aba de estatísticas
    updateDashboardWithProfile(dados) {
        try {
            console.log(' Atualizando dashboard com dados:', dados);
            
            // Atualizar elementos do perfil
            const profileName = document.getElementById('profile-name');
            const profileUsername = document.getElementById('profile-username');
            const profilePic = document.getElementById('profile-pic');
            
            if (profileName) {
                profileName.textContent = dados.nome || 'Usuário Instagram';
            }
            
            if (profileUsername) {
                const username = dados.usuario.startsWith('@') ? dados.usuario : `@${dados.usuario}`;
                profileUsername.textContent = username;
            }
            
            if (profilePic && dados.imagem) {
                profilePic.src = dados.imagem;
                profilePic.alt = `Foto de ${dados.nome}`;
            }
            
            // Atualizar métricas
            const followersEl = document.getElementById('total-followers');
            const followingEl = document.getElementById('total-following');
            const postsEl = document.getElementById('total-posts');
            
            if (followersEl) {
                followersEl.textContent = this.formatNumber(this.parseNumber(dados.seguidores));
            }
            
            if (followingEl) {
                followingEl.textContent = this.formatNumber(this.parseNumber(dados.seguindo));
            }
            
            if (postsEl) {
                postsEl.textContent = this.formatNumber(this.parseNumber(dados.posts));
            }
            
            // Salvar dados formatados para persistência
            if (dados.usuario && dados.usuario !== "desconhecido") {
                const profileData = {
                    username: dados.usuario,
                    display_name: dados.nome,
                    profile_pic: dados.imagem,
                    followers: this.parseNumber(dados.seguidores),
                    following: this.parseNumber(dados.seguindo),
                    posts: this.parseNumber(dados.posts),
                    bio: '',
                    is_private: false,
                    is_verified: false,
                    last_updated: new Date().toISOString()
                };
                
                this.saveProfileData(profileData);
                this.state.profileDataCaptured = true;
                
                console.log('Dados salvos:', profileData);
            }
            
            console.log('Dashboard atualizado com sucesso');
            
        } catch (error) {
            console.error('Erro ao atualizar dashboard:', error);
        }
    }

    // Converter texto para número
    parseNumber(text) {
        return Utils.parseNumber(text);
    }

    updateLoginStatus(isLoggedIn) {
        // Manter compatibilidade com sistema legado se necessário
        const loginStatus = document.querySelector('.status-bar .status:first-child');
        if (loginStatus) {
            if (isLoggedIn) {
                loginStatus.textContent = 'LOGADO';
                loginStatus.classList.remove('red');
                loginStatus.classList.add('green');
            } else {
                loginStatus.textContent = 'NÃO LOGADO';
                loginStatus.classList.remove('green');
                loginStatus.classList.add('red');
            }
        }
        
        // Atualizar nova StatusBar Inteligente
        if (this.components.statusBar) {
            if (isLoggedIn) {
                this.components.statusBar.updateStatus('LOGADO', 'Online', 'Sessão ativa');
                this.state.isLoggedIn = true;
                console.log('[NAVIGATION] Usuário logado detectado');
            } else {
                this.components.statusBar.updateStatus('DESLOGADO', 'Login necessário', 'Clique para acessar o Instagram');
                this.state.isLoggedIn = false;
                this.state.profileDataCaptured = false;
            }
        }
    }

    // Métodos legados removidos - usando apenas extractProfileDataSafe

    // Salvar dados do perfil
    async saveProfileData(profileData) {
        try {
            // Enviar dados para o processo principal salvar
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('save-profile-data', profileData);
            
            // Atualizar dados locais
            this.state.realProfileData = profileData;
            
        } catch (error) {
            console.log(' Erro ao salvar dados do perfil:', error);
        }
    }

    // Listener automático para desbloqueio/bloqueio de módulos (REFATORADO)
    setupLoginStatusListener() {
        const { ipcRenderer } = require('electron');
        
        // Listener automático para desbloqueio/bloqueio de módulos
        ipcRenderer.on('login-status-update', (event, data) => {
            console.log('[AUTO-STATUS] Atualização recebida:', data);
            
            const wasLoggedIn = this.state.isLoggedIn;
            
            if (data.status === 'LOGADO') {
                console.log('[AUTO-UNLOCK] Login detectado - desbloqueando dashboard automaticamente');
                this.unlockAllModules();
                
                // Se transição de não-logado para logado, extração automática
                if (!wasLoggedIn) {
                    console.log('[AUTO-EXTRACT] Nova sessão detectada - extração automática');
                }
                
            } else {
                console.log('[AUTO-BLOCK] Sessão perdida - bloqueando dashboard automaticamente');
                this.blockAllModules();
                
                // Limpar dados quando logout detectado
                if (wasLoggedIn) {
                    console.log('[AUTO-CLEAN] Limpando dados da sessão perdida');
                    this.state.realProfileData = null;
                    this.state.profileDataCaptured = false;
                }
            }
        });
        
        console.log('[AUTO-LISTENER] Sistema automático de bloqueio/desbloqueio configurado');
    }

    // Função removida: setupGoToLoginButton (não mais necessária)
    // Sistema automático não requer botão "IR PARA LOGIN"

    // Verificar status de login (REFATORADO - Sistema Automático)
    async checkLoginStatus() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('check-instagram-status');
            
            console.log('[AUTO-STATUS] Verificação manual:', result);
            
            if (result.success) {
                if (result.status === 'LOGADO') {
                    this.unlockAllModules();
                    
                    // Extração automática desabilitada - disponível apenas via botão manual
                    console.log('[SYSTEMS] Extração de username disponível via botão manual');
                    
                } else {
                    this.blockAllModules();
                }
            }
            
        } catch (error) {
            console.error('[AUTO-STATUS] Erro na verificação manual:', error.message);
        }
    }

    // Configurar sistema de detecção de username (NOVO)
    setupUsernameDetection() {
        const { ipcRenderer } = require('electron');
        
        // Listener para username detectado
        ipcRenderer.on('username-detected', (event, data) => {
            console.log('[USERNAME DETECTED] Recebido:', data);
            
            if (data.username) {
                console.log(`[USERNAME DETECTED] Username identificado: @${data.username}`);
                
                // Remover modal de login se ainda estiver presente
                this.hideLoginModal();
                
                // Atualizar interface com username
                this.updateInterfaceWithUsername(data.username);
                
                // Navegar para o perfil automaticamente
                setTimeout(async () => {
                    await this.navigateToUserProfile(data.username);
                }, 1000);
            }
        });

        // Listener para solicitação de configuração de username
        ipcRenderer.on('request-username-input', (event, data) => {
            console.log('[USERNAME CONFIG] Solicitação recebida:', data);
            this.showUsernameConfigModal(data);
        });
        
        console.log('Sistema de detecção de username configurado');
    }

    // Extração manual de username através de botão
    async manualExtractUsername() {
        const extractBtn = document.getElementById('extract-username-btn');
        
        try {
            if (extractBtn) {
                extractBtn.classList.add('loading');
                extractBtn.textContent = 'Extraindo...';
                extractBtn.disabled = true;
            }

            console.log('[USERNAME] Extração manual iniciada pelo usuário');
            
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('force-get-username');
            
            if (result.success && result.username) {
                console.log(`[USERNAME] Extração manual bem-sucedida: ${result.username}`);
                
                // Processar username detectado
                ipcRenderer.send('username-detected', { 
                    username: result.username,
                    source: 'manual_extraction'
                });
                
                this.showSuccessMessage(`Username extraído: @${result.username}`);
                return result.username;
                
            } else {
                console.warn(`[USERNAME] Extração manual falhou: ${result.error}`);
                this.showErrorMessage(`Falha na extração: ${result.error}`);
                return null;
            }
            
        } catch (error) {
            console.warn('[USERNAME] Erro na extração manual:', error.message);
            this.showErrorMessage(`Erro: ${error.message}`);
            return null;
        } finally {
            if (extractBtn) {
                extractBtn.classList.remove('loading');
                extractBtn.textContent = 'Extrair Username';
                extractBtn.disabled = false;
            }
        }
    }

    // Mostrar mensagem de erro
    showErrorMessage(message) {
        Utils.showMessage(message, 'error', 5000);
    }

    // Atualizar interface com username (NOVO)
    updateInterfaceWithUsername(username) {
        try {
            console.log(`[INTERFACE] Atualizando com username: @${username}`);
            
            // Atualizar elementos da interface que mostram username
            const profileUsername = document.getElementById('profile-username');
            if (profileUsername) {
                profileUsername.textContent = `@${username}`;
            }
            
            // Atualizar dados do perfil local se não existirem
            if (!this.state.realProfileData || !this.state.realProfileData.username) {
                this.state.realProfileData = {
                    username: username,
                    display_name: username,
                    profile_pic: '',
                    followers: 0,
                    following: 0,
                    posts: 0,
                    last_updated: new Date().toISOString()
                };
                
                this.updateDashboardWithRealProfile(this.state.realProfileData);
            }
            
        } catch (error) {
            console.error('[INTERFACE] Erro ao atualizar com username:', error.message);
        }
    }

    // Navegar para perfil do usuário (NOVO)
    async navigateToUserProfile(username) {
        try {
            console.log(`[NAVIGATE] Navegando para perfil: @${username}`);
            
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('go-to-profile', username);
            
            if (result.success) {
                console.log(`[NAVIGATE] Sucesso: ${result.message}`);
                
                // EXTRAÇÃO AUTOMÁTICA APÓS NAVEGAÇÃO DESABILITADA
                // Motivo: Causava extrações durante carregamento e múltiplos erros
                console.log('[NAVEGAÇÃO] Perfil carregado - extração manual disponível via botão');
                
            } else {
                console.error(`[NAVIGATE] Erro: ${result.message}`);
            }
            
        } catch (error) {
            console.error('[NAVIGATE] Erro crítico:', error.message);
        }
    }

    // Exibir modal de configuração de username (NOVO)
    showUsernameConfigModal(data) {
        try {
            console.log('[USERNAME CONFIG] Exibindo modal de configuração...');
            
            // Remover modal existente se houver
            const existingModal = document.getElementById('username-config-modal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Criar modal
            const modal = document.createElement('div');
            modal.id = 'username-config-modal';
            modal.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    font-family: 'Consolas', monospace;
                ">
                    <div style="
                        background: #000;
                        color: #00FF5E;
                        padding: 30px;
                        border: 2px solid #00FF5E;
                        border-radius: 10px;
                        box-shadow: 0 0 30px rgba(0, 255, 94, 0.5);
                        text-align: center;
                        min-width: 400px;
                    ">
                        <h3 style="margin-top: 0; color: #00FF5E;">Configurar Username</h3>
                        <p style="margin: 20px 0; line-height: 1.6;">
                            ID do usuário: <strong>${data.dsUserId}</strong><br/>
                            Digite seu username do Instagram (sem o @):
                        </p>
                        <input 
                            type="text" 
                            id="username-input" 
                            placeholder="seu_username_aqui"
                            style="
                                width: 100%;
                                padding: 12px;
                                background: #111;
                                border: 2px solid #00FF5E;
                                color: #00FF5E;
                                border-radius: 5px;
                                font-family: 'Consolas', monospace;
                                font-size: 14px;
                                margin: 15px 0;
                                box-sizing: border-box;
                            "
                        />
                        <div style="margin-top: 20px;">
                            <button 
                                id="save-username-btn"
                                style="
                                    background: #00FF5E;
                                    color: #000;
                                    border: none;
                                    padding: 12px 25px;
                                    border-radius: 5px;
                                    font-weight: bold;
                                    cursor: pointer;
                                    margin-right: 10px;
                                    font-family: 'Consolas', monospace;
                                "
                            >SALVAR</button>
                            <button 
                                id="cancel-username-btn"
                                style="
                                    background: transparent;
                                    color: #00FF5E;
                                    border: 2px solid #00FF5E;
                                    padding: 10px 25px;
                                    border-radius: 5px;
                                    cursor: pointer;
                                    font-family: 'Consolas', monospace;
                                "
                            >CANCELAR</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Focar no input
            const input = document.getElementById('username-input');
            input.focus();
            
            // Configurar eventos
            const saveBtn = document.getElementById('save-username-btn');
            const cancelBtn = document.getElementById('cancel-username-btn');
            
            saveBtn.addEventListener('click', async () => {
                await this.saveUsernameConfig(data.dsUserId, input.value);
            });
            
            cancelBtn.addEventListener('click', () => {
                modal.remove();
                console.log('[USERNAME CONFIG] Configuração cancelada');
            });
            
            // Enter para salvar
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.saveUsernameConfig(data.dsUserId, input.value);
                }
            });
            
        } catch (error) {
            console.error('[USERNAME CONFIG] Erro ao exibir modal:', error.message);
        }
    }

    // Salvar configuração de username (NOVO)
    async saveUsernameConfig(dsUserId, username) {
        try {
            console.log('[USERNAME CONFIG] Salvando configuração...');
            
            if (!username || !username.trim()) {
                alert('Por favor, digite um username válido');
                return;
            }
            
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('configure-username', {
                dsUserId: dsUserId,
                username: username.trim()
            });
            
            if (result.success) {
                console.log(`[USERNAME CONFIG] Sucesso: ${result.message}`);
                
                // Remover modal
                const modal = document.getElementById('username-config-modal');
                if (modal) {
                    modal.remove();
                }
                
                // Mostrar mensagem de sucesso
                this.showSuccessMessage(`Username @${result.username} configurado com sucesso!`);
                
            } else {
                console.error(`[USERNAME CONFIG] Erro: ${result.error}`);
                alert(`Erro: ${result.error}`);
            }
            
        } catch (error) {
            console.error('[USERNAME CONFIG] Erro crítico:', error.message);
            alert(`Erro ao salvar configuração: ${error.message}`);
        }
    }

    // Mostrar mensagem de sucesso
    showSuccessMessage(message) {
        Utils.showMessage(message, 'success', 3000);
    }

    // Extrair dados do perfil atual via IPC (com sistema de cache)
    async extractCurrentProfile(forceRefresh = false) {
        try {
            console.log('=== INICIANDO EXTRAÇÃO ROBUSTA DO PERFIL ===');
            
            // Notificar StatusBar sobre início da extração
            if (this.components.statusBar) {
                this.components.statusBar.updateStatus('CARREGANDO', 'Extraindo perfil...', 'Obtendo dados do Instagram');
            }
            
            const { ipcRenderer } = require('electron');
            
            // Verificar cache apenas se não for forçado
            if (!forceRefresh) {
                const cacheResult = await ipcRenderer.invoke('check-profile-cache');
                
                if (cacheResult.useCache) {
                    console.log(`[CACHE] Dados recentes encontrados - usando cache (${cacheResult.minutesAgo} min atrás)`);
                    
                    // Atualizar interface com dados do cache
                    this.updateDashboardWithRealProfile(cacheResult.profileData);
                    this.state.realProfileData = cacheResult.profileData;
                    this.state.profileDataCaptured = true;
                    
                    // Notificar StatusBar sobre sucesso do cache
                    if (this.components.statusBar) {
                        const username = cacheResult.profileData.username || cacheResult.profileData.display_name || 'Usuário';
                        this.components.statusBar.updateStatus('LOGADO', `@${username}`, `Dados do cache (${cacheResult.minutesAgo} min atrás)`);
                    }
                    
                    console.log('[INTERFACE] Dashboard atualizado com dados do cache');
                    return;
                }
            } else {
                console.log('[MANUAL] Extração forçada via botão "Atualizar Dados"');
            }
            
            // Prosseguir com extração completa
            const extractionResult = await ipcRenderer.invoke('extract-current-profile');
            
            if (extractionResult.success && extractionResult.profile) {
                const profile = extractionResult.profile;
                
                console.log(`[SUCESSO] Perfil extraído: ${profile.username}`);
                console.log(`[DADOS] Nome: ${profile.display_name}`);
                console.log(`[DADOS] Seguidores: ${profile.followers}`);
                console.log(`[DADOS] Seguindo: ${profile.following}`);
                console.log(`[DADOS] Posts: ${profile.posts}`);
                
                // Atualizar interface com dados reais
                this.updateDashboardWithRealProfile(profile);
                this.state.realProfileData = profile;
                this.state.profileDataCaptured = true;
                
                // Notificar StatusBar sobre sucesso
                if (this.components.statusBar) {
                    const username = profile.username || profile.display_name || 'Usuário';
                    this.components.statusBar.updateStatus('LOGADO', `@${username}`, 'Perfil atualizado com sucesso');
                }
                
                console.log('[INTERFACE] Dashboard atualizado com dados reais');
                
            } else {
                console.error('[FALHA] Não foi possível extrair perfil:', extractionResult.message);
                console.log('[FALLBACK] Tentando carregar dados salvos...');
                
                // Notificar StatusBar sobre erro na extração
                if (this.components.statusBar) {
                    this.components.statusBar.updateStatus('ERRO', 'Erro na extração', extractionResult.message || 'Falha ao obter dados do perfil');
                }
                
                // Tentar carregar dados salvos como fallback
                try {
                    const savedProfile = await ipcRenderer.invoke('get-profile-data');
                    if (savedProfile && savedProfile.username) {
                        console.log('[FALLBACK] Dados salvos carregados:', savedProfile.username);
                        this.updateDashboardWithRealProfile(savedProfile);
                        this.state.realProfileData = savedProfile;
                        
                        // Notificar StatusBar sobre fallback
                        if (this.components.statusBar) {
                            const username = savedProfile.username || savedProfile.display_name || 'Usuário';
                            this.components.statusBar.updateStatus('LOGADO', `@${username}`, 'Dados salvos carregados');
                        }
                    }
                } catch (fallbackError) {
                    console.error('[FALLBACK] Erro ao carregar dados salvos:', fallbackError);
                    
                    // Notificar StatusBar sobre erro no fallback
                    if (this.components.statusBar) {
                        this.components.statusBar.updateStatus('ERRO', 'Erro crítico', 'Não foi possível carregar dados do perfil');
                    }
                }
            }
            
        } catch (error) {
            console.error('[ERRO CRÍTICO] Falha na extração do perfil:', error);
            
            // Notificar StatusBar sobre erro crítico
            if (this.components.statusBar) {
                this.components.statusBar.updateStatus('ERRO', 'Erro crítico', error.message);
            }
        }
    }
    
    // Atualizar dashboard com dados reais do perfil
    updateDashboardWithRealProfile(profileData) {
        try {
            console.log('[DASHBOARD] Atualizando com dados reais:', profileData.username);
            
            // Atualizar elementos do perfil
            const profileName = document.getElementById('profile-name');
            const profileUsername = document.getElementById('profile-username');
            const profilePic = document.getElementById('profile-pic');
            
            if (profileName) {
                profileName.textContent = profileData.display_name || profileData.username;
            }
            
            if (profileUsername) {
                const username = profileData.username.startsWith('@') ? profileData.username : `@${profileData.username}`;
                profileUsername.textContent = username;
            }
            
            if (profilePic && profileData.profile_pic) {
                profilePic.src = profileData.profile_pic;
                profilePic.alt = `Foto de ${profileData.display_name || profileData.username}`;
            }
            
            // Atualizar métricas com dados reais
            const followersEl = document.getElementById('total-followers');
            const followingEl = document.getElementById('total-following');
            const postsEl = document.getElementById('total-posts');
            
            if (followersEl) {
                followersEl.textContent = this.formatNumber(profileData.followers);
            }
            
            if (followingEl) {
                followingEl.textContent = this.formatNumber(profileData.following);
            }
            
            if (postsEl) {
                postsEl.textContent = this.formatNumber(profileData.posts);
            }
            
            console.log('[DASHBOARD] Atualização concluída com sucesso');
            
        } catch (error) {
            console.error('[DASHBOARD] Erro ao atualizar:', error);
        }
    }

    // Função removida: showLoginAlert (não mais necessária)
    // Sistema automático bloqueia módulos visualmente sem modal

    // Carregar dados de estatísticas
    async loadStatsData() {
        try {
            const statsResponse = await fetch('../data/stats.json');
            const stats = await statsResponse.json();
            
            const botStatsResponse = await fetch('../data/bot_stats.json');
            const botStats = await botStatsResponse.json();
            
            // Tentar carregar dados do perfil real via IPC
            let profileData = {};
            try {
                const { ipcRenderer } = require('electron');
                profileData = await ipcRenderer.invoke('get-profile-data');
                
                if (profileData && profileData.username) {
                    console.log('Dados reais do perfil carregados:', profileData.username);
                    this.state.realProfileData = profileData;
                } else {
                    console.log('Dados do perfil não encontrados, usando padrões');
                }
            } catch (e) {
                console.log('Erro ao carregar dados do perfil via IPC:', e);
                // Tentar fallback via fetch
                try {
                    const profileResponse = await fetch('../data/profile.json');
                    profileData = await profileResponse.json();
                    if (profileData && profileData.username) {
                        this.state.realProfileData = profileData;
                    }
                } catch (fetchError) {
                    console.log('Dados do perfil não encontrados via fetch, usando padrões');
                }
            }
            
            this.components.statsData = { 
                ...stats, 
                bot: botStats,
                profile: profileData && profileData.username ? profileData : null
            };
            
            // Se temos dados reais do perfil capturados, usar eles
            if (this.state.realProfileData) {
                this.components.statsData.profile = this.state.realProfileData;
            }
            
        } catch (error) {
            console.log('Usando dados simulados para estatísticas');
            this.components.statsData = this.generateSimulatedData();
        }
    }

    // Gerar dados simulados
    generateSimulatedData() {
        return {
            total: {
                likes: 1247,
                follows: 189,
                comments: 67,
                unfollows: 23,
                stories_viewed: 456,
                total_sessions: 12
            },
            bot: {
                likes: 1247,
                follows: 189,
                comments: 67,
                unfollows: 23,
                errors: 5
            },
            profile: {
                followers: 2847,
                following: 1203,
                posts: 42,
                name: "Usuário InstaBot",
                username: "@instabot_user"
            },
            daily: this.generateDailyData()
        };
    }

    generateDailyData() {
        const daily = {};
        const today = new Date();
        
        // Usar dados do perfil real se disponível para gerar dados mais realistas
        const baseFollowers = this.state.realProfileData?.followers || 2800;
        const baseEngagement = Math.floor(baseFollowers * 0.03); // 3% de engagement aproximado
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            daily[dateStr] = {
                likes: Math.floor(Math.random() * 50) + 10,
                follows: Math.floor(Math.random() * 15) + 2,
                comments: Math.floor(Math.random() * 8) + 1,
                followers: baseFollowers + (Math.random() - 0.5) * 100,
                engagement: baseEngagement + (Math.random() - 0.5) * 50
            };
        }
        
        return daily;
    }

    // Atualizar dados na interface
    updateStatsData() {
        if (!this.components.statsData) return;

        const { total, bot, profile } = this.components.statsData;

        // Usar dados reais do perfil se disponíveis
        const realProfile = this.state.realProfileData || profile;

        // Atualizar métricas
        document.getElementById('total-followers').textContent = this.formatNumber(realProfile?.followers || 0);
        document.getElementById('total-following').textContent = this.formatNumber(realProfile?.following || 0);
        document.getElementById('total-posts').textContent = this.formatNumber(realProfile?.posts || 0);
        document.getElementById('total-likes').textContent = this.formatNumber(total?.likes || bot?.likes || 0);
        document.getElementById('total-comments').textContent = this.formatNumber(total?.comments || bot?.comments || 0);
        
        const totalActions = (total?.likes || 0) + (total?.follows || 0) + (total?.comments || 0);
        document.getElementById('total-actions').textContent = this.formatNumber(totalActions);

        // Atualizar perfil
        const profileName = realProfile?.display_name || realProfile?.username || 'Usuário Instagram';
        const profileUsername = realProfile?.username ? `@${realProfile.username.replace('@', '')}` : '@usuario';
        
        document.getElementById('profile-name').textContent = profileName;
        document.getElementById('profile-username').textContent = profileUsername;
        
        // Atualizar foto de perfil
        const profilePicElement = document.getElementById('profile-pic');
        if (realProfile?.profile_pic && realProfile.profile_pic !== '') {
            profilePicElement.src = realProfile.profile_pic;
            profilePicElement.alt = `Foto de ${profileName}`;
        }
    }

    // Formatar números (ex: 1.2k, 1.5M)
    formatNumber(num) {
        return Utils.formatNumber(num);
    }

    // Renderizar gráficos
    renderCharts() {
        if (!this.components.statsData?.daily) return;

        this.renderFollowersChart();
        this.renderEngagementChart();
        this.renderActionsChart();
        this.renderActionsTypeChart();
    }

    renderFollowersChart() {
        const canvas = document.getElementById('followersChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const daily = this.components.statsData.daily;
        const dates = Object.keys(daily).slice(-7); // Últimos 7 dias
        const followers = dates.map(date => daily[date].followers || 0);

        this.drawLineChart(ctx, canvas, {
            labels: dates.map(date => new Date(date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })),
            data: followers,
            color: '#00FF5E',
            title: 'Seguidores por Dia'
        });
    }

    renderEngagementChart() {
        const canvas = document.getElementById('engagementChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const daily = this.components.statsData.daily;
        const dates = Object.keys(daily).slice(-7);
        const engagement = dates.map(date => daily[date].engagement || 0);

        this.drawLineChart(ctx, canvas, {
            labels: dates.map(date => new Date(date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })),
            data: engagement,
            color: '#FF69B4',
            title: 'Engajamento por Dia'
        });
    }

    renderActionsChart() {
        const canvas = document.getElementById('actionsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const daily = this.components.statsData.daily;
        const dates = Object.keys(daily).slice(-7);
        const actions = dates.map(date => {
            const day = daily[date];
            return (day.likes || 0) + (day.follows || 0) + (day.comments || 0);
        });

        this.drawBarChart(ctx, canvas, {
            labels: dates.map(date => new Date(date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })),
            data: actions,
            color: '#00FF5E',
            title: 'Ações por Dia'
        });
    }

    renderActionsTypeChart() {
        const canvas = document.getElementById('actionsTypeChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { total } = this.components.statsData;

        const data = [
            { label: 'Likes', value: total?.likes || 0, color: '#FF6B6B' },
            { label: 'Follows', value: total?.follows || 0, color: '#4ECDC4' },
            { label: 'Comments', value: total?.comments || 0, color: '#45B7D1' },
            { label: 'Unfollows', value: total?.unfollows || 0, color: '#FFA07A' }
        ];

        this.drawPieChart(ctx, canvas, data);
    }

    // Desenhar gráfico de linha
    drawLineChart(ctx, canvas, config) {
        const { labels, data, color } = config;
        const padding = 40;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        const maxValue = Math.max(...data) * 1.1;
        const minValue = Math.min(...data) * 0.9;
        const range = maxValue - minValue;

        // Desenhar linhas do gráfico
        ctx.beginPath();
        data.forEach((value, index) => {
            const x = padding + (index * width) / (data.length - 1);
            const y = padding + height - ((value - minValue) / range) * height;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Desenhar pontos
        data.forEach((value, index) => {
            const x = padding + (index * width) / (data.length - 1);
            const y = padding + height - ((value - minValue) / range) * height;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Labels
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Consolas';
        ctx.textAlign = 'center';
        
        labels.forEach((label, index) => {
            const x = padding + (index * width) / (data.length - 1);
            ctx.fillText(label, x, canvas.height - 10);
        });
    }

    // Desenhar gráfico de barras
    drawBarChart(ctx, canvas, config) {
        const { labels, data, color } = config;
        const padding = 40;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = color;

        const maxValue = Math.max(...data) * 1.1;
        const barWidth = width / data.length * 0.8;
        const barSpacing = width / data.length * 0.2;

        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * height;
            const x = padding + index * (barWidth + barSpacing);
            const y = padding + height - barHeight;

            ctx.fillRect(x, y, barWidth, barHeight);
        });

        // Labels
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Consolas';
        ctx.textAlign = 'center';
        
        labels.forEach((label, index) => {
            const x = padding + index * (barWidth + barSpacing) + barWidth / 2;
            ctx.fillText(label, x, canvas.height - 10);
        });
    }

    // Desenhar gráfico de pizza
    drawPieChart(ctx, canvas, data) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 40;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const total = data.reduce((sum, item) => sum + item.value, 0);
        let currentAngle = -Math.PI / 2;

        data.forEach(item => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();

            // Labels
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
            const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, labelX, labelY);

            currentAngle += sliceAngle;
        });
    }
}

// Inicializar InstaBot v1.0 com sistema automático refatorado
document.addEventListener('DOMContentLoaded', () => {
    console.log('======================================');
    console.log('InstaBot v1.0 - SISTEMA AUTOMÁTICO');
    console.log('Dashboard travado até login detectado');
    console.log('Detecção automática de login ativa');
    console.log('Desbloqueio automático de módulos');
    console.log('Extração automática de perfil');
    console.log('Botão "IR PARA LOGIN" removido');
    console.log('Modal de força de login removido');
    console.log('======================================');
    
    window.navigationController = new NavigationController();
    
    // Efeitos visuais cyber para módulos bloqueados/desbloqueados (RESTAURADO)
    setTimeout(() => {
        document.querySelectorAll('.menu-icon').forEach((icon, index) => {
            setTimeout(() => {
                if (icon.classList.contains('blocked')) {
                    icon.style.animation = 'neonFlash 0.3s ease-in-out';
                    icon.style.filter = 'hue-rotate(300deg) brightness(0.7)';
                } else {
                    icon.style.animation = 'neonFlash 0.5s ease-in-out';
                }
                
                // Adicionar efeito de entrada sequencial
                icon.style.opacity = '0';
                icon.style.transform = 'translateX(-20px)';
                icon.style.transition = 'all 0.4s ease-out';
                
                setTimeout(() => {
                    icon.style.opacity = '1';
                    icon.style.transform = 'translateX(0)';
                }, index * 80);
                
            }, index * 100);
        });
    }, 500);

    // Efeito no título com indicação de status
    setInterval(() => {
        const title = document.querySelector('.title');
        const status = document.querySelector('.status');
        if (Math.random() < 0.1) {
            title.style.opacity = '0.3';
            setTimeout(() => title.style.opacity = '1', 100);
        }
        
        // Pulsar indicador de status
        if (status && status.classList.contains('green')) {
            status.style.boxShadow = '0 0 20px rgba(0, 255, 94, 0.8)';
            setTimeout(() => status.style.boxShadow = '0 0 10px rgba(0, 255, 94, 0.6)', 200);
        }
    }, 2000);
    
    console.log('[INIT] InstaBot v1.0 - INTERFACE AUTOMÁTICA ATIVADA');
    console.log('[INIT] StatusBar Inteligente v1.0 - Sistema de monitoramento ativo');
    
    // Inicializar sistema de blindagem de sessão
    window.sessionGuard = new SessionGuard();
});

// ════════════════════════════════════════════════════════════════════════════════
//                    SISTEMA DE BLINDAGEM DE SESSÃO (PARTE 6)
// Monitoramento contínuo de validade da sessão com reautenticação assistida
// ════════════════════════════════════════════════════════════════════════════════

class SessionGuard {
    constructor() {
        this.isSessionValid = null;
        this.sessionAlertVisible = false;
        this.currentUser = null;
        
        this.setupSessionListeners();
        this.startSessionMonitoring();
    }

    setupSessionListeners() {
        // Listener para atualizações de status de sessão
        window.ipcRenderer.on('session-status-update', (event, data) => {
            console.log('[SESSION-GUARD] Status de sessão atualizado:', data);
            this.handleSessionStatusUpdate(data);
        });

        // Listener para login recuperado
        window.ipcRenderer.on('login-status-update', (event, data) => {
            if (data.loggedIn && !this.isSessionValid) {
                console.log('[SESSION] Login recuperado — restaurando interface');
                this.handleSessionRecovery();
            }
        });
    }

    startSessionMonitoring() {
        console.log('[SESSION-GUARD] Iniciando monitoramento de sessão...');
        
        try {
            window.ipcRenderer.send('start-session-monitoring');
            console.log('[SESSION-GUARD] Solicitação de monitoramento enviada');
        } catch (error) {
            console.error('[SESSION-GUARD] Erro ao iniciar monitoramento:', error);
        }
    }

    handleSessionStatusUpdate(data) {
        const wasValid = this.isSessionValid;
        this.isSessionValid = data.isValid;

        if (wasValid !== this.isSessionValid) {
            if (this.isSessionValid) {
                this.handleSessionRecovery();
            } else {
                this.handleSessionExpired(data);
            }
        }
    }

    handleSessionExpired(data) {
        console.log('[SESSION] Sessão expirada — redirecionando para login');
        
        // 1. Atualizar status para DESLOGADO
        if (window.navigationController) {
            window.navigationController.updateLoginStatus(false);
            
            // Notificar StatusBar sobre sessão expirada
            if (window.navigationController.components.statusBar) {
                window.navigationController.components.statusBar.updateStatus('ERRO', 'Sessão expirada', data.reason || 'Faça login novamente');
            }
        }

        // 2. Exibir alerta superior
        this.showSessionExpiredAlert(data.reason);

        // 3. Reativar WebView automaticamente na tela de login
        this.redirectToLoginPage();

        // 4. Bloquear módulos
        if (window.navigationController) {
            window.navigationController.blockAllModules();
        }
    }

    handleSessionRecovery() {
        console.log('[SESSION] Login recuperado — restaurando interface');
        
        // 1. Atualizar status para LOGADO
        if (window.navigationController) {
            window.navigationController.updateLoginStatus(true);
            
            // Notificar StatusBar sobre recuperação
            if (window.navigationController.components.statusBar) {
                window.navigationController.components.statusBar.updateStatus('LOGADO', 'Sessão recuperada', 'Login restaurado automaticamente');
            }
        }

        // 2. Remover alertas da interface
        this.hideSessionExpiredAlert();

        // 3. Restaurar funcionamento dos módulos
        if (window.navigationController) {
            window.navigationController.unlockAllModules();
        }

        // 
        //EXTRAÇÃO AUTOMÁTICA DE SESSÃO DESABILITADA 
        // Motivo: Causava extrações durante carregamento e conflitos
        console.log('[SESSION-RECOVERY] Sessão recuperada - extração manual disponível');
    }

    showSessionExpiredAlert(reason) {
        if (this.sessionAlertVisible) return;

        console.log('[SESSION-ALERT] Exibindo alerta de sessão expirada');
        
        const alertHtml = `
            <div id="session-alert" class="session-expired-alert">
                <div class="session-alert-content">
                    <div class="session-alert-icon">
                        <img src="../assets/icons/warning.svg" alt="Aviso" class="session-alert-warning-icon">
                    </div>
                    <div class="session-alert-text">
                        <div class="session-alert-title">Sua sessão expirou</div>
                        <div class="session-alert-subtitle">Faça login novamente para continuar</div>
                    </div>
                    <div class="session-alert-close" onclick="window.sessionGuard.hideSessionExpiredAlert()">
                        <img src="../assets/icons/close.svg" alt="Fechar" class="session-alert-close-icon">
                    </div>
                </div>
                <div class="session-alert-progress"></div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', alertHtml);
        
        const alert = document.getElementById('session-alert');
        if (alert) {
            // Animação de entrada
            setTimeout(() => {
                alert.classList.add('visible');
            }, 100);
            
            this.sessionAlertVisible = true;
            
            // Efeito de progresso
            const progressBar = alert.querySelector('.session-alert-progress');
            if (progressBar) {
                progressBar.style.animation = 'sessionProgress 3s ease-in-out infinite';
            }
        }
    }

    hideSessionExpiredAlert() {
        const alert = document.getElementById('session-alert');
        if (alert) {
            alert.classList.remove('visible');
            setTimeout(() => {
                alert.remove();
                this.sessionAlertVisible = false;
                console.log('[SESSION-ALERT] Alerta de sessão removido');
            }, 300);
        }
    }

    redirectToLoginPage() {
        try {
            const webview = document.getElementById('insta');
            if (webview) {
                console.log('[SESSION-REDIRECT] Redirecionando para página de login');
                webview.src = 'https://www.instagram.com/accounts/login/';
                
                // Garantir que a webview esteja visível
                if (webview.style.display === 'none') {
                    webview.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('[SESSION-REDIRECT] Erro ao redirecionar:', error);
        }
    }

    // Parar monitoramento (para limpeza)
    stopSessionMonitoring() {
        console.log('[SESSION-GUARD] Parando monitoramento de sessão');
        
        try {
            window.ipcRenderer.send('stop-session-monitoring');
        } catch (error) {
            console.error('[SESSION-GUARD] Erro ao parar monitoramento:', error);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════════
    //                    SISTEMA DE EFEITOS CYBER PARA MENU ICONS
// Implementação de animações neonFlash com delays baseados no index
// ════════════════════════════════════════════════════════════════════════════════

class CyberMenuEffects {
    constructor() {
        this.menuIcons = [];
        this.effectsApplied = false;
        
        this.init();
    }
    
    async init() {
        console.log('[CYBER-EFFECTS] Inicializando sistema de efeitos cyber...');
        
        // Aguardar 500ms após carregar a página conforme especificado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.setupMenuIcons();
        this.applyNeonFlashAnimations();
        this.setupHoverEffects();
        
        console.log('[CYBER-EFFECTS] Sistema de efeitos cyber ativo');
    }
    
    setupMenuIcons() {
        this.menuIcons = document.querySelectorAll('.menu-icon');
        console.log(`[CYBER-EFFECTS] ${this.menuIcons.length} ícones de menu encontrados`);
    }
    
    applyNeonFlashAnimations() {
        console.log('[CYBER-EFFECTS] Aplicando animações neonFlash...');
        
        this.menuIcons.forEach((icon, index) => {
            // Aplicar delay baseado no index conforme especificado
            const delay = index * 100; // 100ms entre cada ícone
            
            setTimeout(() => {
                if (icon.classList.contains('blocked')) {
                    // Para ícones bloqueados: animação + filtro hue-rotate
                    icon.style.animation = 'neonFlash 0.3s ease-in-out';
                    icon.style.filter = 'hue-rotate(300deg)';
                    console.log(`[CYBER-EFFECTS] Ícone ${index + 1} (bloqueado) - efeito aplicado`);
                } else {
                    // Para ícones normais: animação padrão
                    icon.style.animation = 'neonFlash 0.5s ease-in-out';
                    console.log(`[CYBER-EFFECTS] Ícone ${index + 1} (normal) - efeito aplicado`);
                }
                
                // Limpar animação após execução
                setTimeout(() => {
                    icon.style.animation = '';
                }, 500);
                
            }, delay);
        });
        
        this.effectsApplied = true;
    }
    
    setupHoverEffects() {
        console.log('[CYBER-EFFECTS] Configurando efeitos de hover...');
        
        this.menuIcons.forEach((icon, index) => {
            // Event listener para mouseenter
            icon.addEventListener('mouseenter', (e) => {
                // Só aplicar scale se NÃO tiver classe 'active' ou 'selected'
                if (!icon.classList.contains('active') && !icon.classList.contains('selected')) {
                    icon.style.transform = 'scale(1.05)';
                    console.log(`[CYBER-EFFECTS] Hover ON - Ícone ${index + 1}`);
                }
            });
            
            // Event listener para mouseleave
            icon.addEventListener('mouseleave', (e) => {
                // Restaurar scale se NÃO tiver classe 'active' ou 'selected'
                if (!icon.classList.contains('active') && !icon.classList.contains('selected')) {
                    icon.style.transform = 'scale(1)';
                    console.log(`[CYBER-EFFECTS] Hover OFF - Ícone ${index + 1}`);
                }
            });
        });
    }
    
    // Método para replicar efeitos quando novos ícones são adicionados
    refreshEffects() {
        console.log('[CYBER-EFFECTS] Atualizando efeitos para novos ícones...');
        this.setupMenuIcons();
        this.applyNeonFlashAnimations();
        this.setupHoverEffects();
    }
    
    // Método para aplicar efeito específico em um ícone
    flashIcon(iconIndex) {
        if (iconIndex < this.menuIcons.length) {
            const icon = this.menuIcons[iconIndex];
            icon.style.animation = 'neonFlash 0.3s ease-in-out';
            
            setTimeout(() => {
                icon.style.animation = '';
            }, 300);
            
            console.log(`[CYBER-EFFECTS] Flash aplicado no ícone ${iconIndex + 1}`);
        }
    }
    
    // Método para atualizar estado de bloqueio com efeitos
    updateBlockedState(iconIndex, isBlocked) {
        if (iconIndex < this.menuIcons.length) {
            const icon = this.menuIcons[iconIndex];
            
            if (isBlocked) {
                icon.style.filter = 'hue-rotate(300deg)';
                icon.style.opacity = '0.4';
            } else {
                icon.style.filter = '';
                icon.style.opacity = '1';
            }
            
            // Aplicar flash para indicar mudança
            this.flashIcon(iconIndex);
            
            console.log(`[CYBER-EFFECTS] Estado de bloqueio atualizado - Ícone ${iconIndex + 1}: ${isBlocked ? 'BLOQUEADO' : 'DESBLOQUEADO'}`);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════════
//                        SISTEMA DE AUDITORIA DE ACESSIBILIDADE SVG
// Verificação automática de conformidade de acessibilidade para elementos SVG
// ════════════════════════════════════════════════════════════════════════════════

class SVGAccessibilityAuditor {
    constructor() {
        this.auditResults = [];
        this.observerActive = false;
        
        this.init();
    }
    
    init() {
        console.log('[SVG AUDITORIA] Inicializando sistema de auditoria de acessibilidade...');
        
        // Executar auditoria inicial após carregamento completo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.performFullAudit(), 1000);
            });
        } else {
            setTimeout(() => this.performFullAudit(), 1000);
        }
        
        // Configurar observer para detectar novos SVGs adicionados dinamicamente
        this.setupMutationObserver();
        
        console.log('[SVG AUDITORIA] Sistema de auditoria inicializado');
    }
    
    performFullAudit() {
        console.log('[SVG AUDITORIA] Iniciando auditoria completa de acessibilidade...');
        
        this.auditResults = [];
        const svgElements = document.querySelectorAll('svg');
        const imgElements = document.querySelectorAll('img[src*=".svg"], img[src*="data:image/svg"]');
        
        console.log(`[SVG AUDITORIA] Encontrados ${svgElements.length} elementos <svg> e ${imgElements.length} imagens SVG`);
        
        // Auditar elementos SVG diretos
        svgElements.forEach((svg, index) => {
            this.auditSVGElement(svg, `SVG-${index + 1}`);
        });
        
        // Auditar imagens SVG (não permitidas pelas regras)
        imgElements.forEach((img, index) => {
            this.auditSVGImage(img, `IMG-SVG-${index + 1}`);
        });
        
        // Verificar SVGs em base64 no CSS
        this.auditBase64SVGs();
        
        this.generateAuditReport();
    }
    
    auditSVGElement(svg, elementId) {
        const issues = [];
        const element = {
            id: elementId,
            outerHTML: svg.outerHTML.substring(0, 200) + (svg.outerHTML.length > 200 ? '...' : ''),
            location: this.getElementLocation(svg)
        };
        
        // 1. Verificar role="img"
        if (!svg.hasAttribute('role') || svg.getAttribute('role') !== 'img') {
            issues.push('Ausente ou incorreto: role="img"');
        }
        
        // 2. Verificar aria-label ou aria-hidden
        const hasAriaLabel = svg.hasAttribute('aria-label') && svg.getAttribute('aria-label').trim() !== '';
        const hasAriaHidden = svg.hasAttribute('aria-hidden');
        
        if (!hasAriaLabel && !hasAriaHidden) {
            issues.push('Ausente: aria-label ou aria-hidden');
        }
        
        // 3. Verificar viewBox
        if (!svg.hasAttribute('viewBox')) {
            issues.push('Ausente: viewBox');
        }
        
        // 4. Verificar fill="currentColor" no SVG ou paths
        const hasFillCurrentColor = this.checkFillCurrentColor(svg);
        if (!hasFillCurrentColor) {
            issues.push('Ausente: fill="currentColor" no <svg> ou <path>');
        }
        
        // 5. Verificar focusable="false" para SVGs decorativos
        if (hasAriaHidden && (!svg.hasAttribute('focusable') || svg.getAttribute('focusable') !== 'false')) {
            issues.push('SVG decorativo deve ter focusable="false"');
        }
        
        if (issues.length > 0) {
            const result = {
                element: element,
                issues: issues,
                severity: this.calculateSeverity(issues)
            };
            
            this.auditResults.push(result);
            this.logAuditIssue(result);
        }
    }
    
    auditSVGImage(img, elementId) {
        const element = {
            id: elementId,
            outerHTML: img.outerHTML.substring(0, 200) + (img.outerHTML.length > 200 ? '...' : ''),
            location: this.getElementLocation(img)
        };
        
        const result = {
            element: element,
            issues: ['SVG carregado via <img> - deve ser inline com atributos de acessibilidade'],
            severity: 'ALTA'
        };
        
        this.auditResults.push(result);
        this.logAuditIssue(result);
    }
    
    auditBase64SVGs() {
        // Verificar elementos com background-image contendo SVG base64
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element, index) => {
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;
            
            if (backgroundImage && backgroundImage.includes('data:image/svg+xml')) {
                const result = {
                    element: {
                        id: `BASE64-SVG-${index + 1}`,
                        outerHTML: element.outerHTML.substring(0, 200) + '...',
                        location: this.getElementLocation(element)
                    },
                    issues: ['SVG em base64 via CSS - deve ser arquivo SVG externo com acessibilidade'],
                    severity: 'MÉDIA'
                };
                
                this.auditResults.push(result);
                this.logAuditIssue(result);
            }
        });
    }
    
    checkFillCurrentColor(svg) {
        // Verificar no próprio SVG
        if (svg.hasAttribute('fill') && svg.getAttribute('fill') === 'currentColor') {
            return true;
        }
        
        // Verificar nos paths filhos
        const paths = svg.querySelectorAll('path, circle, rect, polygon, polyline, ellipse, line');
        for (let path of paths) {
            if (path.hasAttribute('fill') && path.getAttribute('fill') === 'currentColor') {
                return true;
            }
        }
        
        return false;
    }
    
    calculateSeverity(issues) {
        if (issues.some(issue => issue.includes('role=') || issue.includes('aria-'))) {
            return 'ALTA';
        } else if (issues.some(issue => issue.includes('viewBox') || issue.includes('focusable'))) {
            return 'MÉDIA';
        } else {
            return 'BAIXA';
        }
    }
    
    getElementLocation(element) {
        const rect = element.getBoundingClientRect();
        const classList = Array.from(element.classList).join(' ');
        const id = element.id || 'sem-id';
        
        return {
            id: id,
            classes: classList,
            position: `x:${Math.round(rect.left)}, y:${Math.round(rect.top)}`,
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`
        };
    }
    
    logAuditIssue(result) {
        const severity = result.severity;
        const issues = result.issues.join(' | ');
        const location = result.element.location;
        
        console.warn(
            `[SVG AUDITORIA] ${severity} - ${issues}`,
            `\nElemento: ${result.element.id}`,
            `\nLocalização: ID=${location.id}, classes="${location.classes}", posição=${location.position}`,
            `\nHTML: ${result.element.outerHTML}`
        );
    }
    
    setupMutationObserver() {
        if (this.observerActive) return;
        
        const observer = new MutationObserver((mutations) => {
            let hasNewSVGs = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'SVG' || node.querySelector('svg')) {
                            hasNewSVGs = true;
                        }
                    }
                });
            });
            
            if (hasNewSVGs) {
                console.log('[SVG AUDITORIA] Novos SVGs detectados, executando auditoria...');
                setTimeout(() => this.performFullAudit(), 500);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.observerActive = true;
        console.log('[SVG AUDITORIA] Observer de mutações ativo');
    }
    
    generateAuditReport() {
        if (this.auditResults.length === 0) {
            console.log('[SVG AUDITORIA] ✅ APROVADO - Todos os SVGs estão em conformidade com as diretrizes de acessibilidade');
            return;
        }
        
        const highSeverity = this.auditResults.filter(r => r.severity === 'ALTA').length;
        const mediumSeverity = this.auditResults.filter(r => r.severity === 'MÉDIA').length;
        const lowSeverity = this.auditResults.filter(r => r.severity === 'BAIXA').length;
        
        console.log('[SVG AUDITORIA] ==================== RELATÓRIO DE AUDITORIA ====================');
        console.log(`[SVG AUDITORIA] Total de problemas encontrados: ${this.auditResults.length}`);
        console.log(`[SVG AUDITORIA] Severidade ALTA: ${highSeverity} | MÉDIA: ${mediumSeverity} | BAIXA: ${lowSeverity}`);
        console.log('[SVG AUDITORIA] ============================================================');
        
        // Listar resumo dos problemas mais comuns
        const allIssues = this.auditResults.flatMap(r => r.issues);
        const issueCount = {};
        
        allIssues.forEach(issue => {
            issueCount[issue] = (issueCount[issue] || 0) + 1;
        });
        
        console.log('[SVG AUDITORIA] Problemas mais frequentes:');
        Object.entries(issueCount)
            .sort(([, a], [, b]) => b - a)
            .forEach(([issue, count]) => {
                console.log(`[SVG AUDITORIA] ${count}x - ${issue}`);
            });
    }
    
    // Método público para executar auditoria manual
    runManualAudit() {
        console.log('[SVG AUDITORIA] Executando auditoria manual...');
        this.performFullAudit();
    }
    
    // Método público para obter resultados da auditoria
    getAuditResults() {
        return {
            results: this.auditResults,
            summary: {
                total: this.auditResults.length,
                high: this.auditResults.filter(r => r.severity === 'ALTA').length,
                medium: this.auditResults.filter(r => r.severity === 'MÉDIA').length,
                low: this.auditResults.filter(r => r.severity === 'BAIXA').length
            },
            timestamp: new Date().toISOString()
        };
    }
}

// Inicializar sistema de auditoria SVG
window.svgAuditor = new SVGAccessibilityAuditor();

// Inicializar sistema de efeitos cyber quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cyberEffects = new CyberMenuEffects();
    });
} else {
    window.cyberEffects = new CyberMenuEffects();
}

