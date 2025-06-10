/**
 * InstaBot v1.0 - Módulo de Likes
 * ===============================
 * 
 * Responsável por curtir posts no Instagram
 * Versão única e definitiva do projeto
 */

const { createLogger } = require('../engine/logger');

class LikeModule {
    constructor(authManager) {
        this.authManager = authManager;
        this.logger = createLogger('like');
        this.isRunning = false;
        this.stats = {
            likes_today: 0,
            total_likes: 0,
            errors: 0
        };
    }

    /**
     * Executa ação de curtir posts
     */
    async execute(params = {}) {
        try {
            if (!this.authManager.isLoggedIn) {
                throw new Error('Usuário não está logado');
            }

            this.logger.info('Iniciando módulo de likes...');
            
            const hashtag = params.hashtag || 'photography';
            const maxLikes = params.maxLikes || 10;
            
            return await this.likePostsByHashtag(hashtag, maxLikes);

        } catch (error) {
            this.logger.error('Erro no módulo de likes:', error);
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    /**
     * Curte posts de uma hashtag específica
     */
    async likePostsByHashtag(hashtag, maxLikes) {
        try {
            this.logger.info(`Curtindo posts da hashtag: #${hashtag}`);
            
            const page = this.authManager.page;
            
            // Ir para página da hashtag
            const hashtagUrl = `https://www.instagram.com/explore/tags/${hashtag}/`;
            await page.goto(hashtagUrl, { waitUntil: 'networkidle2' });
            
            // Aguardar carregamento dos posts
            await page.waitForSelector('article', { timeout: 10000 });
            
            // Obter links dos posts
            const postLinks = await this.getPostLinks(page, maxLikes);
            
            let likesCount = 0;
            
            for (const postLink of postLinks) {
                try {
                    const liked = await this.likePost(page, postLink);
                    
                    if (liked) {
                        likesCount++;
                        this.stats.likes_today++;
                        this.stats.total_likes++;
                        
                        this.logger.logAction('LIKE', {
                            hashtag: hashtag,
                            post_url: postLink,
                            likes_count: likesCount
                        });
                    }
                    
                    // Delay entre likes
                    await this.randomDelay(2000, 5000);
                    
                } catch (error) {
                    this.logger.error(`Erro ao curtir post ${postLink}:`, error);
                    this.stats.errors++;
                }
            }
            
            this.logger.info(`Módulo de likes concluído: ${likesCount} likes`);
            
            return {
                success: true,
                likes_count: likesCount,
                hashtag: hashtag,
                stats: this.stats
            };

        } catch (error) {
            this.logger.error('Erro ao curtir posts por hashtag:', error);
            throw error;
        }
    }

    /**
     * Obtém links dos posts da página
     */
    async getPostLinks(page, maxPosts) {
        try {
            const links = await page.evaluate((max) => {
                const articles = document.querySelectorAll('article a[href*="/p/"]');
                const postLinks = [];
                
                for (let i = 0; i < Math.min(articles.length, max); i++) {
                    const href = articles[i].getAttribute('href');
                    if (href && !postLinks.includes(href)) {
                        postLinks.push(`https://www.instagram.com${href}`);
                    }
                }
                
                return postLinks;
            }, maxPosts);
            
            this.logger.info(`Encontrados ${links.length} posts para curtir`);
            return links;

        } catch (error) {
            this.logger.error('Erro ao obter links dos posts:', error);
            return [];
        }
    }

    /**
     * Curte um post específico
     */
    async likePost(page, postUrl) {
        try {
            // Ir para o post
            await page.goto(postUrl, { waitUntil: 'networkidle2' });
            
            // Aguardar carregamento do botão de like
            await page.waitForSelector('svg[aria-label*="Like"], svg[aria-label*="Curtir"]', { timeout: 5000 });
            
            // Verificar se já foi curtido
            const alreadyLiked = await page.$('svg[aria-label*="Unlike"], svg[aria-label*="Descurtir"]');
            
            if (alreadyLiked) {
                this.logger.info('Post já foi curtido anteriormente');
                return false;
            }
            
            // Clicar no botão de like
            const likeButton = await page.$('svg[aria-label*="Like"], svg[aria-label*="Curtir"]');
            
            if (likeButton) {
                await likeButton.click();
                
                // Aguardar confirmação visual
                await page.waitForSelector('svg[aria-label*="Unlike"], svg[aria-label*="Descurtir"]', { timeout: 3000 });
                
                this.logger.info('Post curtido com sucesso');
                return true;
            } else {
                this.logger.warn('Botão de like não encontrado');
                return false;
            }

        } catch (error) {
            this.logger.error('Erro ao curtir post:', error);
            return false;
        }
    }

    /**
     * Curte posts do feed principal
     */
    async likeFeedPosts(maxLikes = 5) {
        try {
            this.logger.info('Curtindo posts do feed...');
            
            const page = this.authManager.page;
            
            // Ir para página inicial
            await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
            
            let likesCount = 0;
            
            for (let i = 0; i < maxLikes; i++) {
                try {
                    // Procurar botão de like no feed
                    const likeButtons = await page.$$('svg[aria-label*="Like"], svg[aria-label*="Curtir"]');
                    
                    if (likeButtons.length > i) {
                        await likeButtons[i].click();
                        likesCount++;
                        
                        this.logger.logAction('FEED_LIKE', {
                            post_index: i,
                            likes_count: likesCount
                        });
                        
                        // Delay entre likes
                        await this.randomDelay(3000, 6000);
                        
                        // Scroll para carregar mais posts
                        await page.evaluate(() => {
                            window.scrollBy(0, 600);
                        });
                        
                        await this.randomDelay(2000, 4000);
                    }
                    
                } catch (error) {
                    this.logger.error(`Erro ao curtir post ${i} do feed:`, error);
                }
            }
            
            this.logger.info(`Feed likes concluído: ${likesCount} likes`);
            
            return {
                success: true,
                likes_count: likesCount,
                type: 'feed'
            };

        } catch (error) {
            this.logger.error('Erro ao curtir posts do feed:', error);
            throw error;
        }
    }

    /**
     * Verifica se pode continuar curtindo (limites)
     */
    canContinueLiking() {
        const dailyLimit = 100; // Limite diário de likes
        
        if (this.stats.likes_today >= dailyLimit) {
            this.logger.warn('Limite diário de likes atingido');
            return false;
        }
        
        return true;
    }

    /**
     * Delay aleatório para simular comportamento humano
     */
    async randomDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Obtém estatísticas do módulo
     */
    getStats() {
        return {
            ...this.stats,
            module: 'like',
            last_updated: new Date().toISOString()
        };
    }

    /**
     * Reseta estatísticas diárias
     */
    resetDailyStats() {
        this.stats.likes_today = 0;
        this.logger.info('Estatísticas diárias resetadas');
    }

    /**
     * Para o módulo
     */
    stop() {
        this.isRunning = false;
        this.logger.info('Módulo de likes parado');
    }
}

module.exports = { LikeModule }; 