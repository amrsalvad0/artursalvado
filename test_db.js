const sqlite3 = require('sqlite3').verbose();

console.log('=== Teste da funcionalidade de marcar reunião como concluída ===\n');

const db = new sqlite3.Database('./office_manager.db');

// Primeiro, verificar reuniões existentes
db.all('SELECT id, title, status, date_time FROM meetings LIMIT 5', [], (err, rows) => {
    if (err) {
        console.error('Erro ao consultar reuniões:', err);
        return;
    }
    
    console.log('Reuniões na base de dados:');
    console.table(rows);
    
    if (rows.length > 0) {
        // Pegar a primeira reunião para testar
        const testMeeting = rows[0];
        console.log(`\nTestando atualizar reunião "${testMeeting.title}" para status "completed"...`);
        
        // Atualizar diretamente na base de dados para testar
        db.run(
            'UPDATE meetings SET status = ? WHERE id = ?',
            ['completed', testMeeting.id],
            function(err) {
                if (err) {
                    console.error('Erro ao atualizar reunião:', err);
                } else {
                    console.log(`Reunião atualizada com sucesso! Linhas afetadas: ${this.changes}`);
                    
                    // Verificar se foi atualizada
                    db.get('SELECT id, title, status FROM meetings WHERE id = ?', [testMeeting.id], (err, updatedMeeting) => {
                        if (err) {
                            console.error('Erro ao verificar atualização:', err);
                        } else {
                            console.log('Status após atualização:');
                            console.table([updatedMeeting]);
                        }
                        
                        db.close();
                    });
                }
            }
        );
    } else {
        console.log('Nenhuma reunião encontrada.');
        db.close();
    }
});