/**
 * HTTP entry point for Render deployment.
 * Reuses the McpServer instance exported from ./server.ts (all tools already registered),
 * only replaces StdioServerTransport with NodeStreamableHTTPServerTransport.
 */
import express from "express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { server } from "./server.ts"; // same singleton instance

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 10000);
const MCP_API_TOKEN = process.env.MCP_API_TOKEN; // optional, but strongly recommended
const RENDER_HOST = process.env.RENDER_EXTERNAL_HOSTNAME || "jumia-vendor-mcp.onrender.com";

// ---- Health check (for Render + UptimeRobot) ----
app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

// ---- Optional: simple Bearer authentication ----
// If MCP_API_TOKEN is set, requests without the correct token are rejected.
app.use("/mcp", (req, res, next) => {
  if (!MCP_API_TOKEN) return next(); // no token configured, allow all requests
  const auth = req.headers.authorization ?? "";
  if (auth === `Bearer ${MCP_API_TOKEN}`) return next();
  res.status(401).json({ error: "Unauthorized" });
});

// Helper function to get a configured transport
function getTransport() {
  return new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
    enableDnsRebindingProtection: true,
    allowedHosts: [RENDER_HOST, "localhost", "127.0.0.1"], // <--- CRITICAL FIX
  });
}

// ---- MCP Streamable HTTP endpoint ----
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

// ---- Start ----
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jumia MCP HTTP server listening on 0.0.0.0:${PORT}`);
  console.log(`Allowed Hosts for DNS Rebinding: ${RENDER_HOST}`);
});
