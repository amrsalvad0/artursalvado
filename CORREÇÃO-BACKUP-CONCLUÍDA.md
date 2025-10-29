# Correções no Sistema de Backup - Artur Salvado

## Problemas Identificados e Corrigidos

### 1. **Apenas um backup visível na aplicação**

**Problema:** Apesar de existirem 13 ficheiros de backup na pasta `backups/`, apenas 1 estava registado na base de dados, fazendo com que apenas esse aparecesse na interface da aplicação.

**Causa:** Os ficheiros de backup foram criados fisicamente mas não foram todos registados corretamente na tabela `backups` da base de dados.

**Solução:** 
- Criado script `sync_backups.js` que sincroniza ficheiros físicos com registos na base de dados
- Todos os 13 backups agora estão registados e visíveis na aplicação

### 2. **Servidor desliga ao restaurar backup**

**Problema:** Ao tentar restaurar um backup, o servidor desligava inesperadamente.

**Causa:** O código original tentava fechar e reabrir a conexão SQLite durante o processo de restauração, o que causava instabilidade no servidor.

**Solução:**
- Removida a lógica de fechar/reabrir conexão durante o restauro
- O processo agora copia simplesmente o ficheiro de backup e responde imediatamente
- A aplicação cliente recarrega automaticamente após o restauro
- Inicialização das tabelas feita em background sem afetar a resposta

## Ficheiros Criados/Modificados

### Novos Ficheiros:
1. **`sync_backups.js`** - Sincroniza ficheiros físicos com a base de dados
2. **`check_backups.js`** - Verifica backups registados na base de dados
3. **`verify_backups.js`** - Verifica consistência entre ficheiros e registos

### Ficheiros Modificados:
1. **`server.js`** - Corrigida função de restauro de backup (linhas ~395-430)

## Scripts de Manutenção

### Sincronizar Backups
```bash
node sync_backups.js
```
Regista na base de dados todos os ficheiros de backup físicos que não estão registados.

### Verificar Backups Registados
```bash
node check_backups.js
```
Lista todos os backups registados na base de dados.

### Verificar Consistência
```bash
node verify_backups.js
```
Verifica se existe consistência entre ficheiros físicos e registos na base de dados.

## Estado Atual

✅ **13 backups registados e visíveis**
- 9 backups normais
- 4 backups de segurança (criados antes de restauros)
- Tamanho total: 1.27 MB

✅ **Restauro de backup corrigido**
- Servidor mantém-se estável durante o processo
- Backup de segurança criado automaticamente antes do restauro
- Interface recarrega automaticamente após restauro

## Funcionalidades de Backup

### Tipos de Backup:
1. **Backup Manual** - Criado pelo utilizador através da interface
2. **Backup de Segurança** - Criado automaticamente antes de cada restauro

### Informações Mostradas:
- Nome do ficheiro
- Data e hora de criação
- Tamanho do ficheiro
- Botão para restaurar

### Processo de Restauro:
1. Utilizador seleciona backup e confirma
2. Sistema cria backup de segurança da base atual
3. Ficheiro de backup é copiado para substituir a base atual
4. Interface recarrega automaticamente
5. Dados são atualizados com o conteúdo do backup restaurado

## Recomendações

1. **Executar verificação periódica:** Use `node verify_backups.js` regularmente
2. **Limpeza de backups antigos:** Considere implementar rotação automática de backups
3. **Monitorização:** Os ficheiros de verificação podem ser integrados num sistema de monitorização

## Data da Correção
04 de setembro de 2025
