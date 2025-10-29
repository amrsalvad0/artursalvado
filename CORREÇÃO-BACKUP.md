# Correção do Problema de Restauração de Backup

## Problema Identificado
Quando um backup era restaurado, os dados desapareciam temporariamente da interface e só voltavam a aparecer após reiniciar a aplicação.

## Causa Raiz
O problema estava na função de restauração de backup no arquivo `server.js`. Especificamente:

1. **Linha 412**: O código estava a atribuir a nova conexão da base de dados a `global.db` em vez de substituir a variável local `db`
2. **Referência incorreta**: Todo o resto da aplicação usa a variável local `db`, mas após a restauração, a nova conexão estava em `global.db`
3. **Desconexão**: A aplicação continuava a usar a conexão antiga e fechada

## Correções Implementadas

### 1. Correção da Variável de Conexão
**Antes:**
```javascript
global.db = new sqlite3.Database('./office_manager.db', (reopenErr) => {
```

**Depois:**
```javascript
db = new sqlite3.Database('./office_manager.db', (reopenErr) => {
```

### 2. Reinicialização das Tabelas
Adicionada chamada para `initializeDatabase()` após restaurar o backup para garantir que todas as tabelas estão disponíveis.

### 3. Otimização dos Imports
- Movido `const fs = require('fs');` para o topo do arquivo
- Removidas declarações redundantes de `fs` dentro das funções

## Resultado
Agora quando um backup é restaurado:
1. ✅ A conexão da base de dados é corretamente substituída
2. ✅ Os dados permanecem visíveis na interface após a restauração
3. ✅ Não é necessário reiniciar a aplicação
4. ✅ A funcionalidade funciona corretamente em tempo real

## Como Testar
1. Aceda a http://localhost:3000
2. Vá à secção "Backups" no menu lateral
3. Clique em "Restaurar" num dos backups disponíveis
4. Verifique que os dados continuam visíveis após a restauração
5. Navegue pelas diferentes secções para confirmar que tudo funciona

## Backups de Segurança
O sistema continua a criar automaticamente um backup de segurança antes de cada restauração, guardado com o prefixo `backup-before-restore-`.
