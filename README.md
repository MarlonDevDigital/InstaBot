# InstaBot v1.0

**Bot de Automação Inteligente para Instagram**

*Versão única e definitiva - Desenvolvido com tecnologia Electron.js*

---

## Índice

- [Visão Geral](#visão-geral)
- [Características](#características)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como Usar](#como-usar)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Segurança](#segurança)
- [Estatísticas](#estatísticas)
- [Solução de Problemas](#solução-de-problemas)
- [Desenvolvimento](#desenvolvimento)
- [Licença](#licença)

## Visão Geral

O **InstaBot v1.0** é uma aplicação desktop moderna para automação inteligente do Instagram, desenvolvida com Electron.js. Oferece uma interface cyber com tema verde neon + preto, proporcionando uma experiência única e profissional.

### Características Principais

- **Interface Desktop Moderna** - Aplicação nativa com Electron.js
- **Navegador Integrado** - Instagram real embarcado na aplicação
- **Automação Inteligente** - Likes, follows, comentários e stories
- **Segurança Avançada** - Delays humanizados e limites seguros
- **Dashboard Completo** - Estatísticas e logs em tempo real
- **Login Seguro** - Credenciais nunca armazenadas na aplicação

---

### Automações Básicas

- **Curtir Posts** - Likes automáticos em hashtags específicas
- **Comentar Posts** - Comentários personalizados e naturais
- **Seguir Usuários** - Follow automático baseado em hashtags
- **Visualizar Stories** - Interação com stories

### Automações Avançadas
- **Mass Actions** - Ações em lote com segurança
- **Agendamento** - Programação de ações
- **Targeting Avançado** - Filtros por seguidores, engajamento
- **Growth Hacking** - Estratégias de crescimento
- **Análise de Perfis** - Verificação antes de interagir
- **Blacklist** - Evitar usuários indesejados

### Recursos de Segurança
- **Delays Humanizados** - 2-21 segundos entre ações
- **User-Agent Aleatório** - Rotação automática
- **Limites Diários** - Proteção contra rate limiting
- **Logs Detalhados** - Monitoramento completo
- **Modo Stealth** - Proteção anti-detecção
- **Alertas de Segurança** - Notificações de problemas

## Instalação

### Pré-requisitos

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **Windows 10/11** (recomendado)

```bash
# Verificar versões
node --version
npm --version
git --version
```

```bash
# 1. Clonar repositório
git clone https://github.com/seu-usuario/instabot.git
cd instabot

# 2. Instalar dependências
npm install

# 3. Configurar ambiente
cp env .env

# 4. Executar aplicação
npm start
```

### Instalação Avançada

```bash
# Instalar globalmente
npm install -g electron

# Instalar dependências de desenvolvimento
npm install --save-dev

# Executar em modo desenvolvimento
npm run dev

# Gerar build para produção
npm run build
```

## Configuração

### Arquivo .env

```env
# Configurações do Bot
BOT_NAME=InstaBot
BOT_VERSION=1.0.0

# Limites de Segurança
DAILY_LIKES_LIMIT=500
DAILY_FOLLOWS_LIMIT=200
DAILY_COMMENTS_LIMIT=100

# Delays (em segundos)
MIN_DELAY=2
MAX_DELAY=21
LONG_DELAY=300

# Configurações Avançadas
HEADLESS=false
STEALTH_MODE=true
```

### Configurações Avançadas

- **config/limits.json** - Limites personalizados
- **config/delays.json** - Delays entre ações
- **data/hashtags.json** - Hashtags alvo
- **data/comments.json** - Comentários padrão

## Como Usar

### Primeira Execução

1. **Executar InstaBot.bat** ou `npm start`
2. **Fazer login** na aba Instagram integrada
3. **Configurar hashtags** e comentários
4. **Iniciar automação** com limites seguros
5. **Monitorar logs** em tempo real

```bash
# Executar via terminal
npm start

# Executar em background
npm run start:bg

# Ver logs em tempo real
npm run logs
```

### Interface Principal

- **Instagram** - Navegador integrado para login
- **Ações** - Controles de automação
- **Delays** - Configuração de timing
- **Fontes** - Hashtags e usuários alvo
- **Comentários** - Mensagens personalizadas
- **Analytics** - Estatísticas e logs

## Estrutura do Projeto

```
InstaBot/
├── index.js              # Aplicação principal
├── package.json          # Dependências e scripts
├── env.example           # Exemplo de configuração
├── README.md             # Este arquivo
├── .gitignore            # Arquivos ignorados
├── interface/            # Interface gráfica
│   ├── index.html        # HTML principal
│   ├── style.css         # Estilos CSS
│   ├── script.js         # JavaScript frontend
│   └── assets/           # Recursos visuais
├── engine/               # Motor de automação
│   ├── main.js           # Engine principal
│   ├── logger.js         # Sistema de logs
│   └── loop.js           # Loops de execução
├── modules/              # Módulos de automação
│   ├── like.js           # Curtir posts
│   ├── follow.js         # Seguir usuários
│   ├── comment.js        # Comentar posts
│   └── stories.js        # Visualizar stories
├── auth/                 # Autenticação
│   └── session.js        # Gerenciamento de sessão
├── config/               # Configurações
│   ├── limits.json       # Limites de segurança
│   └── delays.json       # Delays entre ações
├── data/                 # Dados e estatísticas
│   ├── stats.json        # Estatísticas gerais
│   ├── hashtags.json     # Hashtags configuradas
│   └── comments.json     # Comentários padrão
└── logs/                 # Arquivos de log
    ├── bot.log           # Log principal
    ├── errors.log        # Log de erros
    └── actions.log       # Log de ações
```

## Segurança

### Proteções Implementadas

- **Rate Limiting** - Respeita limites do Instagram
- **Delays Humanizados** - Comportamento natural
- **User-Agent Rotation** - Evita detecção
- **Session Management** - Gerenciamento seguro
- **Error Handling** - Tratamento robusto de erros
- **Logging Completo** - Auditoria de todas as ações

### Limites Recomendados

```json
{
  "daily": {
    "likes": 500,
    "follows": 200,
    "comments": 100,
    "unfollows": 150,
    "stories": 300
  }
}
```

**Importante:**
- Use sempre limites conservadores
- Monitore logs regularmente
- Pare imediatamente se detectar problemas
- Nunca compartilhe suas credenciais
- Use conta secundária para testes

## Estatísticas

O InstaBot oferece estatísticas detalhadas em tempo real:

### Métricas Principais

- **Likes dados** - Total e por sessão
- **Follows realizados** - Com taxa de follow-back
- **Comentários enviados** - Com engajamento
- **Stories visualizados** - Interações
- **Erros encontrados** - Para debugging

### Logs Disponíveis

- **bot.log** - Log principal com todas as ações
- **errors.log** - Erros e exceções
- **actions.log** - Detalhes de cada ação
- **stats.json** - Estatísticas em JSON

## Solução de Problemas

### Problemas Comuns

**Bot não inicia:**
```bash
# Verificar dependências
npm install

# Limpar cache
npm cache clean --force

# Reinstalar node_modules
rm -rf node_modules
npm install
```

**Login não funciona:**
- Verificar conexão com internet
- Limpar cookies do navegador
- Tentar login manual primeiro
- Verificar se conta não está bloqueada

**Ações não executam:**
- Verificar limites diários
- Conferir configurações de delay
- Analisar logs de erro
- Verificar se Instagram mudou interface

### Comandos Úteis

```bash
# Ver logs em tempo real
tail -f logs/bot.log

# Limpar logs antigos
npm run clean:logs

# Resetar configurações
npm run reset:config

# Verificar status
npm run status

# Parar bot
npm run stop

# Reiniciar bot
npm run restart

# Backup de dados
npm run backup

# Restaurar backup
npm run restore
```

## Desenvolvimento

### Como Contribuir

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

### Diretrizes

- Seguir padrões de código existentes
- Adicionar testes para novas funcionalidades
- Documentar mudanças no README
- Manter compatibilidade com versão atual
- Testar em ambiente de desenvolvimento

## Licença

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Aviso Legal

Este software é fornecido apenas para fins educacionais e de pesquisa. O uso deste bot deve estar em conformidade com os Termos de Serviço do Instagram. Os desenvolvedores não se responsabilizam por qualquer uso inadequado ou consequências decorrentes do uso deste software.

**Use por sua própria conta e risco.**

---

Desenvolvido com pela InstaBot Team

[Star no GitHub](https://github.com/instabot/instabot) • [Reportar Bug](https://github.com/instabot/instabot/issues) • [Sugerir Feature](https://github.com/instabot/instabot/issues)