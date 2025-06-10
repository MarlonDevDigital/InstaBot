/**
 * InstaBot v1.0 - Menu Lateral Controller
 * ======================================
 * Gerencia as interações do menu lateral roxo
 */

class MenuController {
    constructor() {
        this.currentSection = 'home';
        this.menuIcons = null;
        this.init();
    }

    init() {
        this.menuIcons = document.querySelectorAll('.menu-icon');
        this.setupEventListeners();
        this.setupTooltips();
        console.log('Menu Controller inicializado');
    }

    setupEventListeners() {
        this.menuIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.selectMenuItem(action);
                this.handleMenuAction(action);
            });

            // Hover effects
            icon.addEventListener('mouseenter', (e) => {
                if (!e.currentTarget.classList.contains('selected')) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                }
            });

            icon.addEventListener('mouseleave', (e) => {
                if (!e.currentTarget.classList.contains('selected')) {
                    e.currentTarget.style.transform = 'scale(1)';
                }
            });
        });
    }

    setupTooltips() {
        const tooltipTexts = {
            'home': 'Início',
            'stats': 'Estatísticas',
            'instagram': 'Instagram', 
            'automation': 'Automação',
            'posts': 'Posts',
            'schedule': 'Agendamento',
            'settings': 'Configurações'
        };

        this.menuIcons.forEach(icon => {
            const action = icon.dataset.action;
            if (tooltipTexts[action]) {
                icon.setAttribute('title', tooltipTexts[action]);
            }
        });
    }

    selectMenuItem(action) {
        // Remove seleção anterior
        this.menuIcons.forEach(icon => {
            icon.classList.remove('selected');
            icon.style.transform = 'scale(1)';
        });

        // Adiciona nova seleção
        const selectedIcon = document.querySelector(`[data-action="${action}"]`);
        if (selectedIcon) {
            selectedIcon.classList.add('selected');
            selectedIcon.style.transform = 'scale(1.05)';
        }

        this.currentSection = action;
        console.log(`Seção selecionada: ${action}`);
    }

    handleMenuAction(action) {
        switch (action) {
            case 'home':
                this.showHome();
                break;
            case 'stats':
                this.showStats();
                break;
            case 'instagram':
                this.showInstagram();
                break;
            case 'automation':
                this.showAutomation();
                break;
            case 'posts':
                this.showPosts();
                break;
            case 'schedule':
                this.showSchedule();
                break;
            case 'settings':
                this.showSettings();
                break;
            default:
                console.warn('Ação de menu desconhecida:', action);
        }
    }

    showHome() {
        console.log('Exibindo seção: Início');
        this.showNotification('Página Inicial', 'Bem-vindo ao InstaBot v1.0!');
    }

    showStats() {
        console.log('Exibindo seção: Estatísticas');
        this.showNotification('Estatísticas', 'Visualize suas métricas de automação');
    }

    showInstagram() {
        console.log('Exibindo seção: Instagram');
        this.showNotification('Instagram', 'Acesse sua conta do Instagram');
    }

    showAutomation() {
        console.log('Exibindo seção: Automação');
        this.showNotification('Automação', 'Configure suas automações');
    }

    showPosts() {
        console.log('Exibindo seção: Posts');
        this.showNotification('Posts', 'Gerencie seus posts e conteúdo');
    }

    showSchedule() {
        console.log('Exibindo seção: Agendamento');
        this.showNotification('Agendamento', 'Configure horários de postagem');
    }

    showSettings() {
        console.log('Exibindo seção: Configurações');
        this.showNotification('Configurações', 'Ajuste as configurações do bot');
    }

    showNotification(title, message) {
        // Criar notificação visual temporária
        const notification = document.createElement('div');
        notification.className = 'menu-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;

        // Adicionar estilos inline
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #9C27B0, #7B1FA2);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(156, 39, 176, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;

        // Adicionar ao body
        document.body.appendChild(notification);

        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getCurrentSection() {
        return this.currentSection;
    }
}

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .notification-content h3 {
        margin: 0 0 5px 0;
        font-size: 16px;
        font-weight: bold;
    }

    .notification-content p {
        margin: 0;
        font-size: 14px;
        opacity: 0.9;
    }
`;
document.head.appendChild(style);

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.menuController = new MenuController();
});

// Expor globalmente
window.MenuController = MenuController; 