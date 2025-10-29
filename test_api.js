const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch'); // Se não tiver, use: npm install node-fetch

// Verificar reuniões na base de dados
function checkMeetings() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('./office_manager.db');
        
        db.all('SELECT id, title, status, date_time FROM meetings LIMIT 3', [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                console.log('Reuniões encontradas:');
                console.table(rows);
                resolve(rows);
            }
            db.close();
        });
    });
}

// Testar marcar reunião como concluída
async function testMarkAsCompleted(meetingId) {
    try {
        const response = await fetch(`http://localhost:3000/api/meetings/${meetingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'completed' })
        });
        
        const result = await response.json();
        console.log('Resultado da atualização:', result);
        return result;
    } catch (error) {
        console.error('Erro ao testar API:', error);
    }
}

// Executar testes
async function runTests() {
    console.log('=== Teste da funcionalidade de marcar reunião como concluída ===\n');
    
    // Verificar reuniões existentes
    const meetings = await checkMeetings();
    
    if (meetings.length > 0) {
        const firstMeeting = meetings[0];
        console.log(`\nTestando marcar reunião "${firstMeeting.title}" como concluída...`);
        
        // Testar marcar como concluída
        await testMarkAsCompleted(firstMeeting.id);
        
        // Verificar se foi atualizada
        console.log('\nVerificando se foi atualizada...');
        await checkMeetings();
    } else {
        console.log('Nenhuma reunião encontrada para testar.');
    }
}

runTests();