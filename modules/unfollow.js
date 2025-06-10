const logger = require('../engine/logger');
const fs = require('fs').promises;
const path = require('path');

// Função auxiliar para verificar se arquivo existe
const pathExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

class UnfollowModule {
    constructor(page) {
        this.page = page;
        this.rules = null;
        this.delays = null;
        this.followingList = [];
        this.unfollowedUsers = new Set();
        this.loadConfiguration();
    }

    async loadConfiguration() {
        try {
                    this.rules = JSON.parse(await fs.readFile(path.join(__dirname, '../data/rules.json'), 'utf8'));
        this.delays = JSON.parse(await fs.readFile(path.join(__dirname, '../config/delays.json'), 'utf8'));
        } catch (error) {
            logger.error('Erro ao carregar configuração do unfollow:', error);
        }
    }

    async executeUnfollow(strategy = 'non_followers') {
        try {
            logger.info(`Iniciando módulo de unfollow - Estratégia: ${strategy}`);

            // Carregar lista de seguindo
            await this.loadFollowingList();

            if (this.followingList.length === 0) {
                logger.warn('Nenhum usuário na lista de seguindo');
                return false;
            }

            let unfollowCount = 0;
            const maxUnfollows = Math.min(10, 10); // Máximo 10 por sessão (limite será verificado via config/limits.json)

            if (strategy === 'non_followers') {
                unfollowCount = await this.unfollowNonFollowers(maxUnfollows);
            } else if (strategy === 'oldest') {
                unfollowCount = await this.unfollowOldest(maxUnfollows);
            } else if (strategy === 'inactive') {
                unfollowCount = await this.unfollowInactive(maxUnfollows);
            }

            logger.info(`Unfollows completados: ${unfollowCount}/${maxUnfollows}`);
            return unfollowCount > 0;

        } catch (error) {
            logger.error('Erro no módulo de unfollow:', error);
            return false;
        }
    }

    async loadFollowingList() {
        try {
            logger.info('Carregando lista de usuários seguindo...');

            // Navegar para próprio perfil
            await this.page.goto('https://www.instagram.com/accounts/edit/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(2000);

            // Clicar no link do perfil
            const profileLink = await this.page.$('a[href*="instagram.com/"]');
            if (profileLink) {
                const profileUrl = await this.page.evaluate(el => el.href, profileLink);
                await this.page.goto(profileUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
            } else {
                // Fallback: tentar navegar diretamente
                await this.page.goto('https://www.instagram.com/accounts/activity/', {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
            }

            await this.page.waitForTimeout(3000);

            // Buscar link "seguindo"
            const followingLink = await this.page.$('a[href*="/following/"]');
            if (!followingLink) {
                logger.warn('Link "seguindo" não encontrado');
                return;
            }

            // Clicar no link seguindo
            await followingLink.click();
            await this.page.waitForTimeout(3000);

            // Aguardar carregamento da lista
            await this.page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

            // Scroll para carregar mais usuários
            await this.scrollFollowingList();

            // Extrair lista de usuários
            const users = await this.page.evaluate(() => {
                const userElements = document.querySelectorAll('div[role="dialog"] a[href*="/"]');
                return Array.from(userElements)
                    .map(el => {
                        const href = el.getAttribute('href');
                        const username = href.replace('/', '').replace('/', '');
                        const imgElement = el.querySelector('img');
                        const fullName = imgElement ? imgElement.getAttribute('alt') : '';
                        
                        return {
                            username: username,
                            fullName: fullName,
                            profileUrl: href,
                            followedDate: Date.now() // Seria melhor ter data real
                        };
                    })
                    .filter(user => user.username && user.username.length > 0)
                    .slice(0, 200); // Limitar para não sobrecarregar
            });

            this.followingList = users;
            logger.info(`Carregados ${this.followingList.length} usuários da lista de seguindo`);

            // Fechar modal
            await this.closeModal();

        } catch (error) {
            logger.error('Erro ao carregar lista de seguindo:', error);
        }
    }

    async scrollFollowingList() {
        try {
            // Scroll na lista para carregar mais usuários
            let previousCount = 0;
            let currentCount = 0;
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                // Scroll para baixo
                await this.page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (dialog) {
                        const scrollableDiv = dialog.querySelector('div[style*="overflow"]');
                        if (scrollableDiv) {
                            scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
                        }
                    }
                });

                await this.page.waitForTimeout(2000);

                // Contar usuários carregados
                currentCount = await this.page.evaluate(() => {
                    return document.querySelectorAll('div[role="dialog"] a[href*="/"]').length;
                });

                if (currentCount === previousCount) {
                    break; // Não carregou mais usuários
                }

                previousCount = currentCount;
                attempts++;
            }

            logger.info(`📜 Scroll completado, ${currentCount} usuários carregados`);
        } catch (error) {
            logger.error('Erro durante scroll da lista:', error);
        }
    }

    async unfollowNonFollowers(maxUnfollows) {
        let unfollowCount = 0;

        logger.info('Verificando usuários que não seguem de volta...');

        for (const user of this.followingList) {
            if (unfollowCount >= maxUnfollows) break;

            try {
                // Verificar se usuário segue de volta
                const followsBack = await this.checkIfFollowsBack(user.username);

                if (!followsBack) {
                    logger.info(`${user.username} não segue de volta, removendo...`);
                    
                    const success = await this.unfollowUser(user.username);
                    
                    if (success) {
                        unfollowCount++;
                        this.unfollowedUsers.add(user.username);
                        
                        // Delay longo entre unfollows (10-21s)
                        const delay = this.calculateDelay();
                        logger.info(`Aguardando ${delay}s antes do próximo unfollow...`);
                        await this.page.waitForTimeout(delay * 1000);
                    }
                } else {
                    logger.info(`${user.username} segue de volta, mantendo`);
                }

            } catch (error) {
                logger.error(`Erro ao processar @${user.username}:`, error);
            }
        }

        return unfollowCount;
    }

    async unfollowOldest(maxUnfollows) {
        let unfollowCount = 0;

        // Ordenar por data mais antiga (simulada)
        const sortedUsers = [...this.followingList].sort((a, b) => a.followedDate - b.followedDate);

        logger.info('Removendo usuários mais antigos...');

        for (const user of sortedUsers) {
            if (unfollowCount >= maxUnfollows) break;

            try {
                const success = await this.unfollowUser(user.username);
                
                if (success) {
                    unfollowCount++;
                    this.unfollowedUsers.add(user.username);
                    
                    const delay = this.calculateDelay();
                    logger.info(`Aguardando ${delay}s antes do próximo unfollow...`);
                    await this.page.waitForTimeout(delay * 1000);
                }

            } catch (error) {
                logger.error(`Erro ao remover @${user.username}:`, error);
            }
        }

        return unfollowCount;
    }

    async unfollowInactive(maxUnfollows) {
        let unfollowCount = 0;

        logger.info('Verificando usuários inativos...');

        for (const user of this.followingList) {
            if (unfollowCount >= maxUnfollows) break;

            try {
                // Verificar se usuário está inativo
                const isInactive = await this.checkIfUserInactive(user.username);

                if (isInactive) {
                    logger.info(`${user.username} parece inativo, removendo...`);
                    
                    const success = await this.unfollowUser(user.username);
                    
                    if (success) {
                        unfollowCount++;
                        this.unfollowedUsers.add(user.username);
                        
                        const delay = this.calculateDelay();
                        logger.info(`Aguardando ${delay}s antes do próximo unfollow...`);
                        await this.page.waitForTimeout(delay * 1000);
                    }
                }

            } catch (error) {
                logger.error(`Erro ao verificar @${user.username}:`, error);
            }
        }

        return unfollowCount;
    }

    async checkIfFollowsBack(username) {
        try {
            // Navegar para perfil do usuário
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(2000);

            // Verificar se existe o botão "Seguir" ou "Seguindo"
            const followButton = await this.page.$('button:has-text("Seguir"), button:has-text("Follow")');
            const followingButton = await this.page.$('button:has-text("Seguindo"), button:has-text("Following")');

            // Se tem botão "Seguindo", significa que seguimos ele
            if (followingButton) {
                // Verificar se ele nos segue de volta procurando por indicador
                const followsBackIndicator = await this.page.$('span:has-text("Segue você"), span:has-text("Follows you")');
                return !!followsBackIndicator;
            }

            return false;

        } catch (error) {
            logger.error(`Erro ao verificar se @${username} segue de volta:`, error);
            return true; // Em caso de erro, assumir que segue para não remover
        }
    }

    async checkIfUserInactive(username) {
        try {
            // Navegar para perfil do usuário
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(2000);

            // Verificar se perfil existe e não é privado
            const privateIndicator = await this.page.$('h2:has-text("Esta conta é privada"), h2:has-text("This Account is Private")');
            if (privateIndicator) {
                return false; // Não considerar contas privadas como inativas
            }

            // Buscar posts recentes
            const posts = await this.page.$$('article a[href*="/p/"]');
            
            if (posts.length === 0) {
                return true; // Sem posts = inativo
            }

            // Verificar data do último post (implementação simplificada)
            // Uma implementação completa verificaria timestamps reais
            return posts.length < 3; // Menos de 3 posts = possivelmente inativo

        } catch (error) {
            logger.error(`Erro ao verificar inatividade de @${username}:`, error);
            return false; // Em caso de erro, não considerar inativo
        }
    }

    async unfollowUser(username) {
        try {
            // Navegar para perfil do usuário
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(2000);

            // Buscar botão "Seguindo"
            const followingButton = await this.page.$('button:has-text("Seguindo"), button:has-text("Following")');
            
            if (!followingButton) {
                logger.warn(`Botão "Seguindo" não encontrado para @${username}`);
                return false;
            }

            // Clicar no botão "Seguindo"
            await followingButton.click();
            await this.page.waitForTimeout(1000);

            // Buscar botão "Deixar de seguir" no modal
            const unfollowButton = await this.page.$('button:has-text("Deixar de seguir"), button:has-text("Unfollow")');
            
            if (!unfollowButton) {
                logger.warn(`Botão "Deixar de seguir" não encontrado para @${username}`);
                return false;
            }

            // Confirmar unfollow
            await unfollowButton.click();
            await this.page.waitForTimeout(2000);

            // Verificar se unfollow foi bem-sucedido
            const success = await this.verifyUnfollowSuccess();

            if (success) {
                logger.info(`Deixou de seguir: @${username}`);
                logger.logAction('unfollow', 'success', { username });
                return true;
            }

            return false;

        } catch (error) {
            logger.error(`Erro ao deixar de seguir @${username}:`, error);
            return false;
        }
    }

    async verifyUnfollowSuccess() {
        try {
            // Aguardar mudança no botão
            await this.page.waitForTimeout(2000);

            // Verificar se botão mudou para "Seguir"
            const followButton = await this.page.$('button:has-text("Seguir"), button:has-text("Follow")');
            return !!followButton;

        } catch (error) {
            logger.error('Erro ao verificar sucesso do unfollow:', error);
            return false;
        }
    }

    async closeModal() {
        try {
            // Buscar botão de fechar modal
            const closeButton = await this.page.$('button[aria-label="Fechar"], button[aria-label="Close"]');
            if (closeButton) {
                await closeButton.click();
                await this.page.waitForTimeout(1000);
            } else {
                // Tentar ESC
                await this.page.keyboard.press('Escape');
                await this.page.waitForTimeout(1000);
            }
        } catch (error) {
            logger.error('Erro ao fechar modal:', error);
        }
    }

    calculateDelay() {
        // Delays específicos para unfollow (10-21s conforme especificação)
        const delayConfig = this.delays?.action_delays?.unfollow || { min: 10, max: 21 };
        const baseDelay = Math.floor(Math.random() * (delayConfig.max - delayConfig.min + 1)) + delayConfig.min;
        
        // Adicionar variação se habilitada
        if (this.delays?.randomization?.enabled) {
            const variance = this.delays.randomization.variance_percentage / 100;
            const variation = baseDelay * variance * (Math.random() - 0.5) * 2;
            return Math.max(5, Math.floor(baseDelay + variation));
        }
        
        return baseDelay;
    }

    // Métodos para controle externo
    getUnfollowedUsers() {
        return Array.from(this.unfollowedUsers);
    }

    getFollowingList() {
        return [...this.followingList];
    }

    clearUnfollowedUsers() {
        this.unfollowedUsers.clear();
        logger.info('Lista de usuários removidos limpa');
    }

    async getFollowingCount() {
        return this.followingList.length;
    }

    // Salvar/carregar lista de seguindo para cache
    async saveFollowingList() {
        try {
            const filePath = path.join(__dirname, '../data/following_cache.json');
            await fs.writeFile(filePath, JSON.stringify({
                timestamp: Date.now(),
                users: this.followingList
            }, null, 2));
        } catch (error) {
            logger.error('Erro ao salvar cache da lista de seguindo:', error);
        }
    }

    async loadFollowingListFromCache() {
        try {
            const filePath = path.join(__dirname, '../data/following_cache.json');
            
            if (await pathExists(filePath)) {
                const cache = JSON.parse(await fs.readFile(filePath, 'utf8'));
                
                // Verificar se cache não está muito antigo (24h)
                const isValid = (Date.now() - cache.timestamp) < (24 * 60 * 60 * 1000);
                
                if (isValid && cache.users) {
                    this.followingList = cache.users;
                    logger.info(`Carregada lista de seguindo do cache (${this.followingList.length} usuários)`);
                    return true;
                }
            }
        } catch (error) {
            logger.error('Erro ao carregar cache da lista de seguindo:', error);
        }
        
        return false;
    }
}

module.exports = { UnfollowModule }; 