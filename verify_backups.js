const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Script para verificar e manter consistência entre ficheiros físicos e registos na base de dados

function checkBackupConsistency() {
  const db = new sqlite3.Database('./office_manager.db', (err) => {
    if (err) {
      console.error('Erro ao conectar à base de dados:', err.message);
      return;
    }
    
    console.log('=== VERIFICAÇÃO DE CONSISTÊNCIA DOS BACKUPS ===\n');
    
    // Ler ficheiros físicos
    fs.readdir('./backups', (err, files) => {
      if (err) {
        console.error('Erro ao ler pasta de backups:', err.message);
        db.close();
        return;
      }
      
      const backupFiles = files.filter(file => file.endsWith('.db'));
      console.log(`📁 Ficheiros físicos encontrados: ${backupFiles.length}`);
      
      // Consultar registos na base de dados
      db.all('SELECT * FROM backups ORDER BY created_at DESC', (err, dbBackups) => {
        if (err) {
          console.error('Erro ao consultar base de dados:', err.message);
          db.close();
          return;
        }
        
        console.log(`💾 Registos na base de dados: ${dbBackups.length}\n`);
        
        // Verificar ficheiros órfãos (existem fisicamente mas não na BD)
        const registeredFiles = dbBackups.map(b => b.filename);
        const orphanFiles = backupFiles.filter(f => !registeredFiles.includes(f));
        
        if (orphanFiles.length > 0) {
          console.log(`⚠️  FICHEIROS ÓRFÃOS (${orphanFiles.length}):`);
          orphanFiles.forEach(file => console.log(`   - ${file}`));
          console.log('');
        }
        
        // Verificar registos órfãos (existem na BD mas não fisicamente)
        const orphanRecords = dbBackups.filter(b => !backupFiles.includes(b.filename));
        
        if (orphanRecords.length > 0) {
          console.log(`🗑️  REGISTOS ÓRFÃOS (${orphanRecords.length}):`);
          orphanRecords.forEach(record => {
            console.log(`   - ${record.filename} (ID: ${record.id})`);
          });
          console.log('');
        }
        
        // Estatísticas por tipo
        const regularBackups = dbBackups.filter(b => !b.filename.includes('before-restore'));
        const restoreBackups = dbBackups.filter(b => b.filename.includes('before-restore'));
        
        console.log('📊 ESTATÍSTICAS:');
        console.log(`   Backups normais: ${regularBackups.length}`);
        console.log(`   Backups de segurança (antes de restauro): ${restoreBackups.length}`);
        
        // Tamanho total
        const totalSize = dbBackups.reduce((sum, b) => sum + b.size, 0);
        console.log(`   Tamanho total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Backup mais antigo e mais recente
        if (dbBackups.length > 0) {
          const oldest = dbBackups[dbBackups.length - 1];
          const newest = dbBackups[0];
          console.log(`   Mais antigo: ${oldest.filename} (${oldest.created_at})`);
          console.log(`   Mais recente: ${newest.filename} (${newest.created_at})`);
        }
        
        console.log('\n✅ Verificação concluída!');
        
        if (orphanFiles.length === 0 && orphanRecords.length === 0) {
          console.log('🎉 Todos os backups estão consistentes!');
        } else {
          console.log('\n💡 RECOMENDAÇÕES:');
          if (orphanFiles.length > 0) {
            console.log('   - Execute "node sync_backups.js" para registar ficheiros órfãos');
          }
          if (orphanRecords.length > 0) {
            console.log('   - Considere remover registos órfãos da base de dados');
          }
        }
        
        db.close();
      });
    });
  });
}

// Executar verificação
checkBackupConsistency();
