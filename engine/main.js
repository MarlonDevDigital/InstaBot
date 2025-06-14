/**
 * InstaBot v1.0 - Motor Principal
 * ===============================
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { AuthManager } = require('../auth/session');
const { LikeModule } = require('../modules/like');
const { FollowModule } = require('../modules/follow');
const { UnfollowModule } = require('../modules/unfollow');
const { CommentModule } = require('../modules/comment');
const { StoriesModule } = require('../modules/stories');
const { DirectModule } = require('../modules/direct');

class BotEngine {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.browser = null;
        this.page = null;
        this.sessionManager = null;
        this.currentAction = null;
        this.stats = {
            session: { likes: 0, follows: 0, comments: 0, unfollows: 0, dms: 0, stories: 0, errors: 0 },
            daily: { likes: 0, follows: 0, comments: 0, unfollows: 0, dms: 0, stories: 0 },
            total: { likes: 0, follows: 0, comments: 0, unfollows: 0, dms: 0, stories: 0 }
        };
        this.rules = null;
        this.delays = null;
        this.loadConfiguration();
                    logger.info('BotEngine inicializado');
    }

    async loadConfiguration() {
        try {
            const limitsPath = path.join(__dirname, '../config/limits.json');
            const delaysPath = path.join(__dirname, '../config/delays.json');
            const rulesPath = path.join(__dirname, '../data/rules.json');
            
            this.limits = JSON.parse(await fs.readFile(limitsPath, 'utf8'));
            this.delays = JSON.parse(await fs.readFile(delaysPath, 'utf8'));
            this.rules = JSON.parse(await fs.readFile(rulesPath, 'utf8'));
            
            logger.info('Configurações do motor carregadas');
        } catch (error) {
            logger.error('Erro ao carregar configurações do motor:', error);
        }
    }

    async start(config = {}) {
        try {
            if (this.isRunning) {
                logger.warn('Bot já está em execução');
                return { success: false, message: 'Bot já está em execução' };
            }

            this.isRunning = true;
            logger.info('Iniciando BotEngine...');

            // Inicializar sessão
            this.sessionManager = new AuthManager();
            const sessionResult = await this.sessionManager.initialize();

            if (!sessionResult.success) {
                logger.error('Erro ao inicializar sessão:', sessionResult.message);
                this.isRunning = false;
                return { success: false, message: 'Erro na sessão: ' + sessionResult.message };
            }

            this.browser = this.sessionManager.browser;
            this.page = this.sessionManager.page;

            // Verificar login
            const loginStatus = await this.sessionManager.checkLogin();
            if (!loginStatus.success) {
                logger.error('Usuário não está logado');
                this.isRunning = false;
                return { success: false, message: 'Usuário não está logado' };
            }

            logger.info('BotEngine iniciado com sucesso');
            return { success: true, message: 'Bot iniciado com sucesso' };

        } catch (error) {
            logger.error('Erro ao iniciar BotEngine:', error);
            this.isRunning = false;
            return { success: false, message: 'Erro interno: ' + error.message };
        }
    }

    async stop() {
        try {
            if (!this.isRunning) {
                logger.warn('Bot não está em execução');
                return { success: false, message: 'Bot não está em execução' };
            }

            this.isRunning = false;
            this.isPaused = false;
            this.currentAction = null;

            logger.info('Parando BotEngine...');

            // Fechar sessão
            if (this.sessionManager) {
                await this.sessionManager.close();
                this.sessionManager = null;
                this.browser = null;
                this.page = null;
            }

            // Salvar estatísticas finais
            await this.saveStats();

            logger.info('BotEngine parado com sucesso');
            return { success: true, message: 'Bot parado com sucesso' };

        } catch (error) {
            logger.error('Erro ao parar BotEngine:', error);
            return { success: false, message: 'Erro ao parar: ' + error.message };
        }
    }

    async pause() {
        if (!this.isRunning) {
            return { success: false, message: 'Bot não está em execução' };
        }

        this.isPaused = true;
        logger.info('Bot pausado');
        return { success: true, message: 'Bot pausado' };
    }

    async resume() {
        if (!this.isRunning) {
            return { success: false, message: 'Bot não está em execução' };
        }

        this.isPaused = false;
        logger.info('Bot retomado');
        return { success: true, message: 'Bot retomado' };
    }

    async executeLike(hashtag = null) {
        if (!this.checkRunningState()) return false;

        try {
            this.currentAction = 'like';
            const likeModule = new LikeModule(this.page);
            const result = await likeModule.executeLike(hashtag);
            
            if (result) {
                this.stats.session.likes++;
                this.stats.daily.likes++;
                await this.updateStats();
            }

            this.currentAction = null;
            return result;
        } catch (error) {
            this.stats.session.errors++;
            logger.error('Erro ao executar módulo de like:', error);
            this.currentAction = null;
            return false;
        }
    }

    async executeFollow(source = 'hashtag', target = null) {
        if (!this.checkRunningState()) return false;

        try {
            this.currentAction = 'follow';
            const followModule = new FollowModule(this.page);
            const result = await followModule.executeFollow(source, target);
            
            if (result) {
                this.stats.session.follows++;
                this.stats.daily.follows++;
                await this.updateStats();
            }

            this.currentAction = null;
            return result;
        } catch (error) {
            this.stats.session.errors++;
            logger.error('Erro ao executar módulo de follow:', error);
            this.currentAction = null;
            return false;
        }
    }

    async executeUnfollow(strategy = 'non_followers') {
        if (!this.checkRunningState()) return false;

        try {
            this.currentAction = 'unfollow';
            const unfollowModule = new UnfollowModule(this.page);
            const result = await unfollowModule.executeUnfollow(strategy);
            
            if (result) {
                this.stats.session.unfollows++;
                this.stats.daily.unfollows++;
                await this.updateStats();
            }

            this.currentAction = null;
            return result;
        } catch (error) {
            this.stats.session.errors++;
            logger.error('Erro ao executar módulo de unfollow:', error);
            this.currentAction = null;
            return false;
        }
    }

    async executeComment(source = 'hashtag', target = null) {
        if (!this.checkRunningState()) return false;

        try {
            this.currentAction = 'comment';
            const commentModule = new CommentModule(this.page);
            const result = await commentModule.executeComment(source, target);
            
            if (result) {
                this.stats.session.comments++;
                this.stats.daily.comments++;
                await this.updateStats();
            }

            this.currentAction = null;
            return result;
        } catch (error) {
            this.stats.session.errors++;
            logger.error('Erro ao executar módulo de comment:', error);
            this.currentAction = null;
            return false;
        }
    }

    async executeStories(source = 'feed') {
        if (!this.checkRunningState()) return false;

        try {
            this.currentAction = 'stories';
            const storiesModule = new StoriesModule(this.page);
            const result = await storiesModule.executeStories(source);
            
            if (result) {
                this.stats.session.stories++;
                this.stats.daily.stories++;
                await this.updateStats();
            }

            this.currentAction = null;
            return result;
        } catch (error) {
            this.stats.session.errors++;
            logger.error('Erro ao executar módulo de stories:', error);
            this.currentAction = null;
            return false;
        }
    }

    async executeDirect(target = null, source = 'hashtag') {
        if (!this.checkRunningState()) return false;

        try {
            this.currentAction = 'direct';
            const directModule = new DirectModule(this.page);
            const result = await directModule.executeDirect(target, source);
            
            if (result) {
                this.stats.session.dms++;
                this.stats.daily.dms++;
                await this.updateStats();
            }

            this.currentAction = null;
            return result;
        } catch (error) {
            this.stats.session.errors++;
            logger.error('Erro ao executar módulo de direct:', error);
            this.currentAction = null;
            return false;
        }
    }

    checkRunningState() {
        if (!this.isRunning) {
            logger.warn('Bot não está em execução');
            return false;
        }

        if (this.isPaused) {
            logger.warn('Bot está pausado');
            return false;
        }

        if (!this.page) {
            logger.error('Página não inicializada');
            return false;
        }

        return true;
    }

    async checkDailyLimits() {
        if (!this.rules) return false;

        return {
            likes: this.stats.daily.likes >= this.limits.limits.likes_per_day,
            follows: this.stats.daily.follows >= this.limits.limits.follows_per_day,
            comments: this.stats.daily.comments >= this.limits.limits.comments_per_day,
            unfollows: this.stats.daily.unfollows >= this.limits.limits.unfollows_per_day,
            stories: this.stats.daily.stories >= this.limits.limits.stories_per_day,
            dms: this.stats.daily.dms >= this.limits.limits.dm_per_execution
        };
    }

    async updateStats() {
        try {
            // Atualizar totais
            this.stats.total.likes = (this.stats.total.likes || 0) + 1;
            this.stats.total.follows = (this.stats.total.follows || 0) + (this.stats.session.follows - (this.stats.session.follows - 1));
            this.stats.total.comments = (this.stats.total.comments || 0) + (this.stats.session.comments - (this.stats.session.comments - 1));
            this.stats.total.unfollows = (this.stats.total.unfollows || 0) + (this.stats.session.unfollows - (this.stats.session.unfollows - 1));
            this.stats.total.stories = (this.stats.total.stories || 0) + (this.stats.session.stories - (this.stats.session.stories - 1));
            this.stats.total.dms = (this.stats.total.dms || 0) + (this.stats.session.dms - (this.stats.session.dms - 1));

            // Salvar estatísticas
            await this.saveStats();
        } catch (error) {
            logger.error('Erro ao atualizar estatísticas:', error);
        }
    }

    async saveStats() {
        try {
            const statsPath = path.join(__dirname, '../data/stats.json');
            await fs.writeFile(statsPath, JSON.stringify(this.stats, null, 2), 'utf8');
        } catch (error) {
            logger.error('Erro ao salvar estatísticas:', error);
        }
    }

    async loadStats() {
        try {
            const statsPath = path.join(__dirname, '../data/stats.json');
            const fsSync = require('fs');
            
            if (fsSync.existsSync(statsPath)) {
                const savedStats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
                this.stats = { ...this.stats, ...savedStats };
            }
        } catch (error) {
            logger.error('Erro ao carregar estatísticas:', error);
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentAction: this.currentAction,
            stats: this.stats,
            browser: !!this.browser,
            page: !!this.page,
            sessionManager: !!this.sessionManager
        };
    }

    async getStats() {
        return this.stats;
    }

    async resetDailyStats() {
        this.stats.daily = { likes: 0, follows: 0, comments: 0, unfollows: 0, dms: 0, stories: 0 };
        await this.saveStats();
        logger.info('Estatísticas diárias resetadas');
    }

    async resetSessionStats() {
        this.stats.session = { likes: 0, follows: 0, comments: 0, unfollows: 0, dms: 0, stories: 0, errors: 0 };
        await this.saveStats();
        logger.info('Estatísticas de sessão resetadas');
    }

    // Métodos auxiliares para interface
    async takeScreenshot() {
        if (!this.page) return null;

        try {
            const screenshot = await this.page.screenshot({ 
                type: 'png',
                fullPage: false
            });
            return screenshot;
        } catch (error) {
            logger.error('Erro ao capturar screenshot:', error);
            return null;
        }
    }

    async getCurrentUrl() {
        if (!this.page) return null;

        try {
            return await this.page.url();
        } catch (error) {
            logger.error('Erro ao obter URL atual:', error);
            return null;
        }
    }

    async navigateToInstagram() {
        if (!this.page) return false;

        try {
            await this.page.goto('https://www.instagram.com/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            return true;
        } catch (error) {
            logger.error('Erro ao navegar para Instagram:', error);
            return false;
        }
    }
}

module.exports = { BotEngine };
