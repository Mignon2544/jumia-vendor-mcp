import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { server } from "./server.ts"; 

import { loadSettings } from "./config.ts";
import { TokenManager } from "./auth.ts";
import { VendorApiHttp } from "./http.ts";
import { VendorApiClient } from "./client.ts";

import multer from "multer";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CORS MIDDLEWARE ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = Number(process.env.PORT ?? 10000);
const MCP_API_TOKEN = process.env.MCP_API_TOKEN; 
const RENDER_HOST = process.env.RENDER_EXTERNAL_HOSTNAME || "jumia-vendor-mcp.onrender.com";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "..", "public")));

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/" || req.path.startsWith("/index.html") || req.path.startsWith("/api/import")) return next();
  
  if (!MCP_API_TOKEN) return next();
  const auth = req.headers.authorization ?? "";
  if (auth === `Bearer ${MCP_API_TOKEN}`) return next();
  
  res.status(401).json({ error: "Unauthorized" });
});

// --- JUMPIA API ROUTES ---
app.get("/api/shops", async (req, res) => {
    try {
        const settings = await loadSettings();
        const tokenManager = new TokenManager(settings);
        const http = new VendorApiHttp(settings.apiBaseUrl, tokenManager);
        const client = new VendorApiClient(http);
        
        const shops = await client.getShops();
        res.json(shops);
    } catch (error: any) {
        console.error("Jumia API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/products", async (req, res) => {
    try {
        const settings = await loadSettings();
        const tokenManager = new TokenManager(settings);
        const http = new VendorApiHttp(settings.apiBaseUrl, tokenManager);
        const client = new VendorApiClient(http);
        
        const pageToken = req.query.token as string | undefined;
        const searchQuery = req.query.search as string | undefined;
        const searchType = req.query.type as string | undefined;

        const options: any = { size: 50, token: pageToken };

        if (searchQuery && searchType === "sku") {
            options.sellerSku = searchQuery;
        }

        const products = await client.getProducts(options);
        res.json(products);
    } catch (error: any) {
        console.error("Jumia API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/products/update-price", async (req, res) => {
    try {
        const { sellerSku, id, category, newPrice, currency } = req.body;
        const settings = await loadSettings();
        const tokenManager = new TokenManager(settings);
        const http = new VendorApiHttp(settings.apiBaseUrl, tokenManager);
        const client = new VendorApiClient(http);

        const payload = [{
            sellerSku: sellerSku,
            id: id,
            category: category,
            price: { currency: currency || "KES", value: Number(newPrice) }
        }];

        const result = await client.updatePrice(payload);
        res.json({ success: true, result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/products/update-status", async (req, res) => {
    try {
        const { sellerSku, id, businessClientCode, newStatus } = req.body;
        const settings = await loadSettings();
        const tokenManager = new TokenManager(settings);
        const http = new VendorApiHttp(settings.apiBaseUrl, tokenManager);
        const client = new VendorApiClient(http);

        const payload = [{
            id: id,
            sellerSku: sellerSku,
            businessClients: [{ businessClientCode: businessClientCode, status: newStatus }]
        }];

        const result = await client.updateStatus(payload);
        res.json({ success: true, result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/products/update-stock", async (req, res) => {
    try {
        const { sellerSku, id, newStock } = req.body;
        const settings = await loadSettings();
        const tokenManager = new TokenManager(settings);
        const http = new VendorApiHttp(settings.apiBaseUrl, tokenManager);
        const client = new VendorApiClient(http);

        const payload = [{ sellerSku: sellerSku, id: id, stock: Number(newStock) }];

        const result = await client.updateStock(payload);
        res.json({ success: true, result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- ZIP IMPORTER ENDPOINT ---
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/import/zip", upload.single("zipFile"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No ZIP file uploaded." });
        }

        const zip = new AdmZip(req.file.buffer);
        const zipEntries = zip.getEntries();
        
        let chatText = "";
        const images: string[] = []; 

        zipEntries.forEach((entry) => {
            if (entry.entryName.endsWith(".txt")) {
                chatText = entry.getData().toString("utf8");
            } else if (entry.entryName.match(/\.(jpg|jpeg|png)$/i)) {
                const imgBuffer = entry.getData();
                const base64 = imgBuffer.toString("base64");
                const ext = entry.entryName.split('.').pop();
                images.push(`data:image/${ext};base64,${base64}`);
            }
        });

        const lines = chatText.split('\n');
        const parsedProducts: any[] = [];

        lines.forEach((line) => {
            if (!line.trim()) return;

            // Remove timestamp before looking for price
            const lineWithoutTimestamp = line.replace(/\[.*?\]/, "");
            const priceMatch = lineWithoutTimestamp.match(/(?:ksh|kes|price)?\s*(\d{2,6})/i);
            const cleanLine = line.replace(/\[.*?\]\s*[^:]+:\s*/, "").trim();

            if (cleanLine.length > 5) { 
                parsedProducts.push({
                    rawText: cleanLine,
                    price: priceMatch ? priceMatch[1] : "",
                    image: images[parsedProducts.length] || null 
                });
            }
        });

        res.json({ 
            success: true, 
            extractedProducts: parsedProducts,
            totalImagesFound: images.length
        });

    } catch (error: any) {
        console.error("Import Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- AI CATEGORIZATION ENDPOINT ---
app.post("/api/import/ai-categorize", async (req, res) => {
    try {
        const { products } = req.body;
        const geminiKey = process.env.GEMINI_API_KEY;
        
        if (!geminiKey) {
            return res.status(400).json({ error: "GEMINI_API_KEY is not set on the server." });
        }

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 1. Fetch live categories from Jumia
        const settings = await loadSettings();
        const tokenManager = new TokenManager(settings);
        const http = new VendorApiHttp(settings.apiBaseUrl, tokenManager);
        const client = new VendorApiClient(http);
        
        const categoryData = await client.getCategories({ size: 100 });
        const categoryListString = categoryData.categories
            ?.map((c: any) => `[${c.code}] ${c.name}`)
            .join("\n");

        // 2. Ask AI to match the products
        const prompt = `
        You are an expert Jumia e-commerce manager.
        Here is a list of valid Jumia Category Codes and Names:
        ${categoryListString}

        Here are the raw WhatsApp products:
        ${products.map((p: any, i: number) => `Product ${i}: ${p.rawText}`).join("\n")}

        For each product, determine the best Jumia Category Code. 
        Return ONLY a JSON array of objects with the format: 
        [{"index": 0, "category_code": "12345", "category_name": "Phones & Tablets"}]
        Do not wrap the response in markdown block quotes.
        `;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        
        // 3. Robust JSON Cleaning
        const startIndex = responseText.indexOf('[');
        const endIndex = responseText.lastIndexOf(']');
        
        if (startIndex === -1 || endIndex === -1) {
            console.error("AI Response did not contain a JSON array:", responseText);
            throw new Error("AI failed to return a valid category list.");
        }

        const cleanJson = responseText.substring(startIndex, endIndex + 1);
        const aiMatches = JSON.parse(cleanJson);

        // 4. Merge results
        const enrichedProducts = products.map((p: any, i: number) => {
            const match = aiMatches.find((m: any) => m.index === i);
            return {
                ...p,
                categoryCode: match?.category_code || "",
                categoryName: match?.category_name || "Uncategorized"
            };
        });

        res.json({ success: true, enrichedProducts });

    } catch (error: any) {
        console.error("AI Categorization Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- EXCEL EXPORTER ENDPOINT ---
app.post("/api/export/excel", async (req, res) => {
    try {
        const { products } = req.body;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Jumia Products');

        worksheet.columns = [
            { header: 'SellerSku', key: 'sku', width: 20 },
            { header: 'Name', key: 'name', width: 40 },
            { header: 'Description', key: 'desc', width: 50 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Stock', key: 'stock', width: 10 },
            { header: 'Brand', key: 'brand', width: 20 },
            { header: 'Category', key: 'category', width: 20 },
        ];

        products.forEach((p: any) => {
            worksheet.addRow({
                sku: p.sku || `SKU-${Math.floor(Math.random() * 10000)}`,
                name: p.name || p.rawText,
                desc: p.description || p.rawText,
                price: Number(p.price) || 0,
                stock: Number(p.stock) || 10,
                brand: p.brand || 'Generic',
                category: p.categoryName || 'Uncategorized'
            });
        });

        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Jumia_Upload_Template.xlsx"');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error: any) {
        console.error("Export Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- HEALTH & MCP ROUTES ---
app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

function getTransport() {
  return new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, 
    enableDnsRebindingProtection: true,
    allowedHosts: [RENDER_HOST, "localhost", "127.0.0.1"], 
  });
}

app.post("/mcp", async (req, res) => {
  const transport = getTransport();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const transport = getTransport();
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const transport = getTransport();
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jumia MCP HTTP server listening on 0.0.0.0:${PORT}`);
});