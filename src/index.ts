#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tool definitions
interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  filePath: string;
}

const TOOLS: ToolDefinition[] = [
  {
    name: "pixelaw_101",
    title: "PixeLAW 101",
    description: "Beginner-friendly introduction to PixeLAW development. Use this when starting a new PixeLAW project, understanding the basic workflow, or when you need a high-level overview of PixeLAW architecture.",
    filePath: "guides/pixelaw_101.md",
  },
  {
    name: "pixelaw_app_structure",
    title: "PixeLAW App Structure",
    description: "Essential guidance for structuring PixeLAW applications. Use this when creating new apps, organizing files, or understanding the app development lifecycle.",
    filePath: "guides/pixelaw_app_structure.md",
  },
  {
    name: "pixelaw_models",
    title: "PixeLAW Models",
    description: "Specialized guidance for creating and working with PixeLAW models. Use this when you need to define data structures, create model schemas, or understand model relationships.",
    filePath: "guides/pixelaw_models.md",
  },
  {
    name: "pixelaw_systems",
    title: "PixeLAW Systems",
    description: "Expert guidance on implementing PixeLAW systems and game logic. Use this when writing contract functions, implementing game mechanics, or working with pixel interactions.",
    filePath: "guides/pixelaw_systems.md",
  },
  {
    name: "pixelaw_hooks",
    title: "PixeLAW Hooks",
    description: "Comprehensive guide for implementing the PixeLAW hook system. Use this when creating app-to-app interactions, implementing permission-controlled updates, or working with pre/post hooks.",
    filePath: "guides/pixelaw_hooks.md",
  },
  {
    name: "pixelaw_testing",
    title: "PixeLAW Testing",
    description: "Comprehensive guide for writing tests for PixeLAW applications. Use this when creating unit tests, integration tests, or setting up test environments.",
    filePath: "guides/pixelaw_testing.md",
  },
  {
    name: "pixelaw_deployment",
    title: "PixeLAW Deployment",
    description: "Deployment workflows and infrastructure setup. Use this when deploying apps locally, to testnets, or managing infrastructure.",
    filePath: "guides/pixelaw_deployment.md",
  },
  {
    name: "pixelaw_patterns",
    title: "PixeLAW Patterns",
    description: "Common patterns and best practices for PixeLAW development. Use this for queue systems, area management, app coordination, and advanced patterns.",
    filePath: "guides/pixelaw_patterns.md",
  },
];

// Helper function to read guide content
async function readGuide(filePath: string): Promise<string> {
  const fullPath = path.join(__dirname, filePath);
  return await fs.readFile(fullPath, "utf-8");
}

// Create and configure server
const server = new McpServer({
  name: "pixelaw-mcp",
  version: "1.0.0",
});

// Register all tools
TOOLS.forEach((tool) => {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: {},
    },
    async () => {
      try {
        const content = await readGuide(tool.filePath);
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading guide: ${error}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PixeLAW MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
