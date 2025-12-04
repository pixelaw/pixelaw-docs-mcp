# PixeLAW MCP Server

Expert guidance for building PixeLAW applications on Starknet using the Model Context Protocol (MCP).

## Overview

This MCP server provides 8 specialized documentation tools that help AI assistants like Claude provide expert-level guidance for PixeLAW development. The tools automatically provide context-aware help based on the conversation.

## Installation

```bash
# Install dependencies
npm install

# Build the server
npm run build
```

## Available Tools

The server provides 8 documentation tools:

1. **pixelaw_101** - Beginner-friendly introduction to PixeLAW development
2. **pixelaw_app_structure** - Essential guidance for structuring PixeLAW applications
3. **pixelaw_models** - Specialized guidance for creating and working with models
4. **pixelaw_systems** - Expert guidance on implementing systems and game logic
5. **pixelaw_hooks** - Comprehensive guide for implementing the hook system
6. **pixelaw_testing** - Guide for writing tests for PixeLAW applications
7. **pixelaw_deployment** - Deployment workflows and infrastructure setup
8. **pixelaw_patterns** - Common patterns and best practices

## Configuration

### For Claude Code

Add to your MCP settings (typically `~/.config/claude-code/mcp.json`):

```json
{
  "mcpServers": {
    "pixelaw-mcp": {
      "command": "node",
      "args": ["/path/to/pixelaw-docs-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### For Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "pixelaw-mcp": {
      "command": "node",
      "args": ["/path/to/pixelaw-docs-mcp/dist/index.js"]
    }
  }
}
```

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Run the server
npm start
```

## Architecture

This is a **tools-only** MCP server implementation:
- Tools are automatically invoked by Claude based on conversation context
- Each tool returns markdown documentation
- No resources or prompts required
- Simple, maintainable architecture

## Version Information

- **PixeLAW Core**: v0.8.0-dev
- **Dojo Framework**: v1.7.1
- **Cairo**: v2.12.2
- **MCP SDK**: v0.5.0

## Future Enhancements

Future versions may include:
- Code generation tools
- Validation and analysis tools
- Migration helpers
- Interactive examples

## License

MIT
