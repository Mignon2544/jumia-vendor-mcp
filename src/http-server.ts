/**
 * HTTP entry point for Render deployment.
 * Uses the official MCP Express adapter to create the app and transport.
 */
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import { server as existingServer } from "./server.ts"; // Reuse existing tool registration logic

const app = createMcpExpressApp();
const PORT = Number(process.env.PORT ?? 10000);
const MCP_API_TOKEN = process.env.MCP_API_TOKEN;

// Health check
app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

// Optional Bearer authentication
app.use("/mcp", (req, res, next) => {
  if (!MCP_API_TOKEN) return next();
  const auth = req.headers.authorization ?? "";
  if (auth === `Bearer ${MCP_API_TOKEN}`) return next();
  res.status(401).json({ error: "Unauthorized" });
});

// MCP Streamable HTTP endpoint (stateless mode)
app.post("/mcp", async (req, res) => {
  // Key fix: create a new server instance for each request, or reuse a factory pattern
  // If existingServer is a singleton, you need to ensure it can connect multiple times (not recommended).
  // More robust approach: move tool registration logic into a factory function and call it for each request.
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await existingServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await existingServer.connect(transport);
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await existingServer.connect(transport);
  await transport.handleRequest(req, res);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jumia MCP HTTP server listening on 0.0.0.0:${PORT}`);
});