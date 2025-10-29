const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./office_manager.db');

// Verificar reservas existentes
db.all('SELECT * FROM vehicle_reservations', [], (err, rows) => {
  if (err) {
    console.error('Erro:', err);
    return;
  }
  console.log('Reservas existentes:', rows.length);
  rows.forEach(row => {
    console.log(`ID: ${row.id}, Status: ${row.status}, Utilizador: ${row.user_name}, Fim: ${row.end_date}`);
  });
  
  // Se não há reservas, criar uma de teste no passado para testar auto-conclusão
  if (rows.length === 0) {
    console.log('\nCriando reserva de teste no passado para demonstrar auto-conclusão...');
    
    // Primeiro verificar se há viaturas
    db.all('SELECT * FROM vehicles LIMIT 1', [], (err, vehicles) => {
      if (err) {
        console.error('Erro ao verificar viaturas:', err);
        db.close();
        return;
      }
      
      if (vehicles.length === 0) {
        console.log('Nenhuma viatura encontrada para criar reserva de teste');
        db.close();
        return;
      }
      
      const testId = 'test-reservation-' + Date.now();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
      
      db.run(
        `INSERT INTO vehicle_reservations (id, vehicle_id, user_name, start_date, end_date, purpose, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [testId, vehicles[0].id, 'Utilizador Teste', dayBeforeYesterdayStr, yesterdayStr, 'Teste de auto-conclusão', 'active'],
        function(err) {
          if (err) {
            console.error('Erro ao criar reserva de teste:', err);
          } else {
            console.log('Reserva de teste criada com sucesso!');
            console.log(`A reserva terminará automaticamente quando a aplicação for carregada.`);
          }
          db.close();
        }
      );
    });
  } else {
    db.close();
  }
});
