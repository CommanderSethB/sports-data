// 1. Read the table type directly from the current page's URL (e.g., data.html?table=analytics)
const urlParams = new URLSearchParams(window.location.search);
const tableType = urlParams.get('table') || 'liveScoring'; // Fallback to 'liveScoring' if no parameter exists

// --- APPROACH B: Datasets loaded from an external FILE ---
async function fetchDatasetFromFile(type) {
    try {
        // Automatically maps 'users' -> './data/users.json', etc.
        const response = await fetch(`./data/${type}.json`);
        
        if (!response.ok) {
            throw new Error(`Failed to load file (Status: ${response.status})`);
        }
        
        return await response.json();
    } catch (error) {
        console.warn(`Could not load file for "${type}". Falling back to function generator.`, error);
        
        // Fallback gracefully to the function dataset if the file doesn't exist
        if (functionDatasets[type]) {
            return functionDatasets[type]();
        }
        return [{ Error: "Data source could not be resolved." }];
    }
}

// 2. Generic function to render the table into the DOM
function renderTable(data, type) {
    const container = document.getElementById('table-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = `<p>No data found for ${type}.</p>`;
        return;
    }

    const table = document.createElement('table');
    table.border = "1";
    
    // Create header row dynamically from object keys
    const headers = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Create data rows
    data.forEach(item => {
        const row = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.style.textAlign = "center"; // Center regular cell text and images
            
            // Check if this is the teamList table
            if (type === "teamList" && item[header]) {
                if (header === "Logo") {
                    // Convert teamLogo to an image element[cite: 1]
                    const img = document.createElement('img');
                    img.src = item[header];
                    img.alt = "Team Logo";
                    img.style.maxWidth = "40px";
                    img.style.height = "auto";
                    td.appendChild(img);
                } else if (header === "Color") {
                    // Convert teamColor to a color preview box + hex text
                    const colorContainer = document.createElement('div');
                    colorContainer.style.display = "flex";
                    colorContainer.style.alignItems = "center";
                    colorContainer.style.justifyContent = "center"; // Center the contents inside the cell
                    colorContainer.style.gap = "8px";

                    const colorBox = document.createElement('div');
                    colorBox.style.width = "50px";
                    colorBox.style.height = "20px";
                    
                    // Ensure the color string has a '#' prefix for the browser
                    const rawColor = item[header];
                    const validColor = rawColor && !rawColor.startsWith('#') ? `#${rawColor}` : rawColor;
                    
                    colorBox.style.backgroundColor = validColor || "#fff";
                    colorBox.style.border = "1px solid #ccc";
                    colorBox.style.borderRadius = "4px";

                    const textSpan = document.createElement('span');
                    textSpan.textContent = rawColor; // Show the original text

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

    // Inject into container
    container.innerHTML = ``;
    container.appendChild(table);
}

// 3. Main initialization function
async function initTableBuilder() {
    const container = document.getElementById('table-container');
    container.innerHTML = `<h2>Loading ${tableType} data...</h2>`;

    let data;

    // CHOOSE YOUR METHOD HERE:
    
    // Option 1: Load purely from a function
    // data = functionDatasets[tableType] ? functionDatasets[tableType]() : [];

    // Option 2: Load from a file (with automatic function fallback)
    data = await fetchDatasetFromFile(tableType);

    // Render the final table
    renderTable(data, tableType);
}

// Run everything
initTableBuilder();
