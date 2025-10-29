// Script de teste para verificar a funcionalidade de restauração de backup
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('🔍 Teste de Restauração de Backup');
console.log('================================');

// Conectar à base de dados atual
const db = new sqlite3.Database('./office_manager.db', (err) => {
  if (err) {
    console.error('Erro ao conectar à base de dados:', err.message);
    return;
  }
  
  console.log('✅ Conectado à base de dados');
  
  // Verificar dados atuais
  db.all('SELECT COUNT(*) as count FROM meetings', (err, rows) => {
    if (err) {
      console.error('Erro ao contar reuniões:', err);
      return;
    }
    
    const currentMeetings = rows[0].count;
    console.log(`📊 Reuniões atuais na base de dados: ${currentMeetings}`);
    
    // Verificar tarefas
    db.all('SELECT COUNT(*) as count FROM tasks', (err, rows) => {
      if (err) {
        console.error('Erro ao contar tarefas:', err);
        return;
      }
      
      const currentTasks = rows[0].count;
      console.log(`📋 Tarefas atuais na base de dados: ${currentTasks}`);
      
      // Verificar contentores
      db.all('SELECT COUNT(*) as count FROM containers', (err, rows) => {
        if (err) {
          console.error('Erro ao contar contentores:', err);
          return;
        }
        
        const currentContainers = rows[0].count;
        console.log(`📦 Contentores atuais na base de dados: ${currentContainers}`);
        
        console.log('\n💡 Para testar a restauração:');
        console.log('1. Aceda a http://localhost:3000');
        console.log('2. Vá à secção de Backups');
        console.log('3. Clique em "Restaurar" num dos backups disponíveis');
        console.log('4. Verifique se os dados continuam visíveis após a restauração');
        console.log('5. Se os dados desaparecerem, recarregue a página para confirmar que estão lá');
        
        db.close();
      });
    });
  });
});
