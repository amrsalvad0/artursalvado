const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./office_manager.db', (err) => {
  if (err) {
    console.error('Erro ao conectar à base de dados:', err.message);
  } else {
    console.log('Conectado à base de dados SQLite.');
  }
});

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) {
    console.error('Erro ao listar tabelas:', err.message);
  } else {
    console.log('Tabelas encontradas:');
    rows.forEach(row => {
      console.log('- ' + row.name);
    });
  }
  
  // Verificar especificamente a tabela vehicles
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='vehicles'", (err, row) => {
    if (err) {
      console.error('Erro ao verificar tabela vehicles:', err.message);
    } else if (row) {
      console.log('\n✅ Tabela vehicles existe');
    } else {
      console.log('\n❌ Tabela vehicles NÃO existe');
    }
    db.close();
  });
});
