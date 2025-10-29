const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./office_manager.db', (err) => {
  if (err) {
    console.error('Erro ao conectar à base de dados:', err.message);
    return;
  }
  
  console.log('Conectado à base de dados SQLite.');
  
  // Ler todos os ficheiros de backup da pasta
  const backupsDir = './backups';
  fs.readdir(backupsDir, (err, files) => {
    if (err) {
      console.error('Erro ao ler pasta de backups:', err.message);
      db.close();
      return;
    }
    
    // Filtrar apenas ficheiros .db
    const backupFiles = files.filter(file => file.endsWith('.db'));
    console.log(`\nEncontrados ${backupFiles.length} ficheiros de backup na pasta.`);
    
    // Obter backups já registados na base de dados
    db.all('SELECT filename FROM backups', (err, rows) => {
      if (err) {
        console.error('Erro ao consultar backups existentes:', err.message);
        db.close();
        return;
      }
      
      const registeredFiles = rows.map(row => row.filename);
      console.log(`${registeredFiles.length} backups já registados na base de dados.`);
      
      // Encontrar ficheiros não registados
      const unregisteredFiles = backupFiles.filter(file => !registeredFiles.includes(file));
      console.log(`${unregisteredFiles.length} ficheiros não registados encontrados.`);
      
      if (unregisteredFiles.length === 0) {
        console.log('Todos os ficheiros já estão registados.');
        db.close();
        return;
      }
      
      console.log('\\nRegistando ficheiros em falta...');
      
      let processed = 0;
      unregisteredFiles.forEach(filename => {
        const filePath = path.join(backupsDir, filename);
        
        // Obter informações do ficheiro
        fs.stat(filePath, (err, stats) => {
          if (err) {
            console.error(`Erro ao obter informações do ficheiro ${filename}:`, err.message);
            processed++;
            if (processed === unregisteredFiles.length) {
              db.close();
            }
            return;
          }
          
          // Extrair data do nome do ficheiro
          const dateMatch = filename.match(/backup(-before-restore)?-(.+)\\.db$/);
          let createdAt;
          
          if (dateMatch) {
            // Converter formato do timestamp para ISO
            const timestamp = dateMatch[2];
            const isoTimestamp = timestamp.replace(/T/g, 'T').replace(/-(\d{3})Z$/, '.$1Z');
            createdAt = new Date(isoTimestamp).toISOString().replace('T', ' ').replace('Z', '');
          } else {
            // Usar data de modificação do ficheiro
            createdAt = stats.mtime.toISOString().replace('T', ' ').replace('Z', '');
          }
          
          // Inserir na base de dados
          const backupId = uuidv4();
          db.run(
            'INSERT INTO backups (id, filename, size, created_at) VALUES (?, ?, ?, ?)',
            [backupId, filename, stats.size, createdAt],
            function(err) {
              if (err) {
                console.error(`Erro ao registar ${filename}:`, err.message);
              } else {
                console.log(`✓ Registado: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
              }
              
              processed++;
              if (processed === unregisteredFiles.length) {
                console.log(`\\n✅ Sincronização concluída! ${unregisteredFiles.length} ficheiros registados.`);
                db.close();
              }
            }
          );
        });
      });
    });
  });
});
