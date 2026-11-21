import express from "express";
import path from "node:path";
import fs from "node:fs";
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
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const PORT = Number(process.env.PORT ?? 10000);
const MCP_API_TOKEN = process.env.MCP_API_TOKEN; 
const RENDER_HOST = process.env.RENDER_EXTERNAL_HOSTNAME || "jumia-vendor-mcp.onrender.com";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "..", "public")));

// --- AUTH MIDDLEWARE ---
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
        const client = new VendorApiClient(new VendorApiHttp(settings.apiBaseUrl, new TokenManager(settings)));
        res.json(await client.getShops());
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- ZIP IMPORTER ---
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/import/zip", upload.single("zipFile"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No ZIP file uploaded." });

        const zip = new AdmZip(req.file.buffer);
        let chatText = "";
        const images: string[] = []; 

        zip.getEntries().forEach((entry) => {
            if (entry.entryName.endsWith(".txt")) chatText = entry.getData().toString("utf8");
            else if (entry.entryName.match(/\.(jpg|jpeg|png)$/i)) {
                const ext = entry.entryName.split('.').pop();
                images.push(`data:image/${ext};base64,${entry.getData().toString("base64")}`);
            }
        });

        const parsedProducts: any[] = [];
        chatText.split('\n').forEach((line) => {
            if (!line.trim()) return;
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

        res.json({ success: true, extractedProducts: parsedProducts });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- AI CATEGORIZATION & DATA GENERATION ---
app.post("/api/import/ai-categorize", async (req, res) => {
    try {
        const { products } = req.body;
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) return res.status(400).json({ error: "GEMINI_API_KEY not set." });

        // 1. Read categories (Fallback to basic if file missing)
        const categoryFilePath = path.join(__dirname, "..", "data", "categories.txt");
        let categoryListString = fs.existsSync(categoryFilePath) 
            ? fs.readFileSync(categoryFilePath, "utf8") 
            : "Phones & Tablets → Accessories → Phone Cases\nHome & Office → Home & Kitchen";

        const genAI = new GoogleGenerativeAI(geminiKey);
        
        // Fastest model configuration for quick JSON output
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
            }
        });

        const prompt = `
        You are a Jumia catalog expert. 
        Here is the list of valid Jumia category paths:
        ${categoryListString}

        Products to process:
        ${products.map((p: any, i: number) => `Product ${i}: ${p.rawText} | Wholesale Price: ${p.price}`).join("\n")}

        For each product, do the following:
        1. Generate a clean, professional Product Name.
        2. Generate a short Description.
        3. Generate a unique SKU (e.g., WIZO-XXXX).
        4. Determine the closest exact category path from the list above.
        
        Return ONLY a JSON array of objects with this exact format:
        [{"index": 0, "name": "Clean Name", "description": "Clean Desc", "sku": "WIZO-1234", "category_name": "Path → To → Category"}]
        Do not return markdown. Just the JSON array.
        `;

        const result = await model.generateContent(prompt);
        let text = result.response.text();
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start === -1 || end === -1) throw new Error("AI returned invalid format.");
        
        const aiMatches = JSON.parse(text.substring(start, end + 1));

        // 2. Apply YOUR Custom Pricing Rules
        const enrichedProducts = products.map((p: any, i: number) => {
            const match = aiMatches.find((m: any) => m.index === i);
            const costPrice = Number(p.price) || 0; 
            
            let sellingPrice = costPrice;
            if (costPrice >= 50 && costPrice <= 300) sellingPrice = 999;
            else if (costPrice >= 400 && costPrice <= 1900) sellingPrice = costPrice * 3;
            else if (costPrice >= 2000 && costPrice <= 3900) sellingPrice = costPrice * 2;
            else if (costPrice >= 4000 && costPrice <= 6900) sellingPrice = costPrice * 2;
            else if (costPrice >= 7000 && costPrice <= 20000) sellingPrice = (costPrice * 2) - 2000;
            else if (costPrice >= 20000 && costPrice <= 40000) sellingPrice = costPrice * 1.5;

            return { 
                ...p, 
                name: match?.name || p.rawText,
                description: match?.description || p.rawText,
                sku: match?.sku || `WIZO-${Math.floor(Math.random() * 10000)}`,
                costPrice: costPrice,
                sellingPrice: Math.round(sellingPrice),
                categoryName: match?.category_name || "Uncategorized" 
            };
        });

        res.json({ success: true, enrichedProducts });
    } catch (error: any) { 
        console.error("AI Error:", error);
        res.status(500).json({ error: error.message }); 
    }
});

// --- EXCEL EXPORTER (73 HEADERS) ---
app.post("/api/export/excel", async (req, res) => {
    try {
        const { products } = req.body;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Jumia Products');

        const headers = [
            'Name', 'Name_AR', 'Name_FR', 'Description', 'Description_AR', 'Description_FR', 
            'SellerSKU', 'ParentSKU', 'Brand', 'PrimaryCategory', 'GTIN_Barcode', 'Price_KES', 
            'Sale_Price_KES', 'Sale_Price_Start_At', 'Sale_Price_End_At', 'Stock', 'variation', 
            'ac_design', 'air_cooler_type', 'blender_type', 'capacity', 'capacity_kg', 'capacity_kva', 
            'capacity_liter', 'capacity_litres', 'capacity_slices', 'certifications', 'color', 
            'color_AR', 'color_FR', 'color_family', 'cooker_type', 'defrost_type', 'fan_type', 
            'freezer_type', 'fridge_type', 'horse_power', 'installation_type', 'juicer_type', 
            'main_material', 'manufacturer_txt', 'material_family', 'model', 'note', 'package_content', 
            'package_content_AR', 'package_content_FR', 'power', 'product_line', 'product_measures', 
            'product_warranty', 'product_weight', 'production_country', 'short_description', 
            'short_description_AR', 'short_description_FR', 'storage_features', 'stove_type', 
            'venting_type', 'warranty_address', 'warranty_duration', 'warranty_type', 'washer_capacity', 
            'washing_machine_type', 'wattage', 'youtube_id', 'MainImage', 'Image2', 'Image3', 
            'Image4', 'Image5', 'Image6', 'Image7', 'Image8'
        ];

        worksheet.addRow(headers);

        products.forEach((p: any) => {
            const rowData: any = {};
            headers.forEach(h => rowData[h] = ""); // Initialize all columns to empty

            // Fill in the AI-generated and calculated data
            rowData['Name'] = p.name;
            rowData['Description'] = p.description;
            rowData['SellerSKU'] = p.sku;
            rowData['ParentSKU'] = p.sku; 
            rowData['Brand'] = p.brand || 'Generic';
            rowData['PrimaryCategory'] = p.categoryName;
            rowData['Price_KES'] = p.sellingPrice;
            rowData['Stock'] = 10; // Default stock
            
            if (p.image) {
                rowData['MainImage'] = p.image; 
            }

            worksheet.addRow(headers.map(h => rowData[h]));
        });

        // Styling
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        headers.forEach((h, i) => worksheet.getColumn(i + 1).width = Math.max(h.length + 2, 15));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Jumia_Upload_Template.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- HEALTH & MCP ---
app.get("/health", (_req, res) => res.status(200).send("ok"));

function getTransport() {
  return new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableDnsRebindingProtection: true, allowedHosts: [RENDER_HOST, "localhost", "127.0.0.1"] });
}

app.post("/mcp", async (req, res) => { const t = getTransport(); await server.connect(t); await t.handleRequest(req, res, req.body); });
app.get("/mcp", async (req, res) => { const t = getTransport(); await server.connect(t); await t.handleRequest(req, res); });
app.delete("/mcp", async (req, res) => { const t = getTransport(); await server.connect(t); await t.handleRequest(req, res); });

app.listen(PORT, "0.0.0.0", () => console.log(`Server listening on 0.0.0.0:${PORT}`));