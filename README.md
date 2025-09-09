# StudyFlow 📚

Um sistema completo de gerenciamento de estudos desenvolvido com Flask e JavaScript vanilla. O StudyFlow permite que estudantes organizem suas sessões de estudo, acompanhem seu progresso e mantenham suas anotações de forma eficiente, com sistema de autenticação robusto e interface administrativa.

## ✨ Funcionalidades

### 🔐 Sistema de Autenticação Completo

- Login seguro com validação de credenciais
- Controle de sessões por usuário
- Redirecionamento automático baseado no tipo de usuário
- Logout seguro com encerramento de sessão
- Proteção de rotas e endpoints

### 👥 Administração de Usuários

- **Interface administrativa exclusiva** para administradores
- **Gerenciamento completo de usuários**: criar, editar, excluir
- **Controle de permissões** (usuário comum vs administrador)
- **Redirecionamento automático** para área administrativa
- **Separação de interfaces** entre usuários e administradores

### 📊 Dashboard Interativo

- Estatísticas de estudo em tempo real
- Gráficos de progresso semanal
- Contador de sequência de estudos
- Resumo de horas estudadas
- **Dados específicos por usuário autenticado**

### 📝 Gerenciamento de Sessões

- Registro de sessões de estudo por usuário
- Timer Pomodoro integrado
- Histórico completo de atividades
- Filtros por data e disciplina
- **Isolamento de dados por usuário**

### 📚 Organização de Disciplinas

- Criação e edição de disciplinas personalizadas
- Cores personalizadas para cada matéria
- Estatísticas por disciplina
- **Disciplinas específicas por usuário**

### 📋 Sistema de Anotações

- Criação de notas organizadas por usuário
- Busca e filtros personalizados
- Edição em tempo real
- **Privacidade de anotações por usuário**

### 📅 Agenda de Estudos

- Planejamento de sessões futuras
- Visualização de cronograma personalizado
- Lembretes e notificações
- **Agenda individual por usuário**

### 📈 Relatórios e Análises

- Gráficos de distribuição por disciplina
- Análise de progresso temporal
- Métricas de produtividade
- **Relatórios personalizados por usuário**

## 🚀 Tecnologias Utilizadas

- **Backend**: Python Flask com SQLite
- **Frontend**: JavaScript (Vanilla), HTML5, CSS3
- **Banco de Dados**: SQLite com tabelas relacionais
- **Autenticação**: Sistema de sessões Flask
- **Gráficos**: Chart.js
- **Ícones**: Font Awesome
- **Estilização**: CSS3 com variáveis customizadas

## 📦 Instalação

### Pré-requisitos

- Python 3.8+
- pip (gerenciador de pacotes Python)

### Passos para instalação

1. **Clone o repositório**

```bash
git clone (link do git do nosso grupo)
cd studyflow
```

2. **Crie um ambiente virtual**

```bash
python -m venv .venv
```

3. **Ative o ambiente virtual**

**Windows:**

```bash
.venv\Scripts\activate
```

**Linux/Mac:**

```bash
source .venv/bin/activate
```

4. **Instale as dependências**

```bash
pip install -r requirements.txt
```

5. **Execute a aplicação**

```bash
python app.py
```

6. **Acesse no navegador**

```
http://127.0.0.1:5000
```

## 👥 Usuários de Teste

O sistema vem com usuários pré-configurados para teste:

| Usuário      | Senha    | Tipo          | Descrição                                     |
| ------------ | -------- | ------------- | --------------------------------------------- |
| admin        | admin123 | Administrador | Acesso total ao sistema e área administrativa |
| lucas.mendes | lucas123 | Estudante     | Usuário comum com dados de exemplo            |
| ana.beatriz  | ana123   | Estudante     | Usuário comum com dados de exemplo            |

### 🔑 Tipos de Usuário

**Administrador:**

- Acesso à interface administrativa (`admin.html`)
- Gerenciamento completo de usuários
- Criação, edição e exclusão de contas
- Redirecionamento automático para área administrativa

**Usuário Comum:**

- Acesso à interface principal de estudos
- Gerenciamento de seus próprios dados
- Funcionalidades completas de estudo

## 🎯 Como Usar

### 1. **Login e Autenticação**

- Acesse a aplicação em `http://127.0.0.1:5000`
- Faça login com um dos usuários de teste
- **Administradores** são redirecionados automaticamente para `admin.html`
- **Usuários comuns** acessam a interface principal de estudos

### 2. **Para Administradores**

- **Gerenciar Usuários**: Criar, editar e excluir contas
- **Controle de Permissões**: Definir tipo de usuário (admin/user)
- **Monitoramento**: Visualizar lista completa de usuários
- **Logout Seguro**: Retornar à tela de login

### 3. **Para Usuários Comuns**

- **Dashboard**: Visualize suas estatísticas pessoais
- **Sessões de Estudo**: Use o timer Pomodoro e registre sessões
- **Disciplinas**: Crie e organize suas matérias
- **Anotações**: Mantenha suas notas organizadas
- **Agenda**: Planeje seus estudos
- **Relatórios**: Acompanhe seu progresso

## 📁 Estrutura do Projeto

```
studyflow/
├── app.py              # Aplicação Flask principal com autenticação
├── app.js              # Lógica frontend com controle de usuário
├── index.html          # Interface principal (usuários comuns)
├── admin.html          # Interface administrativa (administradores)
├── style.css           # Estilos unificados da aplicação
├── requirements.txt    # Dependências Python
├── studyflow.db       # Banco de dados SQLite com tabelas de usuários
└── README.md          # Documentação
```

## 🔧 API Endpoints

### Autenticação

- `POST /api/login` - Login do usuário com validação
- `POST /api/logout` - Logout seguro do usuário
- `GET /api/current-user` - Informações do usuário atual

### Administração (Apenas Administradores)

- `GET /api/admin/users` - Listar todos os usuários
- `POST /api/admin/users` - Criar novo usuário
- `PUT /api/admin/users/<id>` - Atualizar usuário
- `DELETE /api/admin/users/<id>` - Excluir usuário

### Disciplinas (Por Usuário)

- `GET /api/subjects` - Listar disciplinas do usuário atual
- `POST /api/subjects` - Criar disciplina
- `PUT /api/subjects/<id>` - Atualizar disciplina
- `DELETE /api/subjects/<id>` - Excluir disciplina

### Sessões de Estudo (Por Usuário)

- `GET /api/study-sessions` - Listar sessões do usuário atual
- `POST /api/study-sessions` - Criar sessão
- `DELETE /api/study-sessions/<id>` - Excluir sessão

### Anotações (Por Usuário)

- `GET /api/notes` - Listar anotações do usuário atual
- `POST /api/notes` - Criar anotação
- `PUT /api/notes/<id>` - Atualizar anotação
- `DELETE /api/notes/<id>` - Excluir anotação

### Agenda (Por Usuário)

- `GET /api/schedule` - Listar eventos do usuário atual
- `POST /api/schedule` - Criar evento
- `PUT /api/schedule/<id>` - Atualizar evento
- `DELETE /api/schedule/<id>` - Excluir evento

### Estatísticas (Por Usuário)

- `GET /api/stats/weekly` - Estatísticas semanais do usuário atual

## 🛡️ Segurança

- **Autenticação baseada em sessões** Flask
- **Validação de permissões** em todos os endpoints
- **Isolamento de dados** por usuário
- **Proteção contra acesso não autorizado**
- **Redirecionamento automático** baseado em permissões
- **Logout seguro** com limpeza de sessão

## 🔄 Fluxo de Autenticação

1. **Login**: Usuário insere credenciais
2. **Validação**: Sistema verifica no banco de dados
3. **Sessão**: Criação de sessão segura
4. **Redirecionamento**:
   - Admin → `admin.html`
   - User → Interface principal
5. **Proteção**: Verificação contínua de autenticação
6. **Logout**: Encerramento seguro da sessão

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request
