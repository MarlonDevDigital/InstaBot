# Extração de Dados Reais do Perfil - InstaBot v1.0

## Objetivo
Extrair automaticamente os dados reais do usuário logado no Instagram e exibir na tela de estatísticas do InstaBot v1.0.

## Como Funciona

### 1. Detecção de Login
- O sistema monitora constantemente o status de login na webview do Instagram
- Quando detecta que o usuário fez login, inicia automaticamente a captura de dados

### 2. Captura de Dados via WebView
O método `captureProfileFromWebview()` executa JavaScript diretamente na webview do Instagram para extrair:

#### Dados Capturados:
- **Username**: Nome de usuário (@usuario)
- **Display Name**: Nome completo exibido no perfil
- **Profile Picture**: URL da foto de perfil
- **Followers**: Número de seguidores
- **Following**: Número de pessoas seguindo
- **Posts**: Número de posts publicados
- **Bio**: Biografia do perfil
- **Is Private**: Se a conta é privada
- **Is Verified**: Se a conta é verificada

### 3. Processamento de Números
O sistema processa automaticamente números com formatação:
- **1.2k** → 1200
- **1.5M** → 1500000
- **2,847** → 2847

### 4. Persistência de Dados
- Dados são salvos em `data/profile.json`
- Utiliza IPC (Inter-Process Communication) do Electron
- Dados são atualizados a cada novo login

### 5. Integração com Interface
- Tela de estatísticas carrega dados reais automaticamente
- Fallback para dados simulados se não houver dados reais
- Atualização dinâmica da interface

## Arquivos Envolvidos

### Backend (Electron)
- `index.js`: Handler IPC para salvar/carregar dados
- `auth/session.js`: Extração via Puppeteer (para futuro uso)

### Frontend (Interface)
- `interface/script.js`: Captura via webview e atualização da interface
- `interface/index.html`: Estrutura da tela de estatísticas
- `interface/style.css`: Estilos da tela de estatísticas

### Dados
- `data/profile.json`: Armazenamento dos dados extraídos

## Fluxo de Execução

1. **Login Detectado** → Aguarda 3 segundos
2. **Captura Iniciada** → Executa JavaScript na webview
3. **Navegação para Perfil** → Se necessário, navega para página do perfil
4. **Extração de Dados** → Coleta informações do DOM
5. **Processamento** → Formata números e limpa dados
6. **Salvamento** → Persiste em JSON via IPC
7. **Atualização Interface** → Recarrega tela de estatísticas

## Segurança e Privacidade

- **Dados Locais**: Todos os dados ficam armazenados localmente
- **Sem Envio Externo**: Nenhum dado é enviado para servidores externos
- **Apenas Dados Públicos**: Extrai apenas informações visíveis no perfil
- **Respeita Privacidade**: Não acessa dados privados ou de terceiros

## Configurações Técnicas

### Seletores DOM Utilizados:
```javascript
// Username e Display Name
'header h2, header h1, [data-testid="user-name"]'

// Foto de Perfil
'header img, img[data-testid="user-avatar"]'

// Estatísticas
'header section ul li, header section div > div'

// Bio
'header section div div span:not([data-testid])'

// Verificações
'[data-testid="verified-badge"], svg[aria-label*="verified"]'
'[data-testid="private-account-indicator"], svg[aria-label*="private"]'
```

### Tratamento de Erros:
- Fallback para dados básicos em caso de erro
- Logs detalhados para debugging
- Retry automático em falhas temporárias

## Benefícios

1. **Dados Reais**: Estatísticas precisas do perfil atual
2. **Automático**: Captura sem intervenção do usuário
3. **Atualizado**: Dados sempre atuais a cada login
4. **Integrado**: Funciona perfeitamente com a interface existente
5. **Confiável**: Sistema robusto com tratamento de erros

## Resultado Final

A tela de estatísticas do InstaBot v1.0 agora exibe:
- Foto de perfil real do usuário
- Nome e username reais
- Números reais de seguidores, seguindo e posts
- Gráficos proporcionais aos dados reais
- Interface atualizada automaticamente

---

**InstaBot v1.0** - Sistema completo de automação do Instagram com dados reais integrados. 