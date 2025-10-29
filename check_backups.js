const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./office_manager.db', (err) => {
  if (err) {
    console.error('Erro ao conectar à base de dados:', err.message);
  } else {
    console.log('Conectado à base de dados SQLite.');
    
    // Verificar backups registados na base de dados
    db.all('SELECT * FROM backups ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        console.error('Erro ao consultar backups:', err.message);
      } else {
        console.log('\n=== BACKUPS REGISTADOS NA BASE DE DADOS ===');
        console.log('Total:', rows.length);
        rows.forEach((backup, index) => {
          console.log(`${index + 1}. ID: ${backup.id}`);
          console.log(`   Ficheiro: ${backup.filename}`);
          console.log(`   Tamanho: ${backup.size} bytes`);
          console.log(`   Criado em: ${backup.created_at}`);
          console.log('');
        });
      }
      
      db.close();
    });
  }
});
