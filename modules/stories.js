const logger = require('../engine/logger');
const fs = require('fs').promises;
const path = require('path');

class StoriesModule {
    constructor(page) {
        this.page = page;
        this.rules = null;
        this.delays = null;
        this.viewedStories = new Set();
        this.loadConfiguration();
    }

    async loadConfiguration() {
        try {
                    this.rules = JSON.parse(await fs.readFile(path.join(__dirname, '../data/rules.json'), 'utf8'));
        this.delays = JSON.parse(await fs.readFile(path.join(__dirname, '../config/delays.json'), 'utf8'));
            logger.info('Configuração do módulo stories carregada');
        } catch (error) {
            logger.error('Erro ao carregar configuração do stories:', error);
        }
    }

    async executeStories(source = 'feed') {
        try {
            logger.info(`Iniciando módulo de stories - Fonte: ${source}`);

            if (source === 'feed') {
                return await this.viewFeedStories();
            } else if (source === 'hashtag') {
                return await this.viewHashtagStories();
            } else if (source === 'explore') {
                return await this.viewExploreStories();
            }

            return false;
        } catch (error) {
            logger.error('Erro no módulo de stories:', error);
            return false;
        }
    }

    async viewFeedStories() {
        try {
            logger.info('Navegando para o feed principal');

            // Navegar para o feed
            await this.page.goto('https://www.instagram.com/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Buscar stories disponíveis no topo
            const storyElements = await this.page.$$('div[role="button"] canvas, div[role="button"] img[data-testid="user-avatar"]');
            
            if (storyElements.length === 0) {
                logger.warn('Nenhum story encontrado no feed');
                return false;
            }

            logger.info(`Encontrados ${storyElements.length} stories no feed`);

            // Selecionar alguns stories aleatórios para visualizar
            const maxStories = Math.min(storyElements.length, 5); // Máximo 5 stories por sessão
            const selectedStories = this.shuffleArray([...storyElements]).slice(0, maxStories);

            let viewedCount = 0;

            for (const storyElement of selectedStories) {
                if (viewedCount >= maxStories) break;

                try {
                    // Clicar no story
                    await storyElement.click();
                    await this.page.waitForTimeout(2000);

                    // Visualizar o story completo
                    const viewed = await this.viewStorySequence();
                    
                    if (viewed) {
                        viewedCount++;
                        logger.info(`Story ${viewedCount}/${maxStories} visualizado`);
                    }

                    // Fechar stories
                    await this.closeStories();

                    // Delay entre stories
                    const delay = this.calculateDelay();
                    logger.info(`Aguardando ${delay}s antes do próximo story...`);
                    await this.page.waitForTimeout(delay * 1000);

                } catch (error) {
                    logger.error('Erro ao processar story:', error);
                    await this.closeStories();
                }
            }

            logger.info(`Stories visualizados: ${viewedCount}/${maxStories}`);
            return viewedCount > 0;

        } catch (error) {
            logger.error('Erro ao visualizar stories do feed:', error);
            return false;
        }
    }

    async viewStorySequence() {
        try {
            // Aguardar carregamento do story
            await this.page.waitForTimeout(2000);

            let storyCount = 0;
            const maxStoriesPerUser = 5; // Máximo 5 stories por usuário
            
            // Obter nome do usuário do story
            const username = await this.getUsernameFromStory();
            logger.info(`Visualizando stories de: ${username || 'usuário desconhecido'}`);

            while (storyCount < maxStoriesPerUser) {
                try {
                    // Verificar se ainda há story carregado
                    const storyContainer = await this.page.$('section[role="dialog"], div[role="dialog"]');
                    if (!storyContainer) {
                        logger.info('Sem mais stories para visualizar');
                        break;
                    }

                    // Simular visualização humana
                    await this.simulateHumanViewing();

                    // Verificar se há próximo story
                    const hasNext = await this.hasNextStory();
                    
                    if (!hasNext) {
                        logger.info('Último story do usuário');
                        break;
                    }

                    // Navegar para o próximo story
                    await this.goToNextStory();
                    
                    storyCount++;
                    
                    // Log da visualização
                    if (username) {
                        this.viewedStories.add(`${username}-${storyCount}`);
                    }

                    // Delay curto entre stories do mesmo usuário
                    const shortDelay = Math.floor(Math.random() * 3) + 1; // 1-3s
                    await this.page.waitForTimeout(shortDelay * 1000);

                } catch (error) {
                    logger.error('Erro durante sequência de story:', error);
                    break;
                }
            }

            if (storyCount > 0) {
                logger.logAction('story_view', 'success', { 
                    username,
                    storiesViewed: storyCount
                });
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Erro na sequência de stories:', error);
            return false;
        }
    }

    async simulateHumanViewing() {
        try {
            // Simular comportamento humano ao ver story
            
            // Tempo de visualização realista (3-8s)
            const viewingTime = Math.floor(Math.random() * 6) + 3; // 3-8s
            
            // Simular movimentos ocasionais do mouse (opcional)
            if (Math.random() > 0.7) {
                await this.page.mouse.move(
                    Math.floor(Math.random() * 400) + 200,
                    Math.floor(Math.random() * 400) + 200
                );
            }

            // Aguardar tempo de visualização
            await this.page.waitForTimeout(viewingTime * 1000);

            // Ocasionalmente pausar o story (como humano faria)
            if (Math.random() > 0.8) {
                await this.page.click('div[role="dialog"]'); // Clique para pausar
                await this.page.waitForTimeout(1000);
                await this.page.click('div[role="dialog"]'); // Clique para despausar
            }

        } catch (error) {
            logger.error('Erro na simulação de visualização:', error);
        }
    }

    async getUsernameFromStory() {
        try {
            // Buscar o nome do usuário no header do story
            const usernameElement = await this.page.$('header a[role="link"], header span');
            
            if (usernameElement) {
                const username = await this.page.evaluate(el => el.textContent, usernameElement);
                return username?.trim();
            }

            return null;
        } catch (error) {
            logger.error('Erro ao obter username do story:', error);
            return null;
        }
    }

    async hasNextStory() {
        try {
            // Verificar se há indicador de próximo story
            const nextButton = await this.page.$('button[aria-label*="Próximo"], button[aria-label*="Next"]');
            const nextIndicator = await this.page.$('div[role="button"][tabindex="0"]:last-child');
            
            return !!(nextButton || nextIndicator);
        } catch (error) {
            logger.error('Erro ao verificar próximo story:', error);
            return false;
        }
    }

    async goToNextStory() {
        try {
            // Clicar na metade direita da tela para ir ao próximo story
            const viewport = await this.page.viewport();
            const clickX = viewport.width * 0.8; // 80% da largura
            const clickY = viewport.height * 0.5; // 50% da altura
            
            await this.page.click(`body`, { 
                button: 'left',
                clickCount: 1,
                position: { x: clickX, y: clickY }
            });

            await this.page.waitForTimeout(1000);

        } catch (error) {
            logger.error('Erro ao navegar para próximo story:', error);
        }
    }

    async viewHashtagStories() {
        try {
            // Carregar hashtag aleatória
            const hashtagsData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/hashtags.json'), 'utf8'));
            const hashtags = hashtagsData.hashtags.filter(h => h.active);
            
            if (hashtags.length === 0) {
                logger.warn('Nenhuma hashtag ativa encontrada');
                return false;
            }

            const hashtag = hashtags[Math.floor(Math.random() * hashtags.length)].name;
            
            logger.info(`Buscando stories da hashtag: #${hashtag}`);

            // Navegar para a hashtag
            await this.page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Buscar stories da hashtag (se disponíveis)
            const hashtagStories = await this.page.$('div[role="button"] canvas');
            
            if (!hashtagStories) {
                logger.info(`Nenhum story encontrado para hashtag #${hashtag}`);
                return false;
            }

            // Clicar no story da hashtag
            await hashtagStories.click();
            await this.page.waitForTimeout(2000);

            // Visualizar stories da hashtag
            const viewed = await this.viewStorySequence();
            
            // Fechar stories
            await this.closeStories();

            if (viewed) {
                logger.logAction('hashtag_story_view', 'success', { hashtag });
            }

            return viewed;

        } catch (error) {
            logger.error('Erro ao visualizar stories de hashtag:', error);
            return false;
        }
    }

    async viewExploreStories() {
        try {
            logger.info('Navegando para página Explorar');

            // Navegar para explorar
            await this.page.goto('https://www.instagram.com/explore/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Buscar stories na página explorar
            const exploreStories = await this.page.$$('div[role="button"] canvas');
            
            if (exploreStories.length === 0) {
                logger.warn('Nenhum story encontrado na página explorar');
                return false;
            }

            // Selecionar um story aleatório
            const randomStory = exploreStories[Math.floor(Math.random() * Math.min(exploreStories.length, 3))];
            
            await randomStory.click();
            await this.page.waitForTimeout(2000);

            // Visualizar stories
            const viewed = await this.viewStorySequence();
            
            // Fechar stories
            await this.closeStories();

            if (viewed) {
                logger.logAction('explore_story_view', 'success', { source: 'explore' });
            }

            return viewed;

        } catch (error) {
            logger.error('Erro ao visualizar stories do explorar:', error);
            return false;
        }
    }

    async closeStories() {
        try {
            // Buscar botão de fechar stories (X)
            const closeButton = await this.page.$('button[aria-label="Fechar"], button[aria-label="Close"]');
            if (closeButton) {
                await closeButton.click();
                await this.page.waitForTimeout(1000);
                return;
            }

            // Tentar ESC
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(1000);

            // Última tentativa: clicar fora do story
            await this.page.click('body', { 
                position: { x: 50, y: 50 } // Canto superior esquerdo
            });
            await this.page.waitForTimeout(1000);

        } catch (error) {
            logger.error('Erro ao fechar stories:', error);
        }
    }

    calculateDelay() {
        // Delays específicos para stories (2-8s conforme especificação)
        const delayConfig = this.delays?.action_delays?.story || { min: 2, max: 8 };
        const baseDelay = Math.floor(Math.random() * (delayConfig.max - delayConfig.min + 1)) + delayConfig.min;
        
        // Adicionar variação se habilitada
        if (this.delays?.randomization?.enabled) {
            const variance = this.delays.randomization.variance_percentage / 100;
            const variation = baseDelay * variance * (Math.random() - 0.5) * 2;
            return Math.max(1, Math.floor(baseDelay + variation));
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
    getViewedStories() {
        return Array.from(this.viewedStories);
    }

    clearViewedStories() {
        this.viewedStories.clear();
        logger.info('Lista de stories visualizados limpa');
    }

    async getStoriesCount() {
        try {
            // Navegar para feed para contar stories disponíveis
            await this.page.goto('https://www.instagram.com/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            const storyElements = await this.page.$$('div[role="button"] canvas');
            return storyElements.length;
        } catch (error) {
            logger.error('Erro ao contar stories disponíveis:', error);
            return 0;
        }
    }

    // Funcionalidades avançadas
    async interactWithStory() {
        try {
            // Ocasionalmente interagir com story (like, resposta)
            if (Math.random() > 0.9) { // 10% de chance
                
                // Tentar curtir story
                const likeButton = await this.page.$('div[role="button"][tabindex="0"] svg[aria-label*="curtir"], div[role="button"][tabindex="0"] svg[aria-label*="like"]');
                
                if (likeButton) {
                    await likeButton.click();
                    logger.info('Story curtido');
                    
                    logger.logAction('story_like', 'success', {
                        username: await this.getUsernameFromStory()
                    });
                    
                    await this.page.waitForTimeout(1000);
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Erro ao interagir com story:', error);
            return false;
        }
    }
}

module.exports = { StoriesModule }; 