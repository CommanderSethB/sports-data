// 1. Read the table type directly from the current page's URL (e.g., data.html?table=analytics)[cite: 3]
const urlParams = new URLSearchParams(window.location.search);
const tableType = urlParams.get('table') || 'liveScoring'; // Fallback to 'liveScoring' if no parameter exists[cite: 3]
document.title = getTitle(urlParams.get('table'));

function getTitle(tableName) {
    let title = tableName.charAt(0).toUpperCase() + tableName.slice(1);
    
    title = title.split(/(?=[A-Z])/).join(" ");

    return title;
}

// --- APPROACH B: Datasets loaded from an external FILE ---
async function fetchDatasetFromFile(type) {
    try {
        // Automatically maps 'users' -> './data/users.json', etc.[cite: 3]
        const response = await fetch(`./data/${type}.json`);
        
        if (!response.ok) {
            throw new Error(`Failed to load file (Status: ${response.status})`);
        }
        
        return await response.json();
    } catch (error) {
        console.warn(`Could not load file for "${type}". Falling back to function generator.`, error);
        
        // Fallback gracefully to the function dataset if the file doesn't exist[cite: 3]
        if (functionDatasets[type]) {
            return functionDatasets[type]();
        }
        return [{ Error: "Data source could not be resolved." }];
    }
}

// 2. Generic function to render the table into the DOM[cite: 3]
function renderTable(data, type) {
    const container = document.getElementById('table-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = `<p>No data found for ${type}.</p>`;
        return;
    }

    const table = document.createElement('table');
    // Border attribute removed in favor of clean CSS styling
    
    // Create header row dynamically from object keys[cite: 3]
    const headers = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Create data rows[cite: 3]
    data.forEach(item => {
        const row = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.style.textAlign = "center"; // Center regular cell text and images[cite: 3]
            
            // Check if this is the teamList table[cite: 3]
            if (type === "teamList" && item[header]) {
                if (header === "Logo") {
                    // Convert teamLogo to an image element[cite: 1, 3]
                    const img = document.createElement('img');
                    img.src = item[header];
                    img.alt = "Team Logo";
                    img.style.maxWidth = "40px";
                    img.style.height = "auto";
                    td.appendChild(img);
                } else if (header === "Color") {
                    // Convert teamColor to a color preview box + hex text[cite: 3]
                    const colorContainer = document.createElement('div');
                    colorContainer.style.display = "flex";
                    colorContainer.style.alignItems = "center";
                    colorContainer.style.justifyContent = "center"; // Center the contents inside the cell[cite: 3]
                    colorContainer.style.gap = "8px";

                    const colorBox = document.createElement('div');
                    colorBox.style.width = "40px";
                    colorBox.style.height = "16px";
                    
                    // Ensure the color string has a '#' prefix for the browser[cite: 3]
                    const rawColor = item[header];
                    const validColor = rawColor && !rawColor.startsWith('#') ? `#${rawColor}` : rawColor;
                    
                    colorBox.style.backgroundColor = validColor || "#fff";
                    colorBox.style.border = "1px solid #ccc";
                    colorBox.style.borderRadius = "4px";

                    const textSpan = document.createElement('span');
                    textSpan.textContent = rawColor; // Show the original text[cite: 3]

                    colorContainer.appendChild(colorBox);
                    td.appendChild(colorContainer);
                } else {
                    td.textContent = item[header];
                }
            } else {
                td.textContent = item[header] || "";
            }
            
            row.appendChild(td);
        });
        table.appendChild(row);
    });

    // Inject into container[cite: 3]
    container.innerHTML = ``;
    container.appendChild(table);
}

// 3. Main initialization function[cite: 3]
async function initTableBuilder() {
    const container = document.getElementById('table-container');
    container.innerHTML = `<h2>Loading ${tableType} data...</h2>`;

    let data;

    // Option 2: Load from a file (with automatic function fallback)[cite: 3]
    data = await fetchDatasetFromFile(tableType);

    // Render the final table[cite: 3]
    renderTable(data, tableType);
}

// Run everything[cite: 3]
initTableBuilder();