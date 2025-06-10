/**
 * InstaBot v1.0 - Gerenciador de Login Automático
 * ==============================================
 * Carrega Instagram, detecta login e redireciona automaticamente
 */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

const SESSION_PATH = path.join(__dirname, '..', 'auth', 'session.json');
let loginWin;
let mainWin;

/**
 * Cria janela de login do Instagram
 */
function createLoginWindow() {
    loginWin = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'InstaBot v1.0 - Login',
        webPreferences: {
            partition: 'persist:instaSession',
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#ffffff'
    });

    const ses = loginWin.webContents.session;

    // Carrega sessão anterior (se houver)
    if (fs.existsSync(SESSION_PATH)) {
        try {
            const sessionData = JSON.parse(fs.readFileSync(SESSION_PATH));
            console.log('Carregando sessão salva...');
            
            // Verificar se a sessão não é muito antiga (7 dias)
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - sessionData.timestamp > sevenDays) {
                console.log('Sessão expirada, removendo...');
                fs.unlinkSync(SESSION_PATH);
            } else {
                // Aplicar cookies salvos
                ses.cookies.flushStore();
                sessionData.cookies.forEach(async (cookie) => {
                    try {
                        await ses.cookies.set({
                            url: `https://${cookie.domain}`,
                            name: cookie.name,
                            value: cookie.value,
                            domain: cookie.domain,
                            path: cookie.path || '/',
                            secure: cookie.secure || false,
                            httpOnly: cookie.httpOnly || false,
                            expirationDate: cookie.expirationDate
                        });
                    } catch (error) {
                        console.warn('Erro ao aplicar cookie:', cookie.name);
                    }
                });
                console.log('Sessão aplicada com sucesso');
            }
        } catch (error) {
            console.error('Erro ao carregar sessão:', error);
        }
    }

    // Carrega o Instagram
    loginWin.loadURL('https://www.instagram.com/');

    // Mostrar janela quando carregar
    loginWin.once('ready-to-show', () => {
        loginWin.show();
        console.log('Instagram carregado - Aguardando login...');
    });

    // Detecta se login foi concluído
    loginWin.webContents.on('did-navigate', async (_, url) => {
        console.log('Navegação detectada:', url);
        
        // Se a URL for o feed, é porque o login foi bem-sucedido
        if ((url === 'https://www.instagram.com/' || url.startsWith('https://www.instagram.com/?')) 
            && !url.includes('accounts/login')) {
            
            console.log('Login detectado com sucesso!');
            
            try {
                // Salva cookies da sessão
                const cookies = await ses.cookies.get({ domain: '.instagram.com' });
                
                // Filtrar apenas cookies importantes
                const importantCookies = cookies.filter(cookie => {
                    const importantNames = ['sessionid', 'ds_user_id', 'csrftoken', 'rur', 'mid', 'ig_did', 'ig_nrcb'];
                    return importantNames.includes(cookie.name);
                });

                if (importantCookies.length > 0) {
                    const sessionData = {
                        cookies: importantCookies,
                        timestamp: Date.now(),
                        userAgent: loginWin.webContents.getUserAgent()
                    };

                    // Garantir que o diretório auth existe
                    const authDir = path.dirname(SESSION_PATH);
                    if (!fs.existsSync(authDir)) {
                        fs.mkdirSync(authDir, { recursive: true });
                    }

                    fs.writeFileSync(SESSION_PATH, JSON.stringify(sessionData, null, 2));
                    console.log('Sessão salva com sucesso:', SESSION_PATH);

                    // Espera 2 segundos e abre a interface principal
                    setTimeout(() => {
                        openMainWindow();
                        if (loginWin) {
                            loginWin.close();
                            loginWin = null;
                        }
                    }, 2000);
                } else {
                    console.log('Nenhum cookie importante encontrado');
                }
            } catch (error) {
                console.error('Erro ao salvar sessão:', error);
            }
        }
    });

    // Detectar erros de carregamento
    loginWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Erro ao carregar Instagram:', errorDescription);
    });

    // Fechar aplicação se janela de login for fechada
    loginWin.on('closed', () => {
        if (!mainWin) {
            app.quit();
        }
        loginWin = null;
    });
}

/**
 * Abre o painel principal com as funcionalidades do bot
 */
function openMainWindow() {
    console.log('Abrindo painel principal do InstaBot...');
    
    mainWin = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'InstaBot v1.0 - Painel Principal',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            webviewTag: true
        },
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#ffffff'
    });

    // Carregar painel principal
    const mainPath = path.join(__dirname, 'main.html');
    
    if (fs.existsSync(mainPath)) {
        mainWin.loadFile(mainPath);
    } else {
        // Fallback: criar HTML básico
        const basicHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>InstaBot v1.0 - Painel Principal</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    padding: 40px;
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                }
                h1 { margin-bottom: 20px; font-size: 2.5em; }
                p { margin-bottom: 10px; font-size: 1.2em; }
                .success { color: #4CAF50; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>InstaBot v1.0</h1>
                <p class="success">Login realizado com sucesso!</p>
                <p>Painel principal carregado</p>
                <p>Sessão salva automaticamente</p>
                <p>Próximo login será automático</p>
            </div>
        </body>
        </html>
        `;
        mainWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(basicHTML)}`);
    }

    // Mostrar quando pronto
    mainWin.once('ready-to-show', () => {
        mainWin.show();
        console.log('Painel principal do InstaBot carregado com sucesso!');
    });

    // Fechar aplicação quando janela principal for fechada
    mainWin.on('closed', () => {
        mainWin = null;
        app.quit();
    });
}

/**
 * Verificar se já existe sessão válida
 */
function hasValidSession() {
    if (!fs.existsSync(SESSION_PATH)) {
        return false;
    }

    try {
        const sessionData = JSON.parse(fs.readFileSync(SESSION_PATH));
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        return (Date.now() - sessionData.timestamp) < sevenDays;
    } catch (error) {
        return false;
    }
}

// Eventos do app
app.whenReady().then(() => {
    console.log('InstaBot v1.0 - Iniciando sistema de login automático...');
    
    if (hasValidSession()) {
        console.log('Sessão válida encontrada, abrindo painel principal...');
        openMainWindow();
    } else {
        console.log('Nenhuma sessão válida, abrindo tela de login...');
        createLoginWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        if (hasValidSession()) {
            openMainWindow();
        } else {
            createLoginWindow();
        }
    }
});

module.exports = {
    createLoginWindow,
    openMainWindow
}; 