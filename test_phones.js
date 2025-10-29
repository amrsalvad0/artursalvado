const XLSX = require('xlsx');
const path = require('path');

console.log('=== Teste de Leitura do Ficheiro telefones.xlsx ===\n');

try {
    const excelPath = path.join(__dirname, 'telefones.xlsx');
    console.log('Caminho do ficheiro:', excelPath);
    
    // Verificar se o ficheiro existe
    const fs = require('fs');
    if (!fs.existsSync(excelPath)) {
        console.error('ERRO: Ficheiro não encontrado!');
        process.exit(1);
    }
    console.log('✓ Ficheiro existe\n');
    
    // Ler o ficheiro Excel
    const workbook = XLSX.readFile(excelPath);
    console.log('✓ Ficheiro lido com sucesso');
    console.log('Folhas disponíveis:', workbook.SheetNames.join(', '), '\n');
    
    // Ler a primeira folha
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    console.log('A processar folha:', sheetName, '\n');
    
    // Converter para array
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('Total de linhas:', data.length, '\n');
    
    // Mostrar primeiras 5 linhas
    console.log('Primeiras 5 linhas:');
    console.log('-------------------');
    data.slice(0, 5).forEach((row, i) => {
        console.log(`Linha ${i}:`, row);
    });
    
    // Processar dados como telefones
    console.log('\n=== Processamento de Telefones ===\n');
    const phones = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        if (row.length < 3) continue;
        
        const sector = row[0] || '';
        const name = row[1] || '';
        const extension = row[2] || '';
        
        if (sector || name || extension) {
            phones.push({
                sector: sector,
                name: name,
                extension: extension
            });
        }
    }
    
    console.log('Total de telefones processados:', phones.length);
    console.log('\nPrimeiros 3 telefones:');
    phones.slice(0, 3).forEach(phone => {
        console.log(`- Setor: ${phone.sector} | Nome: ${phone.name} | Extensão: ${phone.extension}`);
    });
    
    // Agrupar por setor
    const phonesBySector = {};
    phones.forEach(phone => {
        const sector = phone.sector || 'Sem Setor';
        if (!phonesBySector[sector]) {
            phonesBySector[sector] = [];
        }
        phonesBySector[sector].push(phone);
    });
    
    console.log('\n=== Telefones por Setor ===\n');
    Object.keys(phonesBySector).sort().forEach(sector => {
        console.log(`${sector}: ${phonesBySector[sector].length} telefone(s)`);
    });
    
    console.log('\n✓ Teste concluído com sucesso!');
    
} catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
}
