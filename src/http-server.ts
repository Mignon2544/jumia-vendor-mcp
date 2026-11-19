<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wizo Seller Hub</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .btn { background-color: #ff9900; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
        .btn:hover { background-color: #e68a00; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .card h3 { margin-top: 0; color: #333; }
        .status { font-size: 12px; padding: 4px 8px; border-radius: 12px; background: #e6f4ea; color: #1e8e3e; font-weight: bold; }
    </style>
</head>
<body>

    <div class="header">
        <h1>🛒 Wizo Seller Hub</h1>
        <button class="btn" onclick="loadShops()">Refresh Shops</button>
    </div>

    <div id="status-message"></div>
    <div class="grid" id="shops-container">
        <!-- Shops will load here -->
    </div>

    <script>
        // We will store your API token here temporarily for the browser to use
        const API_TOKEN = prompt("Please enter your MCP_API_TOKEN (the password you set in Render):");

        async function loadShops() {
            const container = document.getElementById('shops-container');
            const statusMsg = document.getElementById('status-message');
            
            container.innerHTML = '<p>Loading shops from Jumia...</p>';
            statusMsg.innerHTML = '';

            try {
                // Call our new API endpoint
                const response = await fetch('/api/shops', {
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`
                    }
                });

                if (!response.ok) throw new Error("Failed to fetch. Check your token.");
                
                const data = await response.json();
                container.innerHTML = ''; // Clear loading text

                if (data.length === 0) {
                    container.innerHTML = '<p>No shops found on this account.</p>';
                    return;
                }

                // Create a card for each shop
                data.forEach(shop => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    card.innerHTML = `
                        <h3>${shop.name || shop.shopName || 'Unnamed Shop'}</h3>
                        <p><strong>Shop ID:</strong> ${shop.id || shop.shopId}</p>
                        <p><strong>Country:</strong> ${shop.country || 'N/A'}</p>
                        <span class="status">Active</span>
                    `;
                    container.appendChild(card);
                });

            } catch (error) {
                container.innerHTML = '';
                statusMsg.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
            }
        }

        // Load shops automatically when page opens (if token is provided)
        if (API_TOKEN) {
            loadShops();
        }
    </script>
</body>
</html>
