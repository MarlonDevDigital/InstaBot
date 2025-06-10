const logger = require('../engine/logger');
const fs = require('fs').promises;
const path = require('path');

class DirectModule {
    constructor(page) {
        this.page = page;
        this.rules = null;
        this.delays = null;
        this.messages = [];
        this.sentMessages = new Set();
        this.loadConfiguration();
    }

    async loadConfiguration() {
        try {
            this.rules = JSON.parse(await fs.readFile(path.join(__dirname, '../data/rules.json'), 'utf8'));
            this.delays = JSON.parse(await fs.readFile(path.join(__dirname, '../config/delays.json'), 'utf8'));
            
            // Carregar mensagens pré-definidas
            const commentsData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/comments.json'), 'utf8'));
            this.messages = commentsData.direct_messages || commentsData.default_comments || [];
            
            logger.info(`Carregadas ${this.messages.length} mensagens padrão para DM`);
        } catch (error) {
            logger.error('Erro ao carregar configuração de direct:', error);
        }
    }

    async executeDirect(target = null, source = 'hashtag') {
        try {
            logger.info(`Iniciando módulo de mensagens diretas - Alvo: ${target || 'automático'}`);

            if (this.messages.length === 0) {
                logger.warn('Nenhuma mensagem padrão disponível para DM');
                return false;
            }

            if (target) {
                // Enviar para usuário específico
                return await this.sendDirectToUser(target);
            } else {
                // Buscar usuários automaticamente
                if (source === 'hashtag') {
                    return await this.sendDirectFromHashtag();
                } else if (source === 'followers') {
                    return await this.sendDirectToFollowers();
                } else if (source === 'following') {
                    return await this.sendDirectToFollowing();
                }
            }

            return false;
        } catch (error) {
            logger.error('Erro no módulo de mensagens diretas:', error);
            return false;
        }
    }

    async sendDirectToUser(username) {
        try {
            logger.info(`Enviando DM para: @${username}`);

            // Verificar se já enviou mensagem para este usuário
            if (this.sentMessages.has(username)) {
                logger.info(`Já enviou DM para @${username} anteriormente`);
                return false;
            }

            // Navegar para o perfil do usuário
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Verificar se perfil existe
            const profileExists = await this.page.$('main section');
            if (!profileExists) {
                logger.warn(`Perfil @${username} não encontrado`);
                return false;
            }

            // Verificar se é conta privada
            const privateIndicator = await this.page.$('h2:has-text("Esta conta é privada"), h2:has-text("This Account is Private")');
            if (privateIndicator) {
                logger.warn(`Perfil @${username} é privado`);
                return false;
            }

            // Buscar botão "Mensagem" ou "Message"
            const messageButton = await this.page.$('div:has-text("Mensagem") button, div:has-text("Message") button, button:has-text("Mensagem"), button:has-text("Message")');
            
            if (!messageButton) {
                logger.warn(`Botão de mensagem não encontrado para @${username}`);
                return false;
            }

            // Clicar no botão de mensagem
            await messageButton.click();
            await this.page.waitForTimeout(3000);

            // Enviar mensagem
            const sent = await this.sendMessage(username);

            if (sent) {
                this.sentMessages.add(username);
                logger.logAction('direct_message', 'success', { username });
                return true;
            }

            return false;

        } catch (error) {
            logger.error(`Erro ao enviar DM para @${username}:`, error);
            return false;
        }
    }

    async sendDirectFromHashtag() {
        try {
            // Carregar hashtag aleatória
            const hashtagsData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/hashtags.json'), 'utf8'));
            const hashtags = hashtagsData.hashtags.filter(h => h.active);
            
            if (hashtags.length === 0) {
                logger.warn('Nenhuma hashtag ativa encontrada');
                return false;
            }

            const hashtag = hashtags[Math.floor(Math.random() * hashtags.length)].name;
            
            logger.info(`Buscando usuários da hashtag: #${hashtag}`);

            // Navegar para a hashtag
            await this.page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Buscar posts da hashtag
            const posts = await this.page.$$('article a[href*="/p/"]');
            
            if (posts.length === 0) {
                logger.warn(`Nenhum post encontrado para hashtag #${hashtag}`);
                return false;
            }

            // Selecionar alguns posts para extrair usuários
            const selectedPosts = this.shuffleArray([...posts]).slice(0, 5);
            const users = [];

            for (const post of selectedPosts) {
                try {
                    await post.click();
                    await this.page.waitForTimeout(2000);

                    // Extrair username do post
                    const usernameElement = await this.page.$('article header a[role="link"]');
                    if (usernameElement) {
                        const username = await this.page.evaluate(el => el.textContent, usernameElement);
                        if (username && !this.sentMessages.has(username)) {
                            users.push(username);
                        }
                    }

                    // Fechar post
                    await this.closePost();

                } catch (error) {
                    logger.error('Erro ao extrair usuário do post:', error);
                    await this.closePost();
                }
            }

            if (users.length === 0) {
                logger.warn('Nenhum usuário válido encontrado');
                return false;
            }

            // Enviar DM para alguns usuários
            let sentCount = 0;
            const maxDMs = Math.min(users.length, this.rules.dm_per_exec || 3);

            for (const username of users) {
                if (sentCount >= maxDMs) break;

                const sent = await this.sendDirectToUser(username);
                
                if (sent) {
                    sentCount++;
                    
                    // Delay longo entre DMs
                    const delay = this.calculateDelay();
                    logger.info(`Aguardando ${delay}s antes do próximo DM...`);
                    await this.page.waitForTimeout(delay * 1000);
                }
            }

            logger.info(`DMs enviados: ${sentCount}/${maxDMs} da hashtag #${hashtag}`);
            return sentCount > 0;

        } catch (error) {
            logger.error('Erro ao enviar DMs de hashtag:', error);
            return false;
        }
    }

    async sendDirectToFollowers() {
        try {
            logger.info('Enviando DMs para seguidores');

            // Navegar para lista de seguidores
            await this.page.goto('https://www.instagram.com/accounts/edit/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Esta funcionalidade seria mais complexa na implementação real
            // Por enquanto, retornar false indicando que não foi implementada
            logger.warn('Funcionalidade de DM para seguidores ainda não implementada');
            return false;

        } catch (error) {
            logger.error('Erro ao enviar DMs para seguidores:', error);
            return false;
        }
    }

    async sendDirectToFollowing() {
        try {
            logger.info('Enviando DMs para usuários seguidos');

            // Navegar para lista de seguindo
            await this.page.goto('https://www.instagram.com/accounts/edit/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Esta funcionalidade seria mais complexa na implementação real
            // Por enquanto, retornar false indicando que não foi implementada
            logger.warn('Funcionalidade de DM para seguindo ainda não implementada');
            return false;

        } catch (error) {
            logger.error('Erro ao enviar DMs para seguindo:', error);
            return false;
        }
    }

    async sendMessage(username) {
        try {
            // Aguardar carregamento da janela de DM
            await this.page.waitForTimeout(3000);

            // Verificar se já existe conversa anterior
            const hasConversation = await this.checkExistingConversation();
            
            if (hasConversation) {
                logger.info(`Conversa anterior encontrada com @${username}`);
                // Opcionalmente, pode escolher não enviar ou enviar mesmo assim
                // Por enquanto, vamos enviar mesmo assim
            }

            // Buscar campo de texto da mensagem
            const messageField = await this.page.$('textarea[placeholder*="mensagem"], textarea[placeholder*="message"], div[contenteditable="true"]');
            
            if (!messageField) {
                logger.warn('Campo de mensagem não encontrado');
                return false;
            }

            // Selecionar mensagem aleatória
            const randomMessage = this.getRandomMessage();
            if (!randomMessage) {
                logger.warn('Nenhuma mensagem disponível');
                return false;
            }

            logger.info(`Enviando mensagem: "${randomMessage}"`);

            // Clicar no campo de mensagem
            await messageField.click();
            await this.page.waitForTimeout(1000);

            // Limpar campo e digitar mensagem
            await messageField.fill('');
            await this.typeHumanLike(messageField, randomMessage);

            // Aguardar um pouco antes de enviar
            await this.page.waitForTimeout(2000);

            // Buscar botão de enviar
            const sendButton = await this.page.$('button:has-text("Enviar"), button:has-text("Send"), button[type="submit"]');
            
            if (!sendButton) {
                // Tentar Enter
                await this.page.keyboard.press('Enter');
                logger.info('Mensagem enviada (Enter)');
            } else {
                await sendButton.click();
                logger.info('Mensagem enviada (botão)');
            }

            // Aguardar confirmação
            await this.page.waitForTimeout(3000);

            // Verificar se mensagem foi enviada com sucesso
            const success = await this.verifyMessageSent(randomMessage);

            if (success) {
                logger.logAction('direct_message', 'success', { 
                    username,
                    message: randomMessage
                });
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Erro ao enviar mensagem:', error);
            return false;
        }
    }

    async checkExistingConversation() {
        try {
            // Verificar se há mensagens anteriores na conversa
            const messages = await this.page.$$('div[role="grid"] div[role="row"]');
            return messages.length > 0;
        } catch (error) {
            logger.error('Erro ao verificar conversa existente:', error);
            return false;
        }
    }

    async verifyMessageSent(messageText) {
        try {
            // Aguardar um pouco para a mensagem aparecer
            await this.page.waitForTimeout(2000);

            // Procurar pela mensagem enviada
            const messageFound = await this.page.evaluate((text) => {
                const messages = document.querySelectorAll('div[role="grid"] div[role="row"]');
                return Array.from(messages).some(msg => 
                    msg.textContent.includes(text.substring(0, 20)) // Verificar primeiros 20 caracteres
                );
            }, messageText);

            return messageFound;

        } catch (error) {
            logger.error('Erro ao verificar mensagem enviada:', error);
            return false;
        }
    }

    getRandomMessage() {
        if (this.messages.length === 0) return null;
        
        // Filtrar mensagens ativas
        const activeMessages = this.messages.filter(m => m.active !== false);
        
        if (activeMessages.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * activeMessages.length);
        return activeMessages[randomIndex].text || activeMessages[randomIndex];
    }

    async typeHumanLike(element, text) {
        // Simular digitação humana com delays variáveis
        for (const char of text) {
            await element.type(char);
            const delay = Math.floor(Math.random() * 150) + 50; // 50-200ms entre caracteres
            await this.page.waitForTimeout(delay);
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
        // Delays específicos para DM (10-30s conforme especificação)
        const delayConfig = this.delays?.action_delays?.direct_message || { min: 10, max: 30 };
        const baseDelay = Math.floor(Math.random() * (delayConfig.max - delayConfig.min + 1)) + delayConfig.min;
        
        // Adicionar variação se habilitada
        if (this.delays?.randomization?.enabled) {
            const variance = this.delays.randomization.variance_percentage / 100;
            const variation = baseDelay * variance * (Math.random() - 0.5) * 2;
            return Math.max(5, Math.floor(baseDelay + variation));
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
    getSentMessages() {
        return Array.from(this.sentMessages);
    }

    clearSentMessages() {
        this.sentMessages.clear();
        logger.info('Lista de DMs enviados limpa');
    }

    getAvailableMessages() {
        return [...this.messages];
    }

    addMessage(message) {
        this.messages.push({
            text: message,
            active: true,
            created: Date.now()
        });
        logger.info(`Nova mensagem DM adicionada: "${message}"`);
    }

    async openDirectTab() {
        try {
            logger.info('Abrindo aba de mensagens diretas');

            // Navegar para mensagens diretas
            await this.page.goto('https://www.instagram.com/direct/inbox/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await this.page.waitForTimeout(3000);

            // Verificar se carregou corretamente
            const directPage = await this.page.$('div[role="main"]');
            
            if (directPage) {
                logger.info('Aba de mensagens diretas aberta com sucesso');
                return true;
            }

            logger.warn('Erro ao abrir aba de mensagens diretas');
            return false;

        } catch (error) {
            logger.error('Erro ao abrir aba de mensagens diretas:', error);
            return false;
        }
    }

    async getConversationsList() {
        try {
            // Abrir aba de direct se não estiver
            await this.openDirectTab();

            // Buscar lista de conversas
            const conversations = await this.page.$$('div[role="listbox"] div[role="button"]');
            
            const conversationsList = [];

            for (const conv of conversations) {
                try {
                    const username = await this.page.evaluate(el => {
                        const usernameEl = el.querySelector('span');
                        return usernameEl ? usernameEl.textContent : null;
                    }, conv);

                    if (username) {
                        conversationsList.push(username);
                    }
                } catch (error) {
                    logger.error('Erro ao extrair username da conversa:', error);
                }
            }

            logger.info(`Encontradas ${conversationsList.length} conversas ativas`);
            return conversationsList;

        } catch (error) {
            logger.error('Erro ao obter lista de conversas:', error);
            return [];
        }
    }

    async saveMessages() {
        try {
            const filePath = path.join(__dirname, '../data/comments.json');
            const currentData = JSON.parse(await fs.readFile(filePath, 'utf8'));
            
            currentData.direct_messages = this.messages;
            
            await fs.writeFile(filePath, JSON.stringify(currentData, null, 2));
            logger.info('Mensagens DM salvas com sucesso');
        } catch (error) {
            logger.error('Erro ao salvar mensagens DM:', error);
        }
    }
}

module.exports = { DirectModule }; 