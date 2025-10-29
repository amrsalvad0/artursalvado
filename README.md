# Artur Salvado - Sistema de Gestão de Reuniões e Tarefas

## 📋 Descrição

O Artur Salvado é uma aplicação web moderna para gestão de reuniões e tarefas no escritório. A aplicação oferece uma interface intuitiva com menu lateral recolhível, sistema de notas em tempo real durante reuniões, criação de tarefas diretamente das reuniões e um sistema robusto de backup.

## 🚀 Características Principais

### 📅 Gestão de Reuniões
- **Agendamento** de reuniões com data, hora e duração
- **Notas em tempo real** durante reuniões ativas
- **Status automático** - reuniões ficam ativas automaticamente no horário agendado
- **Criação de tarefas** diretamente durante a reunião

### ✅ Gestão de Tarefas
- **Criação e edição** de tarefas com diferentes prioridades
- **Filtros** por status (Pendente, Em Progresso, Concluída)
- **Prazos** com alertas visuais
- **Ligação** com reuniões de origem

### 💾 Sistema de Backup
- **Backups manuais** com um clique
- **Histórico** de todos os backups criados
- **Informações detalhadas** (tamanho, data, status)
- **Base de dados estável** SQLite para múltiplos PCs

### 🎨 Interface Moderna
- **Design responsivo** que funciona em qualquer dispositivo
- **Animações suaves** e transições
- **Menu lateral recolhível** para otimizar espaço
- **Tema moderno** com gradientes e sombras

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **SQLite3** - Base de dados
- **Socket.IO** - Comunicação em tempo real
- **UUID** - Geração de IDs únicos

### Frontend
- **HTML5** - Estrutura
- **CSS3** - Estilos com animações
- **JavaScript** - Lógica do cliente
- **Font Awesome** - Ícones
- **Socket.IO Client** - Tempo real

## 📦 Instalação e Configuração

### Pré-requisitos
- Node.js (versão 14 ou superior)
- npm (incluído com Node.js)

### 🚀 Formas de Iniciar a Aplicação

#### **Método 1: Duplo Clique (Mais Fácil)**
1. **Duplo clique** no ficheiro `ABRIR-OFFICE-MANAGER.bat`
2. A aplicação iniciará automaticamente e abrirá no browser
3. **Pronto!** Não precisa de mais nada

#### **Método 2: Script PowerShell**
1. Clique com botão direito em `iniciar-office-manager.ps1`
2. Selecione "Executar com PowerShell"
3. O browser abrirá automaticamente

#### **Método 3: Linha de Comando**
1. **Instalar dependências** (apenas na primeira vez)
   ```bash
   npm install
   ```

2. **Iniciar o servidor**
   ```bash
   npm start
   ```
   
   Para desenvolvimento com reinício automático:
   ```bash
   npm run dev
   ```

3. **Aceder à aplicação**
   - O browser abrirá automaticamente
   - Ou acesse manualmente: `http://localhost:3000`

### 📁 Ficheiros de Inicialização Criados

- **`ABRIR-OFFICE-MANAGER.bat`** - Inicialização simples (Windows)
- **`iniciar-office-manager.bat`** - Script detalhado com verificações
- **`iniciar-office-manager.ps1`** - Script PowerShell avançado

## 💡 Como Usar

### Dashboard
- Visualize um resumo das suas reuniões e tarefas
- Veja reuniões ativas e próximas reuniões
- Acompanhe estatísticas de produtividade

### Reuniões
1. Clique em **"Nova Reunião"** para agendar
2. Preencha título, descrição, data/hora e duração
3. A reunião ficará **automaticamente ativa** no horário agendado
4. Durante reuniões ativas, pode adicionar **notas em tempo real**
5. Crie **tarefas diretamente** da reunião

### Tarefas
1. Clique em **"Nova Tarefa"** para criar
2. Defina prioridade (Baixa, Média, Alta) e prazo
3. Use os **filtros** para organizar por status
4. Clique numa tarefa para editar

### Sistema de Backup
1. Aceda à página **"Backup"**
2. Clique em **"Criar Backup"** quando necessário
3. Consulte o **histórico** de backups anteriores
4. Todos os backups são guardados localmente

## 🔧 Configuração Avançada

### Base de Dados
A aplicação usa SQLite, criando automaticamente o ficheiro `office_manager.db`. A base de dados é:
- **Estável** entre diferentes PCs
- **Acessível** por múltiplos browsers
- **Backup-friendly** com ficheiros simples

### Portas e Rede
- **Porta padrão**: 3000
- **Configurável** via variável de ambiente `PORT`
- **Acessível na rede local** para outros PCs

Para acesso na rede:
```bash
# Windows - Descobrir IP local
ipconfig

# Aceder de outro PC
http://[IP-DO-SERVIDOR]:3000
```

### Estrutura de Ficheiros
```
office-manager/
├── server.js              # Servidor principal
├── package.json           # Dependências
├── office_manager.db      # Base de dados (criada automaticamente)
├── backups/               # Pasta de backups (criada automaticamente)
└── public/                # Ficheiros do frontend
    ├── index.html         # Página principal
    ├── css/
    │   └── styles.css     # Estilos
    └── js/
        └── app.js         # Lógica JavaScript
```

## 🔄 API Endpoints

### Reuniões
- `GET /api/meetings` - Listar todas as reuniões
- `POST /api/meetings` - Criar nova reunião
- `PUT /api/meetings/:id` - Atualizar reunião
- `DELETE /api/meetings/:id` - Eliminar reunião
- `GET /api/meetings/:id/notes` - Obter notas da reunião

### Tarefas
- `GET /api/tasks` - Listar todas as tarefas
- `POST /api/tasks` - Criar nova tarefa
- `PUT /api/tasks/:id` - Atualizar tarefa
- `DELETE /api/tasks/:id` - Eliminar tarefa

### Backups
- `GET /api/backups` - Listar backups
- `POST /api/backups` - Criar novo backup

## 🤝 Contribuições

Este projeto foi desenvolvido como uma solução completa para gestão de escritório. Sugestões e melhorias são bem-vindas!

## 📄 Licença

ISC License - Livre para uso pessoal e comercial.

---

**Artur Salvado** - Organize o seu escritório com eficiência! 🏢✨
