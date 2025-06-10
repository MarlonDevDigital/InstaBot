/**
 * InstaBot v1.0 - Gerenciamento de Autenticação e Sessão
 * ======================================================
 * 
 * Sistema de login e controle de sessão do Instagram
 * Versão única e definitiva do projeto
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createLogger } = require('../engine/logger');

// Função auxiliar para verificar se arquivo existe
const pathExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

class AuthManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        
        // Usar userData path para executável empacotado
        const { app } = require('electron');
        const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '..');
        
        this.sessionFile = path.join(userDataPath, 'data', 'session.json');
        this.cookiesFile = path.join(userDataPath, 'data', 'cookies.json');
        this.logger = createLogger('auth');
        
        // Configurações do Instagram
        this.instagramUrls = {
            login: 'https://www.instagram.com/accounts/login/',
            home: 'https://www.instagram.com/',
            profile: 'https://www.instagram.com/accounts/edit/'
        };
    }

    /**
     * Inicializa o navegador (TEMPORARIAMENTE DESABILITADO - USA WEBVIEW)
     */
    async initBrowser() {
        try {
            this.logger.info('Sistema de navegador desabilitado - usando webview da interface');
            return true;
        } catch (error) {
            this.logger.error('Erro ao inicializar navegador:', error);
            return false;
        }
    }

    /**
     * Método de inicialização para compatibilidade
     */
    async initialize() {
        try {
            this.logger.info('AuthManager inicializado');
            return { success: true, message: 'AuthManager inicializado com sucesso' };
        } catch (error) {
            this.logger.error('Erro na inicialização:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Faz login no Instagram (USA WEBVIEW DA INTERFACE)
     */
    async login(credentials = null) {
        try {
            this.logger.info('Login deve ser feito através da interface webview');
            return { success: true, method: 'webview', message: 'Use a interface web para fazer login' };
        } catch (error) {
            this.logger.error('Erro durante login:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Realiza login automático (se credenciais fornecidas)
     */
    async performAutomaticLogin(credentials) {
        try {
            this.logger.info('Tentando login automático...');

            // Aguardar campos de login
            await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
            await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });

            // Preencher username
            await this.page.type('input[name="username"]', credentials.username, { delay: 100 });
            await this.randomDelay(1000, 2000);

            // Preencher password
            await this.page.type('input[name="password"]', credentials.password, { delay: 100 });
            await this.randomDelay(1000, 2000);

            // Clicar no botão de login
            await this.page.click('button[type="submit"]');

            // Aguardar redirecionamento ou erro
            await this.page.waitForNavigation({ 
                waitUntil: 'networkidle2',
                timeout: 15000 
            });

            // Verificar se login foi bem-sucedido
            if (await this.checkIfLoggedIn()) {
                await this.handlePostLoginPopups();
                await this.saveCookies();
                await this.saveSession(credentials.username);
                
                // Extrair dados do perfil após login bem-sucedido
                await this.extractProfileData(credentials.username);
                
                this.isLoggedIn = true;
                this.logger.info('Login automático realizado com sucesso');
                return { success: true, method: 'automatic' };
            } else {
                this.logger.error('Login automático falhou');
                return { success: false, error: 'Credenciais inválidas ou erro no login' };
            }

        } catch (error) {
            this.logger.error('Erro no login automático:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Aguarda login manual do usuário
     */
    async waitForManualLogin(timeout = 300000) { // 5 minutos
        try {
            this.logger.info('Aguardando login manual...');

            const startTime = Date.now();
            
            while (Date.now() - startTime < timeout) {
                // Verificar se usuário fez login
                if (await this.checkIfLoggedIn()) {
                    await this.handlePostLoginPopups();
                    await this.saveCookies();
                    
                    // Obter username da página atual
                    const currentUsername = await this.getCurrentUsername();
                    await this.saveSession(currentUsername);
                    
                    // Extrair dados do perfil após login bem-sucedido
                    await this.extractProfileData(currentUsername);
                    
                    this.isLoggedIn = true;
                    this.logger.info('Login manual realizado com sucesso');
                    return { success: true, method: 'manual' };
                }

                // Aguardar 2 segundos antes de verificar novamente
                await this.randomDelay(2000, 3000);
            }

            this.logger.error('Timeout no login manual');
            return { success: false, error: 'Timeout - usuário não fez login' };

        } catch (error) {
            this.logger.error('Erro no login manual:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica se usuário está logado
     */
    async checkIfLoggedIn() {
        try {
            const currentUrl = this.page.url();
            
            // Se não está na página de login, provavelmente está logado
            if (!currentUrl.includes('/accounts/login/')) {
                return true;
            }

            // Verificar se existe elemento que indica login
            const loggedInSelectors = [
                'nav[role="navigation"]',
                '[data-testid="user-avatar"]',
                'a[href="/direct/inbox/"]',
                'svg[aria-label="Home"]'
            ];

            for (const selector of loggedInSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    return true;
                } catch (e) {
                    // Continuar tentando outros seletores
                }
            }

            return false;

        } catch (error) {
            this.logger.error('Erro ao verificar login:', error);
            return false;
        }
    }

    /**
     * Lida com popups pós-login
     */
    async handlePostLoginPopups() {
        try {
            this.logger.info('Lidando com popups pós-login...');

            // Lista de seletores de popups comuns
            const popupSelectors = [
                'button:contains("Not Now")',
                'button:contains("Agora não")',
                'button[class*="sqdOP"]', // Botão "Not Now" genérico
                '[role="button"]:contains("Not Now")',
                '[role="button"]:contains("Agora não")'
            ];

            for (const selector of popupSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    await this.page.click(selector);
                    await this.randomDelay(1000, 2000);
                    this.logger.info('Popup fechado');
                } catch (e) {
                    // Popup não encontrado, continuar
                }
            }

        } catch (error) {
            this.logger.error('Erro ao lidar com popups:', error);
        }
    }

    /**
     * Salva cookies da sessão
     */
    async saveCookies() {
        try {
            const cookies = await this.page.cookies();
            await fs.writeFile(this.cookiesFile, JSON.stringify(cookies, null, 2));
            this.logger.info('Cookies salvos');
        } catch (error) {
            this.logger.error('Erro ao salvar cookies:', error);
        }
    }

    /**
     * Carrega cookies salvos
     */
    async loadCookies() {
        try {
            if (await pathExists(this.cookiesFile)) {
                const cookies = JSON.parse(await fs.readFile(this.cookiesFile, 'utf8'));
                await this.page.setCookie(...cookies);
                this.logger.info('Cookies carregados');
            }
        } catch (error) {
            this.logger.error('Erro ao carregar cookies:', error);
        }
    }

    /**
     * Salva informações da sessão
     */
    async saveSession(username = null) {
        try {
            const sessionData = {
                username: username,
                loginTime: new Date().toISOString(),
                isLoggedIn: true,
                userAgent: await this.page.evaluate(() => navigator.userAgent)
            };

            await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
            this.logger.info('Sessão salva');
        } catch (error) {
            this.logger.error('Erro ao salvar sessão:', error);
        }
    }

    /**
     * Obtém o username atual da página
     */
    async getCurrentUsername() {
        try {
            // Tentar extrair username da URL ou elementos da página
            const currentUrl = this.page.url();
            
            // Se estiver na página do perfil, extrair da URL
            const profileMatch = currentUrl.match(/instagram\.com\/([^\/\?]+)/);
            if (profileMatch && profileMatch[1] && !['accounts', 'explore', 'direct'].includes(profileMatch[1])) {
                return profileMatch[1];
            }

            // Tentar extrair de elementos da página
            const username = await this.page.evaluate(() => {
                // Procurar por link do perfil no menu
                const profileLinks = document.querySelectorAll('a[href*="/"]');
                for (const link of profileLinks) {
                    const href = link.getAttribute('href');
                    if (href && href.startsWith('/') && !href.includes('/') && href.length > 1) {
                        return href.substring(1);
                    }
                }
                
                // Procurar em meta tags
                const metaTags = document.querySelectorAll('meta[property="og:url"]');
                for (const meta of metaTags) {
                    const content = meta.getAttribute('content');
                    const match = content?.match(/instagram\.com\/([^\/\?]+)/);
                    if (match && match[1]) {
                        return match[1];
                    }
                }
                
                return null;
            });

            return username || 'unknown_user';
        } catch (error) {
            this.logger.error('Erro ao obter username:', error);
            return 'unknown_user';
        }
    }

    /**
     * Extrai dados do perfil do usuário
     */
    async extractProfileData(username) {
        try {
            this.logger.info(`Extraindo dados do perfil: @${username}`);

            // Navegar para a página do perfil
            const profileUrl = `https://www.instagram.com/${username}/`;
            await this.page.goto(profileUrl, { 
                waitUntil: 'networkidle2',
                timeout: 15000 
            });

            // Aguardar elementos do perfil carregarem
            await this.page.waitForSelector('header', { timeout: 10000 });
            await this.randomDelay(2000, 3000);

            // Extrair dados do perfil
            const profileData = await this.page.evaluate(() => {
                const data = {
                    username: '',
                    display_name: '',
                    profile_pic: '',
                    followers: 0,
                    following: 0,
                    posts: 0,
                    bio: '',
                    is_private: false,
                    is_verified: false,
                    last_updated: new Date().toISOString()
                };

                // Extrair username e display name
                const usernameElement = document.querySelector('header h2, header h1, [data-testid="user-name"]');
                if (usernameElement) {
                    data.username = usernameElement.textContent.trim();
                    data.display_name = usernameElement.textContent.trim();
                }

                // Procurar por nome completo
                const fullNameElement = document.querySelector('header section div div span, header section h1 + span');
                if (fullNameElement && fullNameElement.textContent.trim()) {
                    data.display_name = fullNameElement.textContent.trim();
                }

                // Extrair foto de perfil
                const profilePicElement = document.querySelector('header img, img[data-testid="user-avatar"]');
                if (profilePicElement) {
                    data.profile_pic = profilePicElement.src;
                }

                // Extrair estatísticas (posts, seguidores, seguindo)
                const statsElements = document.querySelectorAll('header section ul li, header section div > div');
                const statsTexts = [];
                
                statsElements.forEach(element => {
                    const text = element.textContent.trim();
                    if (text && /\d/.test(text)) {
                        statsTexts.push(text);
                    }
                });

                // Processar números das estatísticas
                const processNumber = (text) => {
                    if (!text) return 0;
                    
                    const cleanText = text.replace(/[^0-9.,kmKM]/g, '');
                    let number = 0;
                    
                    if (cleanText.toLowerCase().includes('k')) {
                        number = parseFloat(cleanText) * 1000;
                    } else if (cleanText.toLowerCase().includes('m')) {
                        number = parseFloat(cleanText) * 1000000;
                    } else {
                        number = parseInt(cleanText.replace(/[.,]/g, ''));
                    }
                    
                    return isNaN(number) ? 0 : Math.floor(number);
                };

                // Ordem típica: posts, seguidores, seguindo
                if (statsTexts.length >= 3) {
                    data.posts = processNumber(statsTexts[0]);
                    data.followers = processNumber(statsTexts[1]);
                    data.following = processNumber(statsTexts[2]);
                }

                // Extrair bio
                const bioElement = document.querySelector('header section div div span:not([data-testid]), header section div span');
                if (bioElement && !bioElement.textContent.includes('@')) {
                    data.bio = bioElement.textContent.trim();
                }

                // Verificar se é conta privada
                const privateIndicator = document.querySelector('[data-testid="private-account-indicator"], svg[aria-label*="private"]');
                data.is_private = !!privateIndicator;

                // Verificar se é verificado
                const verifiedIndicator = document.querySelector('[data-testid="verified-badge"], svg[aria-label*="verified"]');
                data.is_verified = !!verifiedIndicator;

                return data;
            });

            // Salvar dados em arquivo JSON
            const profilePath = path.join(__dirname, '..', 'data', 'profile.json');
            await fs.writeFile(profilePath, JSON.stringify(profileData, null, 2));

            this.logger.info(`Dados do perfil extraídos e salvos:`, {
                username: profileData.username,
                followers: profileData.followers,
                following: profileData.following,
                posts: profileData.posts
            });

            return profileData;

        } catch (error) {
            this.logger.error('Erro ao extrair dados do perfil:', error);
            
            // Salvar dados básicos mesmo em caso de erro
            const basicData = {
                username: username || 'unknown_user',
                display_name: username || 'Usuário Instagram',
                profile_pic: '',
                followers: 0,
                following: 0,
                posts: 0,
                bio: '',
                is_private: false,
                is_verified: false,
                last_updated: new Date().toISOString()
            };

            try {
                const profilePath = path.join(__dirname, '..', 'data', 'profile.json');
                await fs.writeFile(profilePath, JSON.stringify(basicData, null, 2));
            } catch (saveError) {
                this.logger.error('Erro ao salvar dados básicos:', saveError);
            }

            return basicData;
        }
    }

    /**
     * Faz logout
     */
    async logout() {
        try {
            this.logger.info('Fazendo logout...');

            if (this.page) {
                // Ir para página de configurações
                await this.page.goto(this.instagramUrls.profile);
                
                // Procurar botão de logout
                const logoutSelectors = [
                    'button:contains("Log Out")',
                    'button:contains("Sair")',
                    '[role="button"]:contains("Log Out")',
                    '[role="button"]:contains("Sair")'
                ];

                for (const selector of logoutSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 3000 });
                        await this.page.click(selector);
                        break;
                    } catch (e) {
                        // Continuar tentando
                    }
                }
            }

            // Limpar dados locais
            await this.clearSession();
            this.isLoggedIn = false;

            this.logger.info('Logout realizado');
            return { success: true };

        } catch (error) {
            this.logger.error('Erro no logout:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Limpa dados da sessão
     */
    async clearSession() {
        try {
            // Remover arquivos de sessão
            if (await pathExists(this.sessionFile)) {
                await fs.unlink(this.sessionFile);
            }
            
            if (await pathExists(this.cookiesFile)) {
                await fs.unlink(this.cookiesFile);
            }

            this.logger.info('Sessão limpa');
        } catch (error) {
            this.logger.error('Erro ao limpar sessão:', error);
        }
    }

    /**
     * Fecha o navegador
     */
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                this.logger.info('Navegador fechado');
            }
        } catch (error) {
            this.logger.error('Erro ao fechar navegador:', error);
        }
    }

    /**
     * Delay aleatório para simular comportamento humano
     */
    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Obtém status da autenticação
     */
    getStatus() {
        return {
            isLoggedIn: this.isLoggedIn,
            hasBrowser: !!this.browser,
            hasPage: !!this.page
        };
    }
}

module.exports = { AuthManager }; 