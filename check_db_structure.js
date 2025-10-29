const sqlite3 = require('sqlite3').verbose();

// Conectar à base de dados
const db = new sqlite3.Database('./office_manager.db');

// Verificar estrutura da tabela containers
db.all("PRAGMA table_info(containers)", (err, rows) => {
  if (err) {
    console.error('Erro:', err);
    return;
  }
  
  console.log('Estrutura da tabela containers:');
  console.log('================================');
  rows.forEach(row => {
    console.log(`${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  // Verificar alguns registos de exemplo
  db.all("SELECT * FROM containers LIMIT 3", (err, containers) => {
    if (err) {
      console.error('Erro:', err);
      return;
    }
    
    console.log('\nExemplo de registos:');
    console.log('===================');
    containers.forEach(container => {
      console.log('ID:', container.id);
      console.log('Fornecedor:', container.supplier);
      console.log('Cliente:', container.client);
      console.log('Status:', container.transit_status);
      console.log('Data chegada:', container.arrival_date);
      console.log('---');
    });
    
    db.close();
  });
});
