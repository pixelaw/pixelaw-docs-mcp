# PixeLAW Deployment Guide

## Overview

Complete guide to deploying your PixeLAW app from the app_template. This guide assumes you've started with the PixeLAW App Template and are building your own app.

## Prerequisites

- **PixeLAW App Template**: Cloned and set up
- **VSCode with DevContainer** (recommended) or local tooling
- **Funded Sepolia account** (for testnet deployment)

## Development Environment Setup

### Option 1: VSCode DevContainer (Recommended)

The app_template includes a fully configured DevContainer with all tools pre-installed.

**Steps**:
1. Open the `app_template` folder in VSCode
2. When prompted, click "Reopen in Container"
3. Wait for the container to build and start

**What's Included**:
- Katana (local blockchain): http://localhost:5050
- Torii (indexer): http://localhost:8080
- PixeLAW Server: http://localhost:3000
- All Dojo tooling pre-installed

**Viewing Logs**:
```bash
klog    # Katana logs
tlog    # Torii logs
slog    # Server logs
```

### Option 2: Local Environment

See `README.local.md` in the app_template for manual installation instructions.

## Local Development Deployment

### 1. Build Your Contracts

```bash
sozo build
```

**What it does**:
- Compiles all Cairo contracts in `/src`
- Generates Sierra bytecode
- Creates manifest files
- Validates Dojo configurations

**Expected Output**:
```
Compiling...
✓ Compiled successfully
```

### 2. Deploy to Local Katana

```bash
sozo migrate
```

**What it does**:
- Deploys contracts to local Katana (http://localhost:5050)
- Registers models with the world
- Sets up permissions automatically
- Calls `dojo_init()` to register your app with PixeLAW

**Expected Output**:
```
Migration successful!
World address: 0x...
```

### 3. Verify Deployment

```bash
# Check world state
sozo inspect

# Query a model
sozo model get Pixel 10,20

# Execute your interact function
sozo execute myapp interact -c 10,20,0xFF0000
```

## Understanding dojo_dev.toml

Your app's configuration file:

```toml
[world]
name = "myapp"           # Your app name
seed = "pixelaw"         # World seed

[namespace]
default = "myapp"        # Your app's namespace

# Maps PixeLAW core models to pixelaw namespace
mappings = { "pixelaw" = [
    "actions", "App", "AppName", "Area", "CoreActionsAddress",
    "Pixel", "QueueItem", "RTree", "Notification", "QueueScheduled"
] }

[env]
rpc_url = "http://localhost:5050/"
account_address = "0x127fd5f1fe78..."  # Katana account
private_key = "0xc5b2fcab997..."       # Katana private key
world_address = "0x..."                # Updated after first deploy

[writers]
"myapp-ClickGame" = ["myapp-myapp_actions"]  # Permission setup

[migration]
# Skip PixeLAW core contracts (already deployed)
skip_contracts = [
    "pixelaw-actions",
    "pixelaw-App",
    "pixelaw-Pixel",
    # ... other core contracts
]
```

**Key Points**:
- `skip_contracts`: Prevents redeploying PixeLAW core
- `mappings`: Routes core models to correct namespace
- `world_address`: Automatically updated after deployment

## Account Management

### Local Development

Use the pre-configured Katana accounts in `dojo_dev.toml`:
- Address: `0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec`
- Private Key: `0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912`

**No setup needed** - these accounts are pre-funded in Katana.

### Testnet (Sepolia)

Create and configure an account for Sepolia:

```bash
# 1. Create keystore from private key
./scripts/account_from_key.sh

# 2. Fund your account with testnet ETH
# Get testnet ETH from: https://faucet.goerli.starknet.io/

# 3. Account will be saved in your keystore
```

## Testnet Deployment (Sepolia)

### 1. Configure Sepolia

Edit `dojo_sepolia.toml`:

```toml
[env]
rpc_url = "https://starknet-sepolia.public.blastapi.io"
account_address = "0x..."  # Your funded account
private_key = "0x..."      # Your account's private key
# world_address will be set after first deployment
```

### 2. Build for Sepolia

```bash
./scripts/build_sepolia.sh
```

**What it does**:
- Compiles contracts with Sepolia configuration
- Validates all dependencies
- Prepares deployment artifacts

### 3. Deploy to Sepolia

```bash
./scripts/deploy_sepolia.sh
```

**What it does**:
- Uses `sozo migrate --profile sepolia`
- Deploys to Sepolia testnet
- Registers your app with PixeLAW
- Updates `world_address` in `dojo_sepolia.toml`

**Expected Output**:
```
Deploying to Sepolia...
✓ Contracts deployed
✓ Models registered
✓ App initialized
World address: 0x... (saved to dojo_sepolia.toml)
```

### 4. Verify Sepolia Deployment

```bash
# Use sepolia profile for all commands
sozo --profile sepolia inspect

# Query state
sozo --profile sepolia model get Pixel 10,20

# Execute function
sozo --profile sepolia execute myapp interact -c 10,20
```

## Deployment Scripts

### build_sepolia.sh

```bash
#!/bin/bash
sozo --profile sepolia build
```

Simple wrapper to build with Sepolia profile.

### deploy_sepolia.sh

```bash
#!/bin/bash
sozo --profile sepolia migrate
```

Deploys contracts to Sepolia testnet.

### account_from_key.sh

Creates a Starknet account keystore from a private key:

```bash
./scripts/account_from_key.sh
```

**Prompts for**:
- Private key
- Password for keystore encryption

**Output**: Keystore file saved for deployment

## Development Workflow

### Typical Development Cycle

```bash
# 1. Make code changes in src/

# 2. Build
sozo build

# 3. Deploy to local
sozo migrate

# 4. Test manually
sozo execute myapp interact -c 10,20

# 5. Run automated tests
sozo test

# 6. When ready, deploy to Sepolia
./scripts/deploy_sepolia.sh
```

### Testing Before Deployment

```bash
# Run all tests
sozo test

# Run specific test
sozo test --filter test_interact

# Verbose output
sozo test --print-trace
```

## Configuration Files Reference

### Scarb.toml

Main package configuration:

```toml
[package]
name = "myapp"
version = "0.0.0"
cairo-version = "2.9.4"

[dependencies]
pixelaw = { git = "https://github.com/pixelaw/core", tag = "v0.5.17" }
dojo = "=1.5.1"

[dev-dependencies]
pixelaw_testing = { git = "https://github.com/pixelaw/core", tag = "v0.5.17" }
```

**Key Settings**:
- Cairo and Dojo versions must match
- PixeLAW version from git tag
- Testing utilities in dev-dependencies

### dojo_dev.toml

Local development configuration (covered above).

### dojo_sepolia.toml

Sepolia testnet configuration:

```toml
[world]
name = "myapp"
seed = "pixelaw"

[env]
rpc_url = "https://starknet-sepolia.public.blastapi.io"
account_address = "0x..."
private_key = "0x..."
world_address = "0x..."  # Auto-updated

# Same namespace, writers, and skip_contracts as dev
```

### dojo_release.toml

Production/mainnet configuration (when ready).

## Common Commands

### Development

```bash
sozo build                    # Build contracts
sozo migrate                  # Deploy to local Katana
sozo test                     # Run tests
sozo inspect                  # View world state
```

### Testnet (Sepolia)

```bash
./scripts/build_sepolia.sh    # Build for Sepolia
./scripts/deploy_sepolia.sh   # Deploy to Sepolia
sozo --profile sepolia inspect    # View Sepolia state
sozo --profile sepolia execute myapp interact -c 10,20
```

### Execution

```bash
# Execute function on local
sozo execute myapp interact -c 10,20,0xFF0000

# Execute on Sepolia
sozo --profile sepolia execute myapp interact -c 10,20,0xFF0000
```

### Querying State

```bash
# Get Pixel at position
sozo model get Pixel 10,20

# Get your custom model
sozo model get ClickGame 10,20

# On Sepolia
sozo --profile sepolia model get Pixel 10,20
```

## Upgrading Dependencies

### Upgrade PixeLAW Core

1. Find new version in [PixeLAW releases](https://github.com/pixelaw/core/releases)

2. Update `Scarb.toml`:
```toml
[dependencies]
pixelaw = { git = "https://github.com/pixelaw/core", tag = "v0.6.0" }  # New version

[dev-dependencies]
pixelaw_testing = { git = "https://github.com/pixelaw/core", tag = "v0.6.0" }
```

3. Clean and rebuild:
```bash
rm -rf target/
rm Scarb.lock
sozo build
```

4. Fix compilation errors (if any)

5. Run tests:
```bash
sozo test
```

6. Redeploy:
```bash
sozo migrate
```

### Upgrade Dojo

**Note**: Dojo version is tied to PixeLAW Core version. Upgrade Core, which will upgrade Dojo.

Check PixeLAW Core's Dojo requirement in its `Scarb.toml`.

## Troubleshooting

### Build Failures

```bash
# Clear build cache
rm -rf target/
rm Scarb.lock

# Rebuild
sozo build
```

### Migration Issues

**Problem**: "World address not found"
```bash
# Solution: Check dojo_dev.toml has correct RPC URL
# For DevContainer: http://localhost:5050/
```

**Problem**: "Contract already deployed"
```bash
# Solution: Either:
# 1. Delete world_address from dojo_dev.toml to deploy fresh
# 2. Or use existing world
```

### Account Issues

**Problem**: "Account not found"
```bash
# Solution: Create keystore
./scripts/account_from_key.sh
```

**Problem**: "Insufficient balance"
```bash
# Solution: Fund your Sepolia account
# Get testnet ETH from faucet
```

### Permission Errors

**Problem**: "Writer permission denied"
```bash
# Solution: Check [writers] section in dojo config
# Ensure your actions are listed as writers for your models
```

## Deployment Checklist

### Before First Local Deploy
- [ ] DevContainer running (or local tools installed)
- [ ] `sozo build` succeeds
- [ ] Tests pass (`sozo test`)
- [ ] Reviewed `dojo_dev.toml` configuration

### Before Sepolia Deploy
- [ ] Sepolia account created and funded
- [ ] `dojo_sepolia.toml` configured with account details
- [ ] Tested thoroughly on local Katana
- [ ] All tests passing
- [ ] Built with `./scripts/build_sepolia.sh`

### After Deployment
- [ ] Verify with `sozo inspect`
- [ ] Test interactions with `sozo execute`
- [ ] Save `world_address` (auto-saved in config)
- [ ] Document deployment for your team

## Best Practices

1. **Always Test Locally First**: Deploy to Katana before Sepolia
2. **Use DevContainer**: Simplifies setup and ensures consistency
3. **Version Control**: Commit `Scarb.toml` and `dojo_*.toml` files
4. **Never Commit Private Keys**: Use `.gitignore` for keystores
5. **Tag Releases**: Use git tags matching your deployment versions
6. **Monitor Deployments**: Keep track of `world_address` per environment
7. **Test Upgrades**: Test Core upgrades on local before Sepolia

## Integration with PixeLAW Dashboard

After deployment, your app will be available in the PixeLAW dashboard:

**Local**: http://localhost:3000
**Sepolia**: Use PixeLAW's public dashboard with your `world_address`

Your app will appear in the app list if `dojo_init()` ran successfully during migration.

## Next Steps After Deployment

1. **Test Your App**: Use the dashboard or direct contract calls
2. **Monitor State**: Use Torii GraphQL API for queries
3. **Iterate**: Make changes, rebuild, redeploy
4. **Share**: Once on Sepolia, share your world address with others

## Resources

- **App Template**: `app_template/`
- **Dojo Book**: https://book.dojoengine.org/
- **Sozo Documentation**: https://book.dojoengine.org/toolchain/sozo
- **PixeLAW Core**: https://github.com/pixelaw/core
- **Sepolia Faucet**: https://faucet.goerli.starknet.io/
