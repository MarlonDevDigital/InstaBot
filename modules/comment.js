const logger = require('../engine/logger');
const fs = require('fs').promises;
const path = require('path');

class CommentModule {
    constructor(page) {
        this.page = page;
        this.rules = null;
        this.delays = null;
        this.comments = [];
        this.commentedPosts = new Set();
        this.loadConfiguration();
    }

    async loadConfiguration() {
        try {
                    this.rules = JSON.parse(await fs.readFile(path.join(__dirname, '../data/rules.json'), 'utf8'));
        this.delays = JSON.parse(await fs.readFile(path.join(__dirname, '../config/delays.json'), 'utf8'));
            
            // Carregar comentários pré-definidos
        const commentsData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/comments.json'), 'utf8'));
            this.comments = commentsData.default_comments || [];
            
            logger.info(`Carregados ${this.comments.length} comentários padrão`);
        } catch (error) {
            logger.error('Erro ao carregar configuração de comentários:', error);
        }
    }

    async executeComment(source = 'hashtag', target = null) {
        try {
            logger.info(`Iniciando módulo de comentários - Fonte: ${source}`);

            if (this.comments.length === 0) {
                logger.warn('Nenhum comentário padrão disponível');
                return false;
            }

            if (source === 'hashtag') {
                return await this.commentOnHashtagPosts(target);
            } else if (source === 'profile') {
                return await this.commentOnProfilePosts(target);
            } else if (source === 'explore') {
                return await this.commentOnExplorePosts();
            }

            return false;
        } catch (error) {
            logger.error('Erro no módulo de comentários:', error);
            return false;
        }
    }

    async commentOnHashtagPosts(hashtag = null) {
        try {
            // Carregar hashtags se não fornecida
            if (!hashtag) {
                const hashtagsData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/hashtags.json'), 'utf8'));
                const hashtags = hashtagsData.hashtags.filter(h => h.active);
                
                if (hashtags.length === 0) {
                    logger.warn('Nenhuma hashtag ativa encontrada');
                    return false;
                }

                hashtag = hashtags[Math.floor(Math.random() * hashtags.length)].name;
            }

            logger.info(`Navegando para hashtag: #${hashtag}`);

            // Navegar para a hashtag
            await this.page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Buscar posts mais recentes
            const posts = await this.page.$$('article a[href*="/p/"]');
            
            if (posts.length === 0) {
                logger.warn(`Nenhum post encontrado para hashtag #${hashtag}`);
                return false;
            }

            logger.info(`Encontrados ${posts.length} posts na hashtag #${hashtag}`);

            // Selecionar posts aleatórios para comentar
            const maxPosts = Math.min(posts.length, 5); // Máximo 5 comentários por hashtag
            const selectedPosts = this.shuffleArray([...posts]).slice(0, maxPosts);

            let commentCount = 0;
            const maxComments = Math.min(maxPosts, 3); // Limite conservador

            for (const post of selectedPosts) {
                if (commentCount >= maxComments) break;

                try {
                    // Clicar no post
                    await post.click();
                    await this.page.waitForTimeout(2000);

                    // Verificar se já comentou neste post
                    const postUrl = await this.page.url();
                    if (this.commentedPosts.has(postUrl)) {
                        logger.info('Post já comentado anteriormente');
                        await this.closePost();
                        continue;
                    }

                    // Tentar comentar no post
                    const commented = await this.commentOnPost();
                    
                    if (commented) {
                        commentCount++;
                        this.commentedPosts.add(postUrl);
                        logger.info(`Comentário ${commentCount}/${maxComments} realizado`);
                    }

                    // Fechar post
                    await this.closePost();

                    // Delay entre comentários
                    const delay = this.calculateDelay();
                    logger.info(`Aguardando ${delay}s antes do próximo comentário...`);
                    await this.page.waitForTimeout(delay * 1000);

                } catch (error) {
                    logger.error('Erro ao processar post para comentário:', error);
                    await this.closePost();
                }
            }

            logger.info(`Comentários completados: ${commentCount}/${maxComments} na hashtag #${hashtag}`);
            return commentCount > 0;

        } catch (error) {
            logger.error('Erro ao comentar em hashtag:', error);
            return false;
        }
    }

    async commentOnPost() {
        try {
            // Aguardar carregamento do post
            await this.page.waitForSelector('article', { timeout: 10000 });

            // Verificar se comentários estão habilitados
            const commentsDisabled = await this.page.$('span:has-text("Os comentários foram desativados"), span:has-text("Comments on this post have been limited")');
            if (commentsDisabled) {
                logger.info('Comentários desabilitados neste post');
                return false;
            }

            // Buscar campo de comentário
            const commentField = await this.page.$('textarea[aria-label*="comentário"], textarea[aria-label*="comment"], textarea[placeholder*="comentário"], textarea[placeholder*="comment"]');
            
            if (!commentField) {
                logger.warn('Campo de comentário não encontrado');
                return false;
            }

            // Verificar se campo está visível
            const isVisible = await commentField.isVisible();
            if (!isVisible) {
                logger.warn('Campo de comentário não visível');
                return false;
            }

            // Selecionar comentário aleatório
            const randomComment = this.getRandomComment();
            if (!randomComment) {
                logger.warn('Nenhum comentário disponível');
                return false;
            }

            logger.info(`Comentando: "${randomComment}"`);

            // Clicar no campo de comentário
            await commentField.click();
            await this.page.waitForTimeout(1000);

            // Limpar campo e digitar comentário
            await commentField.fill('');
            await this.typeHumanLike(commentField, randomComment);

            // Aguardar um pouco antes de enviar
            await this.page.waitForTimeout(2000);

            // Buscar botão de enviar
            const submitButton = await this.page.$('button[type="submit"], button:has-text("Publicar"), button:has-text("Post")');
            
            if (!submitButton) {
                logger.warn('Botão de enviar comentário não encontrado');
                return false;
            }

            // Enviar comentário
            await submitButton.click();
            logger.info('Comentário enviado');

            // Aguardar confirmação
            await this.page.waitForTimeout(3000);

            // Verificar se comentário foi aceito
            const success = await this.verifyCommentSuccess(randomComment);

            if (success) {
                logger.logAction('comment', 'success', { 
                    comment: randomComment,
                    postUrl: await this.page.url()
                });
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Erro ao comentar no post:', error);
            return false;
        }
    }

    async commentOnProfilePosts(username) {
        try {
            logger.info(`Navegando para perfil: @${username}`);

            // Navegar para o perfil
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Verificar se perfil existe e não é privado
            const profileExists = await this.page.$('main section');
            if (!profileExists) {
                logger.warn(`Perfil @${username} não encontrado`);
                return false;
            }

            const privateIndicator = await this.page.$('h2:has-text("Esta conta é privada"), h2:has-text("This Account is Private")');
            if (privateIndicator) {
                logger.warn(`Perfil @${username} é privado`);
                return false;
            }

            // Buscar posts do perfil
            const posts = await this.page.$$('article a[href*="/p/"]');
            
            if (posts.length === 0) {
                logger.warn(`Nenhum post encontrado no perfil @${username}`);
                return false;
            }

            // Selecionar um post aleatório
            const randomPost = posts[Math.floor(Math.random() * Math.min(posts.length, 3))];
            
            await randomPost.click();
            await this.page.waitForTimeout(2000);

            // Comentar no post
            const commented = await this.commentOnPost();
            
            // Fechar post
            await this.closePost();

            if (commented) {
                logger.logAction('comment', 'success', { 
                    username,
                    source: 'profile'
                });
            }

            return commented;

        } catch (error) {
            logger.error(`Erro ao comentar no perfil @${username}:`, error);
            return false;
        }
    }

    async commentOnExplorePosts() {
        try {
            logger.info('Navegando para página Explorar');

            // Navegar para explorar
            await this.page.goto('https://www.instagram.com/explore/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Buscar posts na página explorar
            const explorePosts = await this.page.$$('article a[href*="/p/"]');
            
            if (explorePosts.length === 0) {
                logger.warn('Nenhum post encontrado na página explorar');
                return false;
            }

            // Selecionar um post aleatório
            const randomPost = explorePosts[Math.floor(Math.random() * Math.min(explorePosts.length, 10))];
            
            await randomPost.click();
            await this.page.waitForTimeout(2000);

            // Comentar no post
            const commented = await this.commentOnPost();
            
            // Fechar post
            await this.closePost();

            if (commented) {
                logger.logAction('comment', 'success', { source: 'explore' });
            }

            return commented;

        } catch (error) {
            logger.error('Erro ao comentar na página explorar:', error);
            return false;
        }
    }

    getRandomComment() {
        if (this.comments.length === 0) return null;
        
        // Filtrar comentários ativos
        const activeComments = this.comments.filter(c => c.active !== false);
        
        if (activeComments.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * activeComments.length);
        return activeComments[randomIndex].text || activeComments[randomIndex];
    }

    async typeHumanLike(element, text) {
        // Simular digitação humana com delays variáveis
        for (const char of text) {
            await element.type(char);
            const delay = Math.floor(Math.random() * 150) + 50; // 50-200ms entre caracteres
            await this.page.waitForTimeout(delay);
        }
    }

    async verifyCommentSuccess(commentText) {
        try {
            // Aguardar um pouco para o comentário aparecer
            await this.page.waitForTimeout(2000);

            // Procurar pelo comentário enviado na lista de comentários
            const commentFound = await this.page.evaluate((text) => {
                const comments = document.querySelectorAll('span');
                return Array.from(comments).some(span => 
                    span.textContent.includes(text.substring(0, 20)) // Verificar primeiros 20 caracteres
                );
            }, commentText);

            return commentFound;

        } catch (error) {
            logger.error('Erro ao verificar sucesso do comentário:', error);
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
            logger.error('Erro ao fechar post:', error);
        }
    }

    calculateDelay() {
        // Delays específicos para comentários (5-15s conforme especificação)
        const delayConfig = this.delays?.action_delays?.comment || { min: 5, max: 15 };
        const baseDelay = Math.floor(Math.random() * (delayConfig.max - delayConfig.min + 1)) + delayConfig.min;
        
        // Adicionar variação se habilitada
        if (this.delays?.randomization?.enabled) {
            const variance = this.delays.randomization.variance_percentage / 100;
            const variation = baseDelay * variance * (Math.random() - 0.5) * 2;
            return Math.max(3, Math.floor(baseDelay + variation));
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
    getCommentedPosts() {
        return Array.from(this.commentedPosts);
    }

    clearCommentedPosts() {
        this.commentedPosts.clear();
        logger.info('Lista de posts comentados limpa');
    }

    getAvailableComments() {
        return [...this.comments];
    }

    addComment(comment) {
        this.comments.push({
            text: comment,
            active: true,
            created: Date.now()
        });
        logger.info(`Novo comentário adicionado: "${comment}"`);
    }

    async saveComments() {
        try {
            const filePath = path.join(__dirname, '../data/comments.json');
            const currentData = JSON.parse(await fs.readFile(filePath, 'utf8'));
            
            currentData.default_comments = this.comments;
            
            await fs.writeFile(filePath, JSON.stringify(currentData, null, 2));
            logger.info('Comentários salvos com sucesso');
        } catch (error) {
            logger.error('Erro ao salvar comentários:', error);
        }
    }
}

module.exports = { CommentModule }; 