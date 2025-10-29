const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar base de dados
const db = new sqlite3.Database('./office_manager.db', (err) => {
  if (err) {
    console.error('Erro ao conectar à base de dados:', err.message);
  } else {
    console.log('Conectado à base de dados SQLite.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Tabela de reuniões
  db.run(`CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    date_time TEXT NOT NULL,
    duration INTEGER,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_type TEXT,
    recurrence_interval INTEGER DEFAULT 1,
    recurrence_end_date TEXT,
    parent_meeting_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Adicionar colunas de recorrência se não existirem
  db.run(`ALTER TABLE meetings ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE`, () => {});
  db.run(`ALTER TABLE meetings ADD COLUMN recurrence_type TEXT`, () => {});
  db.run(`ALTER TABLE meetings ADD COLUMN recurrence_interval INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE meetings ADD COLUMN recurrence_end_date TEXT`, () => {});
  db.run(`ALTER TABLE meetings ADD COLUMN parent_meeting_id TEXT`, () => {});

  // Tabela de tarefas
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    due_date TEXT,
    meeting_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id)
  )`);

  // Tabela de backups
  db.run(`CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'completed'
  )`);

  // Tabela de notas de reunião
  db.run(`CREATE TABLE IF NOT EXISTS meeting_notes (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id)
  )`);

  // Tabela de contentores
  db.run(`CREATE TABLE IF NOT EXISTS containers (
    id TEXT PRIMARY KEY,
    country_origin TEXT,
    supplier TEXT,
    cargo_type TEXT,
    client TEXT,
    internal_order TEXT,
    container_ref TEXT,
    container_size TEXT,
    volumes INTEGER,
    content TEXT,
    transit_status TEXT,
    departure_date TEXT,
    arrival_date TEXT,
    arrival_week TEXT,
    received BOOLEAN DEFAULT 0,
    received_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Adicionar coluna received se não existir (para bases de dados existentes)
  db.run(`ALTER TABLE containers ADD COLUMN received BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao adicionar coluna received:', err.message);
    }
  });

  // Adicionar coluna received_date se não existir
  db.run(`ALTER TABLE containers ADD COLUMN received_date DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Erro ao adicionar coluna received_date:', err.message);
    }
  });

  // Tabela de viaturas
  db.run(`CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    license_plate TEXT UNIQUE NOT NULL,
    year INTEGER,
    vehicle_type TEXT NOT NULL,
    fuel_type TEXT,
    mileage INTEGER DEFAULT 0,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de reservas de viaturas
  db.run(`CREATE TABLE IF NOT EXISTS vehicle_reservations (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    purpose TEXT,
    status TEXT DEFAULT 'active',
    mileage_start INTEGER,
    mileage_end INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
  )`);

  // Tabela de manutenções
  db.run(`CREATE TABLE IF NOT EXISTS vehicle_maintenance (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    description TEXT,
    cost REAL,
    scheduled_date TEXT,
    completed_date TEXT,
    next_maintenance_date TEXT,
    mileage_at_maintenance INTEGER,
    status TEXT DEFAULT 'scheduled',
    priority TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
  )`);

  // Tabela de expedições
  db.run(`CREATE TABLE IF NOT EXISTS expeditions (
    id TEXT PRIMARY KEY,
    expedition_week TEXT,
    priority TEXT,
    expedition_day_week TEXT,
    expedition_date TEXT,
    client TEXT,
    client_manager TEXT,
    content TEXT,
    quantity TEXT,
    current_location TEXT,
    volume_type TEXT,
    delivery_location TEXT,
    observations1 TEXT,
    observations2 TEXT,
    transport_manager TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Remover tabela de contactos (feature descontinuada)
  db.run('DROP TABLE IF EXISTS contacts');
}

// Socket.IO para atualizações em tempo real
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.on('join-meeting', (meetingId) => {
    socket.join(`meeting-${meetingId}`);
    console.log(`Cliente ${socket.id} juntou-se à reunião ${meetingId}`);
  });

  socket.on('meeting-note', (data) => {
    // Guardar nota na base de dados
    const noteId = uuidv4();
    db.run(
      'INSERT INTO meeting_notes (id, meeting_id, content) VALUES (?, ?, ?)',
      [noteId, data.meetingId, data.content],
      function(err) {
        if (!err) {
          const noteData = {
            id: noteId,
            meetingId: data.meetingId,
            content: data.content,
            timestamp: new Date().toISOString()
          };
          io.to(`meeting-${data.meetingId}`).emit('new-note', noteData);
        }
      }
    );
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Rotas da API

// REUNIÕES
app.get('/api/meetings', (req, res) => {
  db.all('SELECT * FROM meetings ORDER BY date_time', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/meetings', (req, res) => {
  const { title, description, date_time, duration, is_recurring, recurrence_type, recurrence_interval, recurrence_end_date } = req.body;
  const id = uuidv4();
  
  if (is_recurring) {
    // Criar reunião recorrente
    createRecurringMeeting(req.body, res);
  } else {
    // Criar reunião única
    db.run(
      'INSERT INTO meetings (id, title, description, date_time, duration) VALUES (?, ?, ?, ?, ?)',
      [id, title, description, date_time, duration],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ id, title, description, date_time, duration, status: 'scheduled' });
        }
      }
    );
  }
});

function createRecurringMeeting(meetingData, res) {
  const { title, description, date_time, duration, recurrence_type, recurrence_interval, recurrence_end_date } = meetingData;
  const parentId = uuidv4();
  const startDate = new Date(date_time);
  const endDate = new Date(recurrence_end_date);
  const meetings = [];
  
  // Criar reunião principal
  meetings.push({
    id: parentId,
    title,
    description,
    date_time,
    duration,
    is_recurring: true,
    recurrence_type,
    recurrence_interval,
    recurrence_end_date,
    parent_meeting_id: null
  });
  
  // Gerar reuniões recorrentes
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Calcular próxima data baseada no tipo de recorrência
    switch (recurrence_type) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + recurrence_interval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * recurrence_interval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + recurrence_interval);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + recurrence_interval);
        break;
    }
    
    if (currentDate <= endDate) {
      meetings.push({
        id: uuidv4(),
        title,
        description,
        date_time: currentDate.toISOString().slice(0, 19),
        duration,
        is_recurring: false,
        recurrence_type: null,
        recurrence_interval: null,
        recurrence_end_date: null,
        parent_meeting_id: parentId
      });
    }
  }
  
  // Inserir todas as reuniões na base de dados
  const stmt = db.prepare(`
    INSERT INTO meetings (id, title, description, date_time, duration, is_recurring, 
                         recurrence_type, recurrence_interval, recurrence_end_date, parent_meeting_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    meetings.forEach(meeting => {
      stmt.run([
        meeting.id,
        meeting.title,
        meeting.description,
        meeting.date_time,
        meeting.duration,
        meeting.is_recurring,
        meeting.recurrence_type,
        meeting.recurrence_interval,
        meeting.recurrence_end_date,
        meeting.parent_meeting_id
      ]);
    });
    
    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
      } else {
        res.json({ 
          message: `Criadas ${meetings.length} reuniões recorrentes`,
          parent_id: parentId,
          meetings_count: meetings.length
        });
      }
    });
  });
  
  stmt.finalize();
}

app.put('/api/meetings/:id', (req, res) => {
  const { title, description, date_time, duration, status, notes } = req.body;
  const { id } = req.params;
  
  // Primeiro, buscar os dados atuais da reunião
  db.get('SELECT * FROM meetings WHERE id = ?', [id], (err, meeting) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!meeting) {
      return res.status(404).json({ error: 'Reunião não encontrada' });
    }
    
    // Usar os valores fornecidos ou manter os existentes
    const updatedData = {
      title: title !== undefined ? title : meeting.title,
      description: description !== undefined ? description : meeting.description,
      date_time: date_time !== undefined ? date_time : meeting.date_time,
      duration: duration !== undefined ? duration : meeting.duration,
      status: status !== undefined ? status : meeting.status,
      notes: notes !== undefined ? notes : meeting.notes
    };
    
    db.run(
      'UPDATE meetings SET title = ?, description = ?, date_time = ?, duration = ?, status = ?, notes = ? WHERE id = ?',
      [updatedData.title, updatedData.description, updatedData.date_time, updatedData.duration, updatedData.status, updatedData.notes, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          // Retornar os dados atualizados
          res.json({ 
            message: 'Reunião atualizada com sucesso', 
            meeting: { ...meeting, ...updatedData, id }
          });
        }
      }
    );
  });
});

app.delete('/api/meetings/:id', (req, res) => {
  const { id } = req.params;
  const { deleteAll } = req.query;
  
  if (deleteAll === 'true') {
    // Eliminar toda a série de reuniões recorrentes
    db.get('SELECT parent_meeting_id FROM meetings WHERE id = ?', [id], (err, meeting) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const parentId = meeting.parent_meeting_id || id;
      
      db.run('DELETE FROM meetings WHERE id = ? OR parent_meeting_id = ?', [parentId, parentId], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Série de reuniões eliminada com sucesso', deleted_count: this.changes });
        }
      });
    });
  } else {
    // Eliminar apenas esta reunião
    db.run('DELETE FROM meetings WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Reunião eliminada com sucesso' });
      }
    });
  }
});

// TAREFAS
app.get('/api/tasks', (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/tasks', (req, res) => {
  const { title, description, priority, due_date, meeting_id } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO tasks (id, title, description, priority, due_date, meeting_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title, description, priority, due_date, meeting_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id, title, description, priority, due_date, meeting_id, status: 'pending' });
      }
    }
  );
});

app.put('/api/tasks/:id', (req, res) => {
  const { title, description, priority, status, due_date } = req.body;
  const { id } = req.params;
  
  db.run(
    'UPDATE tasks SET title = ?, description = ?, priority = ?, status = ?, due_date = ? WHERE id = ?',
    [title, description, priority, status, due_date, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Tarefa atualizada com sucesso' });
      }
    }
  );
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: 'Tarefa eliminada com sucesso' });
    }
  });
});

// NOTAS DE REUNIÃO
app.get('/api/meetings/:id/notes', (req, res) => {
  const { id } = req.params;
  
  db.all(
    'SELECT * FROM meeting_notes WHERE meeting_id = ? ORDER BY timestamp',
    [id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// BACKUPS
app.get('/api/backups', (req, res) => {
  db.all('SELECT * FROM backups ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/backups', (req, res) => {
  const backupId = uuidv4();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.db`;
  
  // Criar backup da base de dados
  fs.copyFile('./office_manager.db', `./backups/${filename}`, (err) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao criar backup' });
    } else {
      // Registar backup na base de dados
      fs.stat(`./backups/${filename}`, (statErr, stats) => {
        const size = statErr ? 0 : stats.size;
        
        db.run(
          'INSERT INTO backups (id, filename, size) VALUES (?, ?, ?)',
          [backupId, filename, size],
          function(dbErr) {
            if (dbErr) {
              res.status(500).json({ error: dbErr.message });
            } else {
              res.json({ 
                id: backupId, 
                filename, 
                size, 
                status: 'completed',
                created_at: new Date().toISOString()
              });
            }
          }
        );
      });
    }
  });
});

// Restaurar backup
app.post('/api/backups/:id/restore', (req, res) => {
  const backupId = req.params.id;
  
  // Buscar informações do backup
  db.get('SELECT * FROM backups WHERE id = ?', [backupId], (err, backup) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }
    
    const backupPath = `./backups/${backup.filename}`;
    
    // Verificar se o arquivo de backup existe
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Arquivo de backup não encontrado' });
    }
    
    // Criar backup atual antes de restaurar
    const currentBackupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentBackupFilename = `backup-before-restore-${currentBackupTimestamp}.db`;
    
    fs.copyFile('./office_manager.db', `./backups/${currentBackupFilename}`, (backupErr) => {
      if (backupErr) {
        console.error('Erro ao criar backup de segurança:', backupErr);
        // Continuar com a restauração mesmo se o backup de segurança falhar
      }
      
      // Restaurar o backup
      fs.copyFile(backupPath, './office_manager.db', (restoreErr) => {
        if (restoreErr) {
          return res.status(500).json({ error: 'Erro ao restaurar backup' });
        }
        
        console.log(`Backup ${backup.filename} restaurado com sucesso`);
        
        // Responder imediatamente sem fechar a conexão
        // A aplicação cliente irá recarregar e reconectar automaticamente
        res.json({ 
          success: true, 
          message: 'Backup restaurado com sucesso. A aplicação será recarregada.',
          restoredFrom: backup.filename,
          restoredAt: new Date().toISOString(),
          requiresReload: true
        });
        
        // Opcional: reinicializar as tabelas em background
        setTimeout(() => {
          initializeDatabase();
        }, 100);
      });
    });
  });
});

// Limpar backups antigos (mais de 15 dias)
app.delete('/api/backups/cleanup', (req, res) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 15);
  const cutoffDateStr = cutoffDate.toISOString();
  
  // Buscar backups mais antigos que 15 dias
  db.all('SELECT * FROM backups WHERE created_at < ?', [cutoffDateStr], (err, oldBackups) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (oldBackups.length === 0) {
      return res.json({ 
        message: 'Nenhum backup antigo encontrado para limpeza.',
        deletedCount: 0,
        spaceSaved: 0
      });
    }
    
    let deletedCount = 0;
    let spaceSaved = 0;
    let errors = [];
    
    // Função para processar cada backup
    const processBackup = (index) => {
      if (index >= oldBackups.length) {
        // Todos os backups foram processados
        if (deletedCount > 0) {
          // Remover registos da base de dados
          const ids = oldBackups.slice(0, deletedCount).map(b => b.id);
          const placeholders = ids.map(() => '?').join(',');
          
          db.run(`DELETE FROM backups WHERE id IN (${placeholders})`, ids, (deleteErr) => {
            if (deleteErr) {
              console.error('Erro ao remover registos da base de dados:', deleteErr);
            }
            
            res.json({
              message: `${deletedCount} backup(s) antigo(s) removido(s) com sucesso.`,
              deletedCount,
              spaceSaved: Math.round(spaceSaved / 1024 / 1024 * 100) / 100, // MB
              errors: errors.length > 0 ? errors : undefined
            });
          });
        } else {
          res.json({
            message: 'Não foi possível remover nenhum backup.',
            deletedCount: 0,
            spaceSaved: 0,
            errors
          });
        }
        return;
      }
      
      const backup = oldBackups[index];
      const backupPath = `./backups/${backup.filename}`;
      
      // Verificar se o arquivo existe antes de tentar apagar
      fs.access(backupPath, fs.constants.F_OK, (accessErr) => {
        if (accessErr) {
          errors.push(`Arquivo ${backup.filename} não encontrado`);
          processBackup(index + 1);
          return;
        }
        
        // Apagar o arquivo
        fs.unlink(backupPath, (unlinkErr) => {
          if (unlinkErr) {
            errors.push(`Erro ao apagar ${backup.filename}: ${unlinkErr.message}`);
          } else {
            deletedCount++;
            spaceSaved += backup.size || 0;
            console.log(`Backup removido: ${backup.filename}`);
          }
          
          processBackup(index + 1);
        });
      });
    };
    
    // Iniciar o processamento
    processBackup(0);
  });
});

// CONTENTORES
app.get('/api/containers', (req, res) => {
  db.all('SELECT * FROM containers ORDER BY arrival_date', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/containers/alerts', (req, res) => {
  const today = new Date();
  const next5Days = new Date();
  next5Days.setDate(today.getDate() + 5);
  
  // Converter para formato YYYY-MM-DD
  const todayStr = today.toISOString().split('T')[0];
  const next5DaysStr = next5Days.toISOString().split('T')[0];
  
  db.all(
    'SELECT * FROM containers WHERE arrival_date BETWEEN ? AND ? AND (received IS NULL OR received = 0) ORDER BY arrival_date',
    [todayStr, next5DaysStr],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

app.post('/api/containers/import-excel', (req, res) => {
  try {
    const excelPath = path.join(__dirname, 'contentores.xlsx');
    
    // Verificar se o ficheiro existe
    if (!require('fs').existsSync(excelPath)) {
      return res.status(404).json({ error: 'Ficheiro contentores.xlsx não encontrado' });
    }
    
    // Ler o ficheiro Excel
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Limpar tabela de contentores
    db.run('DELETE FROM containers', (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao limpar tabela de contentores' });
      }
      
      let processed = 0;
      let errors = 0;
      
      // Processar cada linha (ignorar cabeçalho se existir)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        if (row.length < 13) continue; // Ignorar linhas incompletas
        
        const id = uuidv4();
        const countryOrigin = row[0] || '';
        const supplier = row[1] || '';
        const cargoType = row[2] || '';
        const client = row[3] || '';
        const internalOrder = row[4] || '';
        const containerRef = row[5] || '';
        const containerSize = row[6] || '';
        const volumes = parseInt(row[7]) || 0;
        const content = row[8] || '';
        const transitStatus = row[9] || '';
        const departureDate = formatExcelDate(row[10]);
        const arrivalDate = formatExcelDate(row[11]);
        const arrivalWeek = row[12] || '';
        
        db.run(
          `INSERT INTO containers (
            id, country_origin, supplier, cargo_type, client, internal_order,
            container_ref, container_size, volumes, content, transit_status,
            departure_date, arrival_date, arrival_week
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, countryOrigin, supplier, cargoType, client, internalOrder,
            containerRef, containerSize, volumes, content, transitStatus,
            departureDate, arrivalDate, arrivalWeek
          ],
          function(err) {
            if (err) {
              errors++;
              console.error('Erro ao inserir contentor:', err.message);
            } else {
              processed++;
            }
          }
        );
      }
      
      // Aguardar que todas as inserções sejam processadas
      setTimeout(() => {
        res.json({ 
          message: 'Importação concluída',
          processed: processed,
          errors: errors
        });
      }, 1000);
    });
    
  } catch (error) {
    console.error('Erro ao importar Excel:', error);
    res.status(500).json({ error: 'Erro ao processar ficheiro Excel' });
  }
});

// Função auxiliar para formatar datas do Excel
function formatExcelDate(excelDate) {
  if (!excelDate) return '';
  
  // Se já é uma string de data, retornar como está
  if (typeof excelDate === 'string') return excelDate;
  
  // Se é um número (data do Excel), converter
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  return '';
}

// Marcar contentor como recebido
app.put('/api/containers/:id/received', (req, res) => {
  const { id } = req.params;
  const receivedDate = new Date().toISOString();
  
  db.run(
    'UPDATE containers SET received = 1, received_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [receivedDate, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Contentor não encontrado' });
      } else {
        res.json({ 
          message: 'Contentor marcado como recebido',
          receivedDate: receivedDate
        });
      }
    }
  );
});

// Marcar contentor como não recebido
app.put('/api/containers/:id/unreceived', (req, res) => {
  const { id } = req.params;
  
  db.run(
    'UPDATE containers SET received = 0, received_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Contentor não encontrado' });
      } else {
        res.json({ message: 'Contentor marcado como não recebido' });
      }
    }
  );
});

// EXPEDIÇÕES
app.get('/api/expeditions', (req, res) => {
  db.all('SELECT * FROM expeditions ORDER BY expedition_date', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/expeditions/alerts', (req, res) => {
  const today = new Date();
  const next5WorkDays = new Date();
  
  // Calcular próximos 5 dias úteis (excluindo fins de semana)
  let daysAdded = 0;
  let currentDate = new Date(today);
  
  while (daysAdded < 5) {
    currentDate.setDate(currentDate.getDate() + 1);
    // Se não é sábado (6) nem domingo (0)
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      daysAdded++;
    }
  }
  
  // Converter para formato YYYY-MM-DD
  const todayStr = today.toISOString().split('T')[0];
  const next5WorkDaysStr = currentDate.toISOString().split('T')[0];
  
  db.all(
    'SELECT * FROM expeditions WHERE expedition_date BETWEEN ? AND ? ORDER BY expedition_date, priority',
    [todayStr, next5WorkDaysStr],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

app.post('/api/expeditions/import-excel', (req, res) => {
  try {
    const excelPath = path.join(__dirname, 'expedicoes.xlsx');
    
    // Verificar se o ficheiro existe
    if (!require('fs').existsSync(excelPath)) {
      return res.status(404).json({ error: 'Ficheiro expedicoes.xlsx não encontrado' });
    }
    
    // Ler o ficheiro Excel
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Limpar tabela de expedições
    db.run('DELETE FROM expeditions', (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao limpar tabela de expedições' });
      }
      
      let processed = 0;
      let errors = 0;
      
      // Processar cada linha (ignorar cabeçalho se existir)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        if (row.length < 15) continue; // Ignorar linhas incompletas
        
        const id = uuidv4();
        const expeditionWeek = row[0] || '';
        const priority = row[1] || '';
        const expeditionDayWeek = row[2] || '';
        const expeditionDate = formatExcelDate(row[3]);
        const client = row[4] || '';
        const clientManager = row[5] || '';
        const content = row[6] || '';
        const quantity = row[7] || '';
        const currentLocation = row[8] || '';
        const volumeType = row[9] || '';
        const deliveryLocation = row[10] || '';
        const observations1 = row[11] || '';
        const observations2 = row[12] || '';
        const transportManager = row[13] || '';
        const status = row[14] || '';
        
        db.run(
          `INSERT INTO expeditions (
            id, expedition_week, priority, expedition_day_week, expedition_date,
            client, client_manager, content, quantity, current_location,
            volume_type, delivery_location, observations1, observations2,
            transport_manager, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, expeditionWeek, priority, expeditionDayWeek, expeditionDate,
            client, clientManager, content, quantity, currentLocation,
            volumeType, deliveryLocation, observations1, observations2,
            transportManager, status
          ],
          function(err) {
            if (err) {
              errors++;
              console.error('Erro ao inserir expedição:', err.message);
            } else {
              processed++;
            }
          }
        );
      }
      
      // Aguardar que todas as inserções sejam processadas
      setTimeout(() => {
        res.json({ 
          message: 'Importação concluída',
          processed: processed,
          errors: errors
        });
      }, 1000);
    });
    
  } catch (error) {
    console.error('Erro ao importar Excel:', error);
    res.status(500).json({ error: 'Erro ao processar ficheiro Excel' });
  }
});

// CONTACTOS removidos

// TELEFONES INTERNOS
app.get('/api/phones', (req, res) => {
  try {
    const excelPath = path.join(__dirname, 'telefones.xlsx');
    
    // Verificar se o ficheiro existe
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ error: 'Ficheiro telefones.xlsx não encontrado' });
    }
    
    // Ler o ficheiro Excel
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Processar dados
    const phones = [];
    
    // Processar cada linha (ignorar cabeçalho se existir)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (row.length < 3) continue; // Ignorar linhas incompletas
      
      const sector = row[0] || '';
      const name = row[1] || '';
      const extension = row[2] || '';
      
      // Apenas adicionar se houver dados válidos
      if (sector || name || extension) {
        phones.push({
          sector: sector,
          name: name,
          extension: extension
        });
      }
    }
    
    res.json(phones);
    
  } catch (error) {
    console.error('Erro ao ler ficheiro de telefones:', error);
    res.status(500).json({ error: 'Erro ao processar ficheiro de telefones' });
  }
});

// VIATURAS
// Obter todas as viaturas
app.get('/api/vehicles', (req, res) => {
  db.all('SELECT * FROM vehicles ORDER BY brand, model', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Criar nova viatura
app.post('/api/vehicles', (req, res) => {
  const { brand, model, licensePlate, year, vehicleType, fuelType, mileage } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO vehicles (id, brand, model, license_plate, year, vehicle_type, fuel_type, mileage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, brand, model, licensePlate, year, vehicleType, fuelType, mileage || 0],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Matrícula já existe' });
        } else {
          res.status(500).json({ error: err.message });
        }
      } else {
        res.status(201).json({ 
          id, 
          message: 'Viatura criada com sucesso',
          brand,
          model,
          licensePlate
        });
      }
    }
  );
});

// Atualizar viatura
app.put('/api/vehicles/:id', (req, res) => {
  const { id } = req.params;
  const { brand, model, licensePlate, year, vehicleType, fuelType, mileage, status } = req.body;
  
  db.run(
    `UPDATE vehicles SET 
     brand = ?, model = ?, license_plate = ?, year = ?, 
     vehicle_type = ?, fuel_type = ?, mileage = ?, status = ?,
     updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [brand, model, licensePlate, year, vehicleType, fuelType, mileage, status, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Matrícula já existe' });
        } else {
          res.status(500).json({ error: err.message });
        }
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Viatura não encontrada' });
      } else {
        res.json({ message: 'Viatura atualizada com sucesso' });
      }
    }
  );
});

// Eliminar viatura
app.delete('/api/vehicles/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM vehicles WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Viatura não encontrada' });
    } else {
      res.json({ message: 'Viatura eliminada com sucesso' });
    }
  });
});

// RESERVAS DE VIATURAS
// Obter todas as reservas
app.get('/api/vehicle-reservations', (req, res) => {
  const query = `
    SELECT vr.*, v.brand, v.model, v.license_plate 
    FROM vehicle_reservations vr
    JOIN vehicles v ON vr.vehicle_id = v.id
    ORDER BY vr.start_date DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Criar nova reserva
app.post('/api/vehicle-reservations', (req, res) => {
  const { vehicleId, userName, startDate, endDate, purpose } = req.body;
  const id = uuidv4();
  
  // Verificar se a viatura está disponível no período
  const checkQuery = `
    SELECT COUNT(*) as conflicts
    FROM vehicle_reservations 
    WHERE vehicle_id = ? 
    AND status = 'active'
    AND (
      (start_date <= ? AND end_date >= ?) OR
      (start_date <= ? AND end_date >= ?) OR
      (start_date >= ? AND end_date <= ?)
    )
  `;
  
  db.get(checkQuery, [vehicleId, startDate, startDate, endDate, endDate, startDate, endDate], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row.conflicts > 0) {
      res.status(400).json({ error: 'Viatura já reservada para esse período' });
    } else {
      db.run(
        `INSERT INTO vehicle_reservations (id, vehicle_id, user_name, start_date, end_date, purpose)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, vehicleId, userName, startDate, endDate, purpose],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
          } else {
            res.status(201).json({ 
              id, 
              message: 'Reserva criada com sucesso',
              vehicleId,
              userName,
              startDate,
              endDate
            });
          }
        }
      );
    }
  });
});

// Atualizar reserva
app.put('/api/vehicle-reservations/:id', (req, res) => {
  const { id } = req.params;
  const { vehicleId, userName, startDate, endDate, purpose, status, mileageStart, mileageEnd } = req.body;
  
  db.run(
    `UPDATE vehicle_reservations SET 
     vehicle_id = ?, user_name = ?, start_date = ?, end_date = ?, 
     purpose = ?, status = ?, mileage_start = ?, mileage_end = ?
     WHERE id = ?`,
    [vehicleId, userName, startDate, endDate, purpose, status, mileageStart, mileageEnd, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Reserva não encontrada' });
      } else {
        // Se a reserva foi completada e tem quilometragem final, atualizar a viatura
        if (status === 'completed' && mileageEnd) {
          db.run(
            'UPDATE vehicles SET mileage = ? WHERE id = ?',
            [mileageEnd, vehicleId]
          );
        }
        res.json({ message: 'Reserva atualizada com sucesso' });
      }
    }
  );
});

// Eliminar reserva
app.delete('/api/vehicle-reservations/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM vehicle_reservations WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Reserva não encontrada' });
    } else {
      res.json({ message: 'Reserva eliminada com sucesso' });
    }
  });
});

// MANUTENÇÕES
// Obter todas as manutenções
app.get('/api/vehicle-maintenance', (req, res) => {
  const query = `
    SELECT vm.*, v.brand, v.model, v.license_plate 
    FROM vehicle_maintenance vm
    JOIN vehicles v ON vm.vehicle_id = v.id
    ORDER BY vm.scheduled_date DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Criar nova manutenção
app.post('/api/vehicle-maintenance', (req, res) => {
  const { vehicleId, maintenanceType, description, cost, scheduledDate, nextMaintenanceDate, mileageAtMaintenance, priority } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO vehicle_maintenance (id, vehicle_id, maintenance_type, description, cost, scheduled_date, next_maintenance_date, mileage_at_maintenance, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, vehicleId, maintenanceType, description, cost, scheduledDate, nextMaintenanceDate, mileageAtMaintenance, priority || 'medium'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({ 
          id, 
          message: 'Manutenção agendada com sucesso',
          vehicleId,
          maintenanceType,
          scheduledDate
        });
      }
    }
  );
});

// Atualizar manutenção
app.put('/api/vehicle-maintenance/:id', (req, res) => {
  const { id } = req.params;
  const { vehicleId, maintenanceType, description, cost, scheduledDate, completedDate, nextMaintenanceDate, mileageAtMaintenance, status, priority } = req.body;
  
  db.run(
    `UPDATE vehicle_maintenance SET 
     vehicle_id = ?, maintenance_type = ?, description = ?, cost = ?, 
     scheduled_date = ?, completed_date = ?, next_maintenance_date = ?, 
     mileage_at_maintenance = ?, status = ?, priority = ?
     WHERE id = ?`,
    [vehicleId, maintenanceType, description, cost, scheduledDate, completedDate, nextMaintenanceDate, mileageAtMaintenance, status, priority, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Manutenção não encontrada' });
      } else {
        res.json({ message: 'Manutenção atualizada com sucesso' });
      }
    }
  );
});

// Eliminar manutenção
app.delete('/api/vehicle-maintenance/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM vehicle_maintenance WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Manutenção não encontrada' });
    } else {
      res.json({ message: 'Manutenção eliminada com sucesso' });
    }
  });
});

// Obter alertas de manutenção (para dashboard)
app.get('/api/maintenance-alerts', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const query = `
    SELECT vm.*, v.brand, v.model, v.license_plate 
    FROM vehicle_maintenance vm
    JOIN vehicles v ON vm.vehicle_id = v.id
    WHERE vm.status = 'scheduled' 
    AND (
      vm.scheduled_date <= ? OR 
      vm.next_maintenance_date <= ?
    )
    ORDER BY vm.scheduled_date ASC
  `;
  
  db.all(query, [nextWeek, nextWeek], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// RELATÓRIOS DE VEÍCULOS
app.get('/api/vehicles/:id/report', (req, res) => {
  const vehicleId = req.params.id;
  
  // Query para obter dados completos do veículo
  const vehicleQuery = 'SELECT * FROM vehicles WHERE id = ?';
  
  // Query para obter reservas
  const reservationsQuery = `
    SELECT * FROM vehicle_reservations 
    WHERE vehicle_id = ? 
    ORDER BY start_date DESC
  `;
  
  // Query para obter manutenções
  const maintenanceQuery = `
    SELECT * FROM vehicle_maintenance 
    WHERE vehicle_id = ? 
    ORDER BY scheduled_date DESC
  `;
  
  // Query para estatísticas
  const statsQuery = `
    SELECT 
      COUNT(vr.id) as total_reservations,
      SUM(CASE WHEN vr.status = 'completed' THEN 1 ELSE 0 END) as completed_reservations,
      COUNT(vm.id) as total_maintenances,
      SUM(CASE WHEN vm.status = 'completed' THEN 1 ELSE 0 END) as completed_maintenances,
      SUM(vm.cost) as total_maintenance_cost,
      MAX(vr.mileage_end) as current_mileage
    FROM vehicles v
    LEFT JOIN vehicle_reservations vr ON v.id = vr.vehicle_id
    LEFT JOIN vehicle_maintenance vm ON v.id = vm.vehicle_id
    WHERE v.id = ?
    GROUP BY v.id
  `;
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.get(vehicleQuery, [vehicleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(reservationsQuery, [vehicleId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(maintenanceQuery, [vehicleId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(statsQuery, [vehicleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    })
  ])
  .then(([vehicle, reservations, maintenances, stats]) => {
    if (!vehicle) {
      return res.status(404).json({ error: 'Veículo não encontrado' });
    }
    
    res.json({
      vehicle,
      reservations,
      maintenances,
      stats: stats || {
        total_reservations: 0,
        completed_reservations: 0,
        total_maintenances: 0,
        completed_maintenances: 0,
        total_maintenance_cost: 0,
        current_mileage: vehicle.mileage
      }
    });
  })
  .catch(err => {
    console.error('Erro ao gerar relatório:', err);
    res.status(500).json({ error: err.message });
  });
});

app.post('/api/vehicles/:id/report/pdf', async (req, res) => {
  const vehicleId = req.params.id;
  const { dateFrom, dateTo } = req.body;
  
  try {
    // Primeiro obter os dados do relatório
    const reportResponse = await new Promise((resolve, reject) => {
      // Simular uma requisição interna
      const vehicleQuery = 'SELECT * FROM vehicles WHERE id = ?';
      const reservationsQuery = `
        SELECT * FROM vehicle_reservations 
        WHERE vehicle_id = ? 
        ${dateFrom ? `AND start_date >= '${dateFrom}'` : ''}
        ${dateTo ? `AND end_date <= '${dateTo}'` : ''}
        ORDER BY start_date DESC
      `;
      const maintenanceQuery = `
        SELECT * FROM vehicle_maintenance 
        WHERE vehicle_id = ? 
        ${dateFrom ? `AND scheduled_date >= '${dateFrom}'` : ''}
        ${dateTo ? `AND scheduled_date <= '${dateTo}'` : ''}
        ORDER BY scheduled_date DESC
      `;
      
      Promise.all([
        new Promise((resolve, reject) => {
          db.get(vehicleQuery, [vehicleId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        }),
        new Promise((resolve, reject) => {
          db.all(reservationsQuery, [vehicleId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        }),
        new Promise((resolve, reject) => {
          db.all(maintenanceQuery, [vehicleId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        })
      ])
      .then(([vehicle, reservations, maintenances]) => {
        resolve({ vehicle, reservations, maintenances });
      })
      .catch(reject);
    });
    
    if (!reportResponse.vehicle) {
      return res.status(404).json({ error: 'Veículo não encontrado' });
    }
    
    const puppeteer = require('puppeteer');
    
    // Gerar HTML para o PDF
    const htmlContent = generateReportHTML(reportResponse, dateFrom, dateTo);
    
    // Gerar PDF
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });
    
    await browser.close();
    
    const filename = `relatorio_veiculo_${reportResponse.vehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório PDF' });
  }
});

function generateReportHTML(data, dateFrom, dateTo) {
  const { vehicle, reservations, maintenances } = data;
  
  const currentDate = new Date().toLocaleDateString('pt-PT');
  const periodText = dateFrom && dateTo 
    ? `Período: ${new Date(dateFrom).toLocaleDateString('pt-PT')} - ${new Date(dateTo).toLocaleDateString('pt-PT')}`
    : 'Período: Todos os registos';
  
  const totalCost = maintenances.reduce((sum, m) => sum + (m.cost || 0), 0);
  const completedReservations = reservations.filter(r => r.status === 'completed').length;
  const completedMaintenances = maintenances.filter(m => m.status === 'completed').length;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 3px solid #667eea;
                padding-bottom: 20px;
            }
            .company-name {
                font-size: 24px;
                font-weight: bold;
                color: #667eea;
                margin-bottom: 5px;
            }
            .report-title {
                font-size: 20px;
                color: #333;
                margin: 10px 0;
            }
            .report-date {
                color: #666;
                font-size: 14px;
            }
            .vehicle-info {
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 30px;
                border-left: 5px solid #667eea;
            }
            .vehicle-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .detail-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #dee2e6;
            }
            .detail-label {
                font-weight: 600;
                color: #495057;
            }
            .detail-value {
                color: #333;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: white;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                border: 1px solid #dee2e6;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .stat-number {
                font-size: 24px;
                font-weight: bold;
                color: #667eea;
                display: block;
            }
            .stat-label {
                font-size: 12px;
                color: #6c757d;
                text-transform: uppercase;
                margin-top: 5px;
            }
            .section {
                margin-bottom: 30px;
            }
            .section-title {
                font-size: 18px;
                font-weight: bold;
                color: #333;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid #667eea;
            }
            .table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .table th {
                background: #667eea;
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: 600;
                font-size: 14px;
            }
            .table td {
                padding: 12px;
                border-bottom: 1px solid #dee2e6;
                font-size: 13px;
            }
            .table tr:last-child td {
                border-bottom: none;
            }
            .table tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            .status {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
            }
            .status-completed { background: #d4edda; color: #155724; }
            .status-active { background: #d1ecf1; color: #0c5460; }
            .status-scheduled { background: #fff3cd; color: #856404; }
            .status-cancelled { background: #f8d7da; color: #721c24; }
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 12px;
                color: #6c757d;
                border-top: 1px solid #dee2e6;
                padding-top: 20px;
            }
            .no-data {
                text-align: center;
                padding: 20px;
                color: #6c757d;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-name">Artur Salvado</div>
            <div class="report-title">Relatório Detalhado de Veículo</div>
            <div class="report-date">Gerado em ${currentDate} | ${periodText}</div>
        </div>

        <div class="vehicle-info">
            <h3>Informações do Veículo</h3>
            <div class="vehicle-details">
                <div class="detail-item">
                    <span class="detail-label">Matrícula:</span>
                    <span class="detail-value">${vehicle.license_plate}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Marca:</span>
                    <span class="detail-value">${vehicle.brand}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Modelo:</span>
                    <span class="detail-value">${vehicle.model}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ano:</span>
                    <span class="detail-value">${vehicle.year}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tipo:</span>
                    <span class="detail-value">${vehicle.vehicle_type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Combustível:</span>
                    <span class="detail-value">${vehicle.fuel_type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Quilometragem:</span>
                    <span class="detail-value">${vehicle.mileage.toLocaleString()} km</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Estado:</span>
                    <span class="detail-value">${vehicle.status}</span>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-number">${reservations.length}</span>
                <span class="stat-label">Total Reservas</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${completedReservations}</span>
                <span class="stat-label">Reservas Concluídas</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${maintenances.length}</span>
                <span class="stat-label">Total Manutenções</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">€${totalCost.toFixed(2)}</span>
                <span class="stat-label">Custo Manutenções</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">📅 Histórico de Reservas</div>
            ${reservations.length > 0 ? `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Utilizador</th>
                            <th>Data Início</th>
                            <th>Data Fim</th>
                            <th>Finalidade</th>
                            <th>Estado</th>
                            <th>Km Inicial</th>
                            <th>Km Final</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reservations.map(reservation => `
                            <tr>
                                <td>${reservation.user_name}</td>
                                <td>${new Date(reservation.start_date).toLocaleDateString('pt-PT')}</td>
                                <td>${new Date(reservation.end_date).toLocaleDateString('pt-PT')}</td>
                                <td>${reservation.purpose || '-'}</td>
                                <td><span class="status status-${reservation.status}">${reservation.status}</span></td>
                                <td>${reservation.mileage_start || '-'}</td>
                                <td>${reservation.mileage_end || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="no-data">Nenhuma reserva encontrada para o período selecionado</div>'}
        </div>

        <div class="section">
            <div class="section-title">🔧 Histórico de Manutenções</div>
            ${maintenances.length > 0 ? `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Descrição</th>
                            <th>Data Agendada</th>
                            <th>Data Conclusão</th>
                            <th>Custo</th>
                            <th>Estado</th>
                            <th>Quilometragem</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${maintenances.map(maintenance => `
                            <tr>
                                <td>${maintenance.maintenance_type}</td>
                                <td>${maintenance.description || '-'}</td>
                                <td>${maintenance.scheduled_date ? new Date(maintenance.scheduled_date).toLocaleDateString('pt-PT') : '-'}</td>
                                <td>${maintenance.completed_date ? new Date(maintenance.completed_date).toLocaleDateString('pt-PT') : '-'}</td>
                                <td>€${(maintenance.cost || 0).toFixed(2)}</td>
                                <td><span class="status status-${maintenance.status}">${maintenance.status}</span></td>
                                <td>${maintenance.mileage_at_maintenance || '-'} km</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="no-data">Nenhuma manutenção encontrada para o período selecionado</div>'}
        </div>

        <div class="footer">
            <p>Este relatório foi gerado automaticamente pelo sistema Artur Salvado</p>
            <p>Para mais informações, contacte o administrador do sistema</p>
        </div>
    </body>
    </html>
  `;
}

// Obter estatísticas da frota
app.get('/api/fleet-stats', (req, res) => {
  const queries = {
    totalVehicles: 'SELECT COUNT(*) as count FROM vehicles',
    availableVehicles: 'SELECT COUNT(*) as count FROM vehicles WHERE status = "available"',
    activeReservations: 'SELECT COUNT(*) as count FROM vehicle_reservations WHERE status = "active"',
    pendingMaintenance: 'SELECT COUNT(*) as count FROM vehicle_maintenance WHERE status = "scheduled"'
  };
  
  const stats = {};
  let completed = 0;
  const total = Object.keys(queries).length;
  
  Object.keys(queries).forEach(key => {
    db.get(queries[key], (err, row) => {
      if (!err) {
        stats[key] = row.count;
      }
      completed++;
      if (completed === total) {
        res.json(stats);
      }
    });
  });
});

// CONTACTOS removidos

// Servir ficheiros estáticos
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Criar diretório de backups se não existir
if (!fs.existsSync('./backups')) {
  fs.mkdirSync('./backups');
}

server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
  console.log(`Aceda a http://localhost:${PORT} para usar a aplicação`);
  
  // Abrir automaticamente no browser (apenas se não for produção)
  if (process.env.NODE_ENV !== 'production') {
    const open = require('child_process').exec;
    const url = `http://localhost:${PORT}`;
    
    // Detectar sistema operativo e abrir browser apropriado
    const start = process.platform === 'darwin' ? 'open' : 
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    
    setTimeout(() => {
      open(`${start} ${url}`, (error) => {
        if (error) {
          console.log('Para abrir manualmente: http://localhost:' + PORT);
        } else {
          console.log('Browser aberto automaticamente!');
        }
      });
    }, 2000); // Aguardar 2 segundos para o servidor estar pronto
  }
});

// Fechar base de dados ao terminar a aplicação
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Conexão à base de dados fechada.');
    process.exit(0);
  });
});
