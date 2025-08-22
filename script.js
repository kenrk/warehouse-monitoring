// --- CONFIGURATION ---
// PASTE YOUR GOOGLE SHEETS CSV URL HERE
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1tBnWq8XH9ZIfJaGN8rnO8-6DPA7jhP9CoMj7I0VbANk/edit?usp=sharing';

// You can adjust these targets if needed
const DAILY_TARGET = 200;
const WEEKLY_TARGET = 800;
// --- END CONFIGURATION ---

let productionChart = null; // To hold the chart instance

// Robust CSV line splitter that respects quotes (handles commas inside quotes)
function splitCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            // Handle escaped quotes ("")
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    result.push(cur);
    return result.map(s => s.trim().replace(/^"|"$/g, '').trim());
}

// Try to find header index by list of possible names (case-insensitive)
function findIndex(headers, candidates) {
    const low = headers.map(h => (h || '').toLowerCase());
    for (const c of candidates) {
        const idx = low.indexOf(c.toLowerCase());
        if (idx !== -1) return idx;
    }
    return -1; // not found
}

// Parse CSV using header detection; fallback to positional mapping if header unknown
function parseCSV(csvText) {
    const lines = csvText.replace(/\r/g, '').trim().split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return [];

    // Parse header
    const headerCols = splitCSVLine(lines[0]);

    // identify indexes for each field using header names (support multiple synonyms)
    let idxTanggal = findIndex(headerCols, ['tanggal', 'date', 'tgl']);
    let idxBarang = findIndex(headerCols, ['barang', 'item', 'product', 'produk', 'nama']);
    let idxProduction = findIndex(headerCols, ['production', 'produksi', 'prod', 'jumlah']);
    let idxQc = findIndex(headerCols, ['qc', 'quality', 'quality control']);
    let idxDefect = findIndex(headerCols, ['defect', 'defects', 'kerusakan']);
    let idxRepair = findIndex(headerCols, ['repair', 'perbaikan']);

    // If no recognizable header, fallback to positional mapping (0..5)
    const fallback = (idxTanggal === -1 && idxBarang === -1 && idxProduction === -1);
    if (fallback) {
        idxTanggal = 0;
        idxBarang = 1;
        idxProduction = 2;
        idxQc = 3;
        idxDefect = 4;
        idxRepair = 5;
    } else {
        // For any missing column, try fallback positions relative to indices we do have
        // (this is lenient — but better than failing completely)
        const anyFound = [idxTanggal, idxBarang, idxProduction].some(i => i !== -1);
        if (!anyFound) {
            idxTanggal = 0;
            idxBarang = 1;
        }
        if (idxProduction === -1) idxProduction = 2;
        if (idxQc === -1) idxQc = 3;
        if (idxDefect === -1) idxDefect = 4;
        if (idxRepair === -1) idxRepair = 5;
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const raw = splitCSVLine(lines[i]);
        if (raw.length === 0) continue;

        // Safely get column by index (may be undefined)
        const safe = (arr, idx) => (idx >= 0 && idx < arr.length ? arr[idx] : '');

        const entry = {
            tanggal: safe(raw, idxTanggal) || '',
            barang: safe(raw, idxBarang) || '',
            production: parseFloat(safe(raw, idxProduction)) || 0,
            qc: parseFloat(safe(raw, idxQc)) || 0,
            defect: parseFloat(safe(raw, idxDefect)) || 0,
            repair: parseFloat(safe(raw, idxRepair)) || 0,
        };

        // Normalize tanggal and barang by trimming
        if (entry.tanggal) entry.tanggal = entry.tanggal.trim();
        if (entry.barang) entry.barang = entry.barang.trim();

        data.push(entry);
    }

    return data;
}

// Function to update the UI with processed data
function updateUI(data) {
    if (!data || data.length === 0) {
        console.error("No data available to display.");
        document.getElementById('current-date').textContent = "Failed to load data or sheet is empty.";
        return;
    }

    // derive latest date (string compare generally ok for ISO-like strings; otherwise we can parse Date)
    const latestDate = data.reduce((max, p) => (p.tanggal > max ? p.tanggal : max), data[0].tanggal || '');
    document.getElementById('current-date').textContent = latestDate || '—';

    const todayData = data.filter(item => item.tanggal === latestDate);

    // --- CALCULATIONS ---
    const todayTotals = todayData.reduce((acc, item) => {
        acc.production += item.production || 0;
        acc.qc += item.qc || 0;
        acc.defect += item.defect || 0;
        acc.repair += item.repair || 0;
        return acc;
    }, { production: 0, qc: 0, defect: 0, repair: 0 });

    const weeklyTotals = data.reduce((acc, item) => {
        acc.production += item.production || 0;
        acc.qc += item.qc || 0;
        acc.defect += item.defect || 0;
        acc.repair += item.repair || 0;
        return acc;
    }, { production: 0, qc: 0, defect: 0, repair: 0 });

    // Rates
    const todayProdRate = todayTotals.production > 0 ? (todayTotals.production / DAILY_TARGET) * 100 : 0;
    const todayDefectRate = todayTotals.production > 0 ? (todayTotals.defect / todayTotals.production) * 100 : 0;
    const todayRepairRate = todayTotals.production > 0 ? (todayTotals.repair / todayTotals.production) * 100 : 0;

    const weeklyProdRate = weeklyTotals.production > 0 ? (weeklyTotals.production / WEEKLY_TARGET) * 100 : 0;
    const weeklyDefectRate = weeklyTotals.production > 0 ? (weeklyTotals.defect / weeklyTotals.production) * 100 : 0;
    const weeklyRepairRate = weeklyTotals.production > 0 ? (weeklyTotals.repair / weeklyTotals.production) * 100 : 0;

    // --- UI UPDATES ---
    const items = ['Chasis', 'Cushion', 'Headrest'];
    items.forEach(itemName => {
        const lowerName = itemName.toLowerCase();
        // match exact first, then includes (both case-insensitive)
        const itemData = todayData.find(d => d.barang && d.barang.toLowerCase() === lowerName)
            || todayData.find(d => d.barang && d.barang.toLowerCase().includes(lowerName))
            || {};

        const container = document.getElementById(`${itemName.toLowerCase()}-stats`);
        if (container) {
            // more robust selection of the 4 stat boxes
            const statBoxes = container.querySelectorAll('.grid > div');
            if (statBoxes && statBoxes.length >= 4) {
                statBoxes[0].querySelector('.stat-value').textContent = (itemData.production || 0);
                statBoxes[1].querySelector('.stat-value').textContent = (itemData.qc || 0);
                statBoxes[2].querySelector('.stat-value').textContent = (itemData.defect || 0);
                statBoxes[3].querySelector('.stat-value').textContent = (itemData.repair || 0);
            } else {
                // fallback: try old selector if structure differs
                try {
                    container.querySelector('.grid div:nth-child(1) .stat-value').textContent = itemData.production || 0;
                    container.querySelector('.grid div:nth-child(2) .stat-value').textContent = itemData.qc || 0;
                    container.querySelector('.grid div:nth-child(3) .stat-value').textContent = itemData.defect || 0;
                    container.querySelector('.grid div:nth-child(4) .stat-value').textContent = itemData.repair || 0;
                } catch (e) {
                    console.warn('Could not update stat boxes for', itemName, e);
                }
            }
        }
    });

    // Today's Report
    document.getElementById('today-production').textContent = `${todayTotals.production}/${DAILY_TARGET}`;
    document.getElementById('today-prod-rate').textContent = `${todayProdRate.toFixed(0)}%`;
    document.getElementById('today-defect-rate').textContent = `${todayDefectRate.toFixed(1)}%`;
    document.getElementById('today-repair-rate').textContent = `${todayRepairRate.toFixed(1)}%`;

    // Weekly Report
    document.getElementById('weekly-production').textContent = `${weeklyTotals.production}/${WEEKLY_TARGET}`;
    document.getElementById('weekly-prod-rate').textContent = `${weeklyProdRate.toFixed(0)}%`;
    document.getElementById('weekly-defect-rate').textContent = `${weeklyDefectRate.toFixed(1)}%`;
    document.getElementById('weekly-repair-rate').textContent = `${weeklyRepairRate.toFixed(1)}%`;

    // Update Chart
    updateChart(todayTotals);
}

function updateChart(todayTotals) {
    const ctx = document.getElementById('productionChart').getContext('2d');
    const prodSegment = Math.max(0, todayTotals.production - todayTotals.defect); // don't go negative in chart
    const chartData = {
        labels: ['Production', 'Defect', 'Repair'],
        datasets: [{
            data: [
                prodSegment,
                todayTotals.defect,
                todayTotals.repair
            ],
            backgroundColor: ['#3B82F6', '#10B981', '#EF4444'],
            borderColor: '#1F2937',
            borderWidth: 3,
            hoverOffset: 4
        }]
    };

    if (productionChart) {
        productionChart.data = chartData;
        productionChart.update();
    } else {
        productionChart = new Chart(ctx, {
            type: 'pie',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#D1D5DB', font: { size: 14 } }
                    }
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!GOOGLE_SHEET_URL.includes('docs.google.com/spreadsheets')) {
        document.getElementById('current-date').textContent = "Please paste a valid Google Sheet URL in the script.";
        return;
    }

    let fetchUrl = GOOGLE_SHEET_URL;
    if (fetchUrl.includes('/edit')) {
        fetchUrl = fetchUrl.replace(/\/edit\?.*$/, '/export?format=csv');
    }
    document.getElementById('gsheets-link').href = GOOGLE_SHEET_URL.replace(/\/export\?.*$/, '/edit');

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}.`);

        const csvText = await response.text();
        if (csvText.trim().startsWith('<!DOCTYPE html>')) throw new Error("Received HTML instead of CSV. Please ensure your Google Sheet's sharing settings are set to 'Anyone with the link can view'.");

        const data = parseCSV(csvText);
        updateUI(data);
    } catch (error) {
        console.error('Failed to fetch or process data:', error);
        document.getElementById('current-date').textContent = "Error: Gagal memuat data. Periksa konsol, URL, dan pengaturan berbagi Sheet.";
    }
});
