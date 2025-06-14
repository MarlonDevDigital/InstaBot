const { createLogger } = require('../engine/logger');
const fs = require('fs').promises;
const path = require('path');

class FollowModule {
    constructor(page) {
        this.page = page;
        this.logger = createLogger('follow');
        this.rules = null;
        this.delays = null;
        this.followedUsers = new Set();
        this.loadConfiguration();
    }

    async loadConfiguration() {
        try {
            const rulesPath = path.join(__dirname, '../data/rules.json');
            const delaysPath = path.join(__dirname, '../config/delays.json');
            
            this.rules = JSON.parse(await fs.readFile(rulesPath, 'utf8'));
            this.delays = JSON.parse(await fs.readFile(delaysPath, 'utf8'));
        } catch (error) {
            this.logger.error('Erro ao carregar configuração do follow:', error);
        }
    }

    async executeFollow(source = 'hashtag', target = null) {
        try {
            this.logger.info(`Iniciando módulo de follow - Fonte: ${source}`);

            if (source === 'hashtag') {
                return await this.followFromHashtag(target);
            } else if (source === 'profile') {
                return await this.followFromProfile(target);
            } else if (source === 'explore') {
                return await this.followFromExplore();
            }

            return false;
        } catch (error) {
            this.logger.error('Erro no módulo de follow:', error);
            return false;
        }
    }

    async followFromHashtag(hashtag = null) {
        try {
            // Carregar hashtags se não fornecida
            if (!hashtag) {
                const hashtagsPath = path.join(__dirname, '../data/hashtags.json');
                const hashtagsData = JSON.parse(await fs.readFile(hashtagsPath, 'utf8'));
                const hashtags = hashtagsData.hashtags.filter(h => h.active);
                
                if (hashtags.length === 0) {
                    this.logger.warn('Nenhuma hashtag ativa encontrada');
                    return false;
                }

                hashtag = hashtags[Math.floor(Math.random() * hashtags.length)].name;
            }

            this.logger.info(`Navegando para hashtag: #${hashtag}`);

            // Navegar para a hashtag
            await this.page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Aguardar carregamento
            await this.page.waitForTimeout(3000);

            // Buscar posts mais recentes
            const posts = await this.page.$$('article a[href*="/p/"]');
            
            if (posts.length === 0) {
                this.logger.warn(`Nenhum post encontrado para hashtag #${hashtag}`);
                return false;
            }

            this.logger.info(`Encontrados ${posts.length} posts na hashtag #${hashtag}`);

            // Selecionar posts aleatórios para follow
            const maxPosts = Math.min(posts.length, this.rules.max_posts_per_hashtag || 10);
            const selectedPosts = this.shuffleArray([...posts]).slice(0, maxPosts);

            let followCount = 0;
            let followLimit = Math.min(maxPosts, 5); // Máximo 5 follows por hashtag

            for (const post of selectedPosts) {
                if (followCount >= followLimit) break;

                try {
                    // Clicar no post
                    await post.click();
                    await this.page.waitForTimeout(2000);

                    // Tentar seguir o usuário do post
                    const followed = await this.followUserFromPost();
                    
                    if (followed) {
                        followCount++;
                        this.logger.info(`Follow ${followCount}/${followLimit} realizado`);
                    }

                    // Fechar post
                    await this.closePost();

                    // Delay entre posts
                    const delay = this.calculateDelay();
                    this.logger.info(`Aguardando ${delay}s antes do próximo follow...`);
                    await this.page.waitForTimeout(delay * 1000);

                } catch (error) {
                    this.logger.error('Erro ao processar post para follow:', error);
                    await this.closePost();
                }
            }

            this.logger.info(`Follows completados: ${followCount}/${followLimit} na hashtag #${hashtag}`);
            return followCount > 0;

        } catch (error) {
            this.logger.error('Erro no follow por hashtag:', error);
            return false;
        }
    }

    async followUserFromPost() {
        try {
            // Aguardar carregamento do post
            await this.page.waitForSelector('article', { timeout: 10000 });

            // Buscar o nome do usuário
            const usernameElement = await this.page.$('article header a[role="link"]');
            if (!usernameElement) {
                this.logger.warn('Nome do usuário não encontrado no post');
                return false;
            }

            const username = await this.page.evaluate(el => el.textContent, usernameElement);
            
            // Verificar se já segue este usuário
            if (this.followedUsers.has(username)) {
                this.logger.info(`Usuário @${username} já foi seguido anteriormente`);
                return false;
            }

            // Buscar botão de seguir
            const followButton = await this.page.$('article button:has-text("Seguir"), article button:has-text("Follow")');
            
            if (!followButton) {
                // Talvez já esteja seguindo
                const followingButton = await this.page.$('article button:has-text("Seguindo"), article button:has-text("Following")');
                if (followingButton) {
                    this.logger.info(`Já segue @${username}`);
                    return false;
                }
                
                this.logger.warn(`Botão de seguir não encontrado para @${username}`);
                return false;
            }

            // Verificar se o botão está visível e clicável
            const isVisible = await followButton.isVisible();
            if (!isVisible) {
                this.logger.warn(`Botão de seguir não visível para @${username}`);
                return false;
            }

            // Clicar no botão seguir
            await followButton.click();
            this.logger.info(`🫂 Seguindo usuário: @${username}`);

            // Aguardar resposta
            await this.page.waitForTimeout(2000);

            // Verificar se o follow foi bem-sucedido
            const success = await this.verifyFollowSuccess();

            if (success) {
                this.followedUsers.add(username);
                this.logger.logAction('follow', 'success', { username, source: 'hashtag' });
                return true;
            } else {
                this.logger.warn(`Follow não confirmado para @${username}`);
                return false;
            }

        } catch (error) {
            this.logger.error('Erro ao seguir usuário:', error);
            return false;
        }
    }

    async followFromProfile(username) {
        try {
            this.logger.info(`Navegando para perfil: @${username}`);

            // Navegar para o perfil
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Aguardar carregamento
            await this.page.waitForTimeout(3000);

            // Verificar se perfil existe
            const profileExists = await this.page.$('main section');
            if (!profileExists) {
                this.logger.warn(`Perfil @${username} não encontrado ou privado`);
                return false;
            }

            // Buscar botão de seguir
            const followButton = await this.page.$('button:has-text("Seguir"), button:has-text("Follow")');
            
            if (!followButton) {
                const followingButton = await this.page.$('button:has-text("Seguindo"), button:has-text("Following")');
                if (followingButton) {
                    this.logger.info(`Já segue @${username}`);
                    return false;
                }
                
                this.logger.warn(`Perfil @${username} pode ser privado ou botão não encontrado`);
                return false;
            }

            // Clicar no botão seguir
            await followButton.click();
            this.logger.info(`🫂 Seguindo usuário: @${username}`);

            // Aguardar resposta
            await this.page.waitForTimeout(3000);

            // Verificar sucesso
            const success = await this.verifyFollowSuccess();

            if (success) {
                this.followedUsers.add(username);
                this.logger.logAction('follow', 'success', { username, source: 'profile' });
                return true;
            }

            return false;

        } catch (error) {
            this.logger.error(`Erro ao seguir perfil @${username}:`, error);
            return false;
        }
    }

    async followFromExplore() {
        try {
            this.logger.info('Navegando para página Explorar');

            // Navegar para explorar
            await this.page.goto('https://www.instagram.com/explore/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Buscar posts na página explorar
            const explorePosts = await this.page.$$('article a[href*="/p/"]');
            
            if (explorePosts.length === 0) {
                this.logger.warn('Nenhum post encontrado na página explorar');
                return false;
            }

            // Selecionar um post aleatório
            const randomPost = explorePosts[Math.floor(Math.random() * Math.min(explorePosts.length, 10))];
            
            await randomPost.click();
            await this.page.waitForTimeout(2000);

            // Tentar seguir usuário do post
            const followed = await this.followUserFromPost();
            
            // Fechar post
            await this.closePost();

            if (followed) {
                this.logger.logAction('follow', 'success', { source: 'explore' });
            }

            return followed;

        } catch (error) {
            this.logger.error('Erro no follow pela página explorar:', error);
            return false;
        }
    }

    async verifyFollowSuccess() {
        try {
            // Aguardar mudança no botão
            await this.page.waitForTimeout(2000);

            // Verificar se botão mudou para "Seguindo" ou "Solicitado"
            const followingButton = await this.page.$('button:has-text("Seguindo"), button:has-text("Following")');
            const requestedButton = await this.page.$('button:has-text("Solicitado"), button:has-text("Requested")');

            return !!(followingButton || requestedButton);
        } catch (error) {
            this.logger.error('Erro ao verificar sucesso do follow:', error);
            return false;
        }
    }

    async closePost() {
        try {
            // Buscar botão de fechar (X)
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
            this.logger.error('Erro ao fechar post:', error);
        }
    }

    calculateDelay() {
        const delayConfig = this.delays?.action_delays?.follow || { min: 5, max: 15 };
        const baseDelay = Math.floor(Math.random() * (delayConfig.max - delayConfig.min + 1)) + delayConfig.min;
        
        // Adicionar variação se habilitada
        if (this.delays?.randomization?.enabled) {
            const variance = this.delays.randomization.variance_percentage / 100;
            const variation = baseDelay * variance * (Math.random() - 0.5) * 2;
            return Math.max(2, Math.floor(baseDelay + variation));
        }
        
        return baseDelay;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Métodos para controle externo
    getFollowedUsers() {
        return Array.from(this.followedUsers);
    }

    clearFollowedUsers() {
        this.followedUsers.clear();
        this.logger.info('Lista de usuários seguidos limpa');
    }

    async getFollowingCount() {
        try {
            // Navegar para perfil próprio para ver quantos está seguindo
            await this.page.goto('https://www.instagram.com/accounts/edit/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Esta seria uma implementação mais complexa
            // Por enquanto retornamos o tamanho do Set local
            return this.followedUsers.size;
        } catch (error) {
            this.logger.error('Erro ao obter contagem de follows:', error);
            return 0;
        }
    }
}

module.exports = { FollowModule };
