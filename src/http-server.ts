import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { server } from "./server.ts"; 

import { loadSettings } from "./config.ts";
import { TokenManager } from "./auth.ts";
import { VendorApiHttp } from "./http.ts";
import { VendorApiClient } from "./client.ts";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 10000);
const MCP_API_TOKEN = process.env.MCP_API_TOKEN; 
const RENDER_HOST = process.env.RENDER_EXTERNAL_HOSTNAME || "jumia-vendor-mcp.onrender.com";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "..", "public")));

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/" || req.path.startsWith("/index.html")) return next();
  
  if (!MCP_API_TOKEN) return next();
  const auth = req.headers.authorization ?? "";
  if (auth === `Bearer ${MCP_API_TOKEN}`) return next();
  
  res.status(401).json({ error: "Unauthorized" });
});

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
