/**
 * InstaBot v1.0 - Sistema de Logging Simplificado
 * ==============================================
 * 
 * Sistema de logging sem dependências externas
 * Versão única e definitiva do projeto
 */

const path = require('path');
const fs = require('fs');

/**
 * Cria um logger simplificado
 */
function createLogger(module_name = 'instabot') {
    const logsDir = path.join(__dirname, '..', 'logs');
    
    // Garantir que o diretório de logs existe
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Logger simplificado
    const logger = {
        info: (message, meta = {}) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${module_name.toUpperCase()}] INFO: ${message}`, meta);
        },
        
        error: (message, meta = {}) => {
            const timestamp = new Date().toISOString();
            console.error(`[${timestamp}] [${module_name.toUpperCase()}] ERROR: ${message}`, meta);
        },
        
        warn: (message, meta = {}) => {
            const timestamp = new Date().toISOString();
            console.warn(`[${timestamp}] [${module_name.toUpperCase()}] WARN: ${message}`, meta);
        },
        
        debug: (message, meta = {}) => {
            const timestamp = new Date().toISOString();
            console.debug(`[${timestamp}] [${module_name.toUpperCase()}] DEBUG: ${message}`, meta);
        },
        
        // Método personalizado para ações do bot
        logAction: function(action, details = {}) {
            this.info(`ACTION: ${action}`, {
                action: action,
                timestamp: new Date().toISOString(),
                module: module_name,
                ...details
            });
        },
        
        // Método para estatísticas
        logStats: function(stats) {
            this.info('STATS UPDATE', {
                type: 'stats',
                timestamp: new Date().toISOString(),
                module: module_name,
                stats: stats
            });
        },
        
        // Método para erros do Instagram
        logInstagramError: function(error, context = {}) {
            this.error(`INSTAGRAM ERROR: ${error}`, {
                type: 'instagram_error',
                error: error,
                timestamp: new Date().toISOString(),
                module: module_name,
                context: context
            });
        }
    };
    
    return logger;
}

/**
 * Limpa logs antigos
 */
function cleanOldLogs(daysToKeep = 30) {
    const logsDir = path.join(__dirname, '..', 'logs');
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    try {
        if (!fs.existsSync(logsDir)) return;
        
        const files = fs.readdirSync(logsDir);
        
        files.forEach(file => {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime < cutoffDate) {
                fs.unlinkSync(filePath);
                console.log(`Log antigo removido: ${file}`);
            }
        });
    } catch (error) {
        console.error('Erro ao limpar logs antigos:', error);
    }
}

/**
 * Configuração simplificada
 */
function setupLogRotation() {
            console.log('Sistema de logging simplificado ativo');
}

module.exports = {
    createLogger,
    cleanOldLogs,
    setupLogRotation
}; 