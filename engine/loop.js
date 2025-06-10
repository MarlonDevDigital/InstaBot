const { BotEngine } = require('./main');
const { createLogger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

class BotLoop {
    constructor() {
        this.botEngine = new BotEngine();
        this.isRunning = false;
        this.currentCycle = null;
        this.cycleStartTime = null;
        this.logger = createLogger('loop');
        this.dailyStats = {
            likes: 0,
            follows: 0,
            unfollows: 0,
            comments: 0,
            dms: 0,
            stories: 0,
            errors: 0
        };
        this.rules = null;
        this.delays = null;
        this.loadConfiguration();
    }

    async loadConfiguration() {
        try {
            // Carregar configurações de limites, delays e regras
            const limitsPath = path.join(__dirname, '../config/limits.json');
            const delaysPath = path.join(__dirname, '../config/delays.json');
            const rulesPath = path.join(__dirname, '../data/rules.json');
            
            this.limits = JSON.parse(await fs.readFile(limitsPath, 'utf8'));
            this.delays = JSON.parse(await fs.readFile(delaysPath, 'utf8'));
            this.rules = JSON.parse(await fs.readFile(rulesPath, 'utf8'));
            
            this.logger.info('Configurações carregadas com sucesso');
        } catch (error) {
            this.logger.error('Erro ao carregar configurações:', error);
            throw error;
        }
    }

    async startLoop() {
        if (this.isRunning) {
            this.logger.warn('Loop já está em execução');
            return;
        }

        this.isRunning = true;
        this.cycleStartTime = new Date();
        
        this.logger.info('Iniciando ciclo principal do bot');
        this.logger.info(`Configurações: Likes: ${this.limits.limits.likes_per_day}, Follows: ${this.limits.limits.follows_per_day}, Comments: ${this.limits.limits.comments_per_day}`);

        try {
            await this.executeCycle();
        } catch (error) {
            this.logger.error('Erro no ciclo principal:', error);
            await this.handleError(error);
        }
    }

    async executeCycle() {
        while (this.isRunning) {
            try {
                // Verificar se já atingiu os limites diários
                if (this.checkDailyLimits()) {
                    this.logger.info('Limites diários atingidos. Pausando até amanhã...');
                    await this.pauseUntilTomorrow();
                    continue;
                }

                // Determinar próxima ação
                const nextAction = this.determineNextAction();
                
                if (!nextAction) {
                    this.logger.info('Nenhuma ação disponível. Pausando ciclo...');
                    await this.pauseBetweenCycles();
                    continue;
                }

                // Executar ação
                await this.executeAction(nextAction);

                // Delay entre ações
                const delay = this.calculateDelay('between_actions');
                this.logger.info(`Aguardando ${delay}s antes da próxima ação...`);
                await this.sleep(delay * 1000);

            } catch (error) {
                this.logger.error('Erro durante execução do ciclo:', error);
                await this.handleError(error);
            }
        }
    }

    determineNextAction() {
        const actions = [];

        // Verificar quais ações ainda podem ser executadas hoje
        if (this.dailyStats.likes < this.limits.limits.likes_per_day) {
            actions.push({ type: 'like', priority: 1 });
        }

        if (this.dailyStats.follows < this.limits.limits.follows_per_day) {
            actions.push({ type: 'follow', priority: 2 });
        }

        if (this.dailyStats.comments < this.limits.limits.comments_per_day) {
            actions.push({ type: 'comment', priority: 3 });
        }

        if (this.dailyStats.unfollows < this.limits.limits.unfollows_per_day) {
            actions.push({ type: 'unfollow', priority: 4 });
        }

        if (this.dailyStats.stories < this.limits.limits.stories_per_day) {
            actions.push({ type: 'stories', priority: 5 });
        }

        if (this.dailyStats.dms < this.limits.limits.dm_per_execution) {
            actions.push({ type: 'direct', priority: 6 });
        }

        if (actions.length === 0) return null;

        // Selecionar ação baseada em prioridade e randomização
        const weighted = actions.filter(a => Math.random() > 0.3);
        const selected = weighted.length > 0 ? weighted : actions;
        
        return selected.sort((a, b) => a.priority - b.priority)[0];
    }

    async executeAction(action) {
        this.logger.info(`Executando ação: ${action.type}`);

        try {
            let result = false;

            switch (action.type) {
                case 'like':
                    result = await this.botEngine.executeLike();
                    if (result) this.dailyStats.likes++;
                    break;

                case 'follow':
                    result = await this.botEngine.executeFollow();
                    if (result) this.dailyStats.follows++;
                    break;

                case 'unfollow':
                    result = await this.botEngine.executeUnfollow();
                    if (result) this.dailyStats.unfollows++;
                    break;

                case 'comment':
                    result = await this.botEngine.executeComment();
                    if (result) this.dailyStats.comments++;
                    break;

                case 'stories':
                    result = await this.botEngine.executeStories();
                    if (result) this.dailyStats.stories++;
                    break;

                case 'direct':
                    result = await this.botEngine.executeDirect();
                    if (result) this.dailyStats.dms++;
                    break;

                default:
                    this.logger.warn(`Ação desconhecida: ${action.type}`);
                    return;
            }

            // Log da ação
            this.logger.logAction(action.type, result ? 'success' : 'failed', {
                dailyStats: this.dailyStats
            });

            // Atualizar estatísticas
            await this.updateStats();

        } catch (error) {
            this.dailyStats.errors++;
            this.logger.error(`Erro ao executar ${action.type}:`, error);
            throw error;
        }
    }

    checkDailyLimits() {
        return (
            this.dailyStats.likes >= this.limits.limits.likes_per_day &&
            this.dailyStats.follows >= this.limits.limits.follows_per_day &&
            this.dailyStats.comments >= this.limits.limits.comments_per_day &&
            this.dailyStats.unfollows >= this.limits.limits.unfollows_per_day &&
            this.dailyStats.stories >= this.limits.limits.stories_per_day &&
            this.dailyStats.dms >= this.limits.limits.dm_per_execution
        );
    }

    calculateDelay(type) {
        const delayConfig = this.delays.cycle_delays[type] || this.delays.action_delays[type];
        
        if (!delayConfig) {
            return Math.floor(Math.random() * (21 - 2 + 1)) + 2; // Default 2-21s
        }

        let min, max;
        
        if (delayConfig.min !== undefined) {
            min = delayConfig.min;
            max = delayConfig.max;
        } else if (delayConfig.seconds !== undefined) {
            return delayConfig.seconds;
        } else if (delayConfig.minutes !== undefined) {
            return delayConfig.minutes * 60;
        } else if (delayConfig.hours !== undefined) {
            return delayConfig.hours * 3600;
        }

        const baseDelay = Math.floor(Math.random() * (max - min + 1)) + min;
        
        // Adicionar variação aleatória se habilitada
        if (this.delays.randomization.enabled) {
            const variance = this.delays.randomization.variance_percentage / 100;
            const variation = baseDelay * variance * (Math.random() - 0.5) * 2;
            return Math.max(1, Math.floor(baseDelay + variation));
        }

        return baseDelay;
    }

    async pauseBetweenCycles() {
        const pauseHours = Math.floor(Math.random() * 
            (this.delays.cycle_delays.cycle_pause.max_hours - this.delays.cycle_delays.cycle_pause.min_hours + 1)) + 
            this.delays.cycle_delays.cycle_pause.min_hours;
        
        this.logger.info(`Pausando por ${pauseHours} horas entre ciclos`);
        await this.sleep(pauseHours * 60 * 60 * 1000);
    }

    async pauseUntilTomorrow() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(6, 0, 0, 0); // Reiniciar às 6h da manhã
        
        const pauseTime = tomorrow.getTime() - now.getTime();
        
        this.logger.info(`Pausando até amanhã (${tomorrow.toLocaleString()})`);
        
        // Reset das estatísticas diárias
        this.resetDailyStats();
        
        await this.sleep(pauseTime);
    }

    async handleError(error) {
        this.dailyStats.errors++;
        
        // Verificar se é bloqueio do Instagram
        if (this.isInstagramBlock(error)) {
            this.logger.error('Bloqueio detectado! Pausando por 24 horas...');
            await this.sleep(24 * 60 * 60 * 1000); // 24 horas
            return;
        }

        // Verificar se atingiu o limite de erros
        if (this.dailyStats.errors >= this.rules.max_errors_per_session) {
            this.logger.error('Muitos erros detectados. Pausando sessão...');
            await this.pauseBetweenCycles();
            return;
        }

        // Pausa padrão após erro
        const errorPause = this.delays.safety_delays.error_pause.seconds;
        this.logger.info(`Pausando ${errorPause}s após erro...`);
        await this.sleep(errorPause * 1000);
    }

    isInstagramBlock(error) {
        const blockMessages = [
            'ação bloqueada',
            'action blocked',
            'tente novamente mais tarde',
            'try again later',
            'temporariamente bloqueado',
            'temporarily blocked'
        ];

        const errorMessage = error.message?.toLowerCase() || '';
        return blockMessages.some(msg => errorMessage.includes(msg));
    }

    resetDailyStats() {
        this.dailyStats = {
            likes: 0,
            follows: 0,
            unfollows: 0,
            comments: 0,
            dms: 0,
            stories: 0,
            errors: 0
        };
    }

    async updateStats() {
        try {
            const statsPath = path.join(__dirname, '../data/stats.json');
            const currentStats = await fs.readFile(statsPath, 'utf8');
            
            // Atualizar estatísticas de sessão
            const sessionStats = {
                ...this.dailyStats,
                start_time: this.cycleStartTime?.toISOString(),
                uptime: Date.now() - (this.cycleStartTime?.getTime() || Date.now())
            };
            
            // Atualizar total
            const totalStats = JSON.parse(currentStats);
            Object.keys(this.dailyStats).forEach(key => {
                if (key !== 'errors') {
                    totalStats.total[key] = (totalStats.total[key] || 0) + this.dailyStats[key];
                }
            });

            totalStats.session = sessionStats;

            await fs.writeFile(statsPath, JSON.stringify(totalStats, null, 2));
        } catch (error) {
            this.logger.error('Erro ao atualizar estatísticas:', error);
        }
    }

    async stopLoop() {
        if (!this.isRunning) return;

        this.logger.info('Parando ciclo principal do bot...');
        this.isRunning = false;
        
        // Salvar estatísticas finais
        await this.updateStats();
        
        this.logger.info('Ciclo parado com sucesso');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Métodos para controle externo
    getStats() {
        return {
            isRunning: this.isRunning,
            dailyStats: this.dailyStats,
            cycleStartTime: this.cycleStartTime,
            uptime: this.cycleStartTime ? Date.now() - this.cycleStartTime.getTime() : 0
        };
    }

    async pause() {
        this.isRunning = false;
        this.logger.info('Loop pausado pelo usuário');
    }

    async resume() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.logger.info('Loop retomado pelo usuário');
            await this.executeCycle();
        }
    }
}

module.exports = { BotLoop }; 