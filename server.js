const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const XLSX = require('xlsx');

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
  const { title, description, date_time, duration } = req.body;
  const id = uuidv4();
  
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
});

app.put('/api/meetings/:id', (req, res) => {
  const { title, description, date_time, duration, status, notes } = req.body;
  const { id } = req.params;
  
  db.run(
    'UPDATE meetings SET title = ?, description = ?, date_time = ?, duration = ?, status = ?, notes = ? WHERE id = ?',
    [title, description, date_time, duration, status, notes, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Reunião atualizada com sucesso' });
      }
    }
  );
});

app.delete('/api/meetings/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM meetings WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: 'Reunião eliminada com sucesso' });
    }
  });
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
  const fs = require('fs');
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
  const fs = require('fs');
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
        
        // Reinicializar conexão com a base de dados
        db.close((closeErr) => {
          if (closeErr) {
            console.error('Erro ao fechar conexão:', closeErr);
          }
          
          // Reabrir conexão
          const sqlite3 = require('sqlite3').verbose();
          global.db = new sqlite3.Database('./office_manager.db', (reopenErr) => {
            if (reopenErr) {
              console.error('Erro ao reabrir base de dados:', reopenErr);
              return res.status(500).json({ error: 'Erro ao reabrir base de dados' });
            }
            
            res.json({ 
              success: true, 
              message: 'Backup restaurado com sucesso',
              restoredFrom: backup.filename,
              restoredAt: new Date().toISOString()
            });
          });
        });
      });
    });
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
    'SELECT * FROM containers WHERE arrival_date BETWEEN ? AND ? ORDER BY arrival_date',
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

// CONTACTOS removidos

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
const fs = require('fs');
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
