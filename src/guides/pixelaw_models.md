# PixeLAW Models Guide

## Overview

Models in PixeLAW are Dojo ECS components that store data. This guide covers core models, custom model patterns, and critical Dojo 1.7.1 requirements.

## Current Versions
- **Dojo Framework**: v1.7.1
- **Cairo**: v2.12.2
- **PixeLAW Core**: v0.8.0-dev

## Core Models

### Pixel Model

The fundamental model representing each pixel in the world:

**Source**: `core/contracts/src/core/models/pixel.cairo`

```cairo
#[derive(Debug, Copy, Drop, Serde, PartialEq)]
#[dojo::model]
pub struct Pixel {
    #[key]
    pub position: Position,      // (x, y) coordinates - the key
    pub app: ContractAddress,    // App controlling this pixel
    pub color: u32,              // RGB color (0xRRGGBB)
    pub created_at: u64,         // Creation timestamp
    pub updated_at: u64,         // Last modification timestamp
    pub timestamp: u64,          // App-specific timestamp
    pub owner: ContractAddress,  // Pixel owner
    pub text: felt252,           // App-specific text/data
    pub action: felt252,         // App-specific action
}
```

**Key Fields**:
- `#[key]` marks the primary key - always `Position` for pixels
- All other fields are mutable state
- `created_at` and `updated_at` managed by core actions

### Position Struct

**Source**: `core/contracts/src/core/utils.cairo`

```cairo
#[derive(Copy, Drop, Serde, Introspect, PartialEq)]
pub struct Position {
    pub x: u32,
    pub y: u32,
}
```

**Usage**:
```cairo
let position = Position { x: 10, y: 20 };
let pixel: Pixel = world.read_model(position);
```

### PixelUpdate Struct

Used for proposing pixel changes:

```cairo
#[derive(PartialEq, Debug, Copy, Drop, Serde, Introspect, DojoStore)]
pub struct PixelUpdate {
    pub position: Position,
    pub color: Option<u32>,
    pub owner: Option<ContractAddress>,
    pub app: Option<ContractAddress>,
    pub text: Option<felt252>,
    pub timestamp: Option<u64>,
    pub action: Option<felt252>,
}
```

**Pattern**: Use `Option::Some(value)` to update, `Option::None` to keep unchanged

```cairo
let pixel_update = PixelUpdate {
    position: Position { x: 10, y: 20 },
    color: Option::Some(0xFF0000),  // Change to red
    owner: Option::None,             // Keep current owner
    app: Option::Some(get_contract_address()),
    text: Option::None,
    timestamp: Option::None,
    action: Option::None,
};
```

### App Model

Registers applications in the system:

```cairo
#[derive(Debug, Copy, Drop, Serde)]
#[dojo::model]
pub struct App {
    #[key]
    pub system: ContractAddress,  // Contract address - the key
    pub name: felt252,             // App name ('chest', 'snake', etc.)
    pub icon: felt252,             // Unicode emoji (0xf09f93a6)
    pub action: felt252,           // Default UI action
}
```

## Custom Models

### Simple Model - LastAttempt

**Source**: `examples/hunter/src/app.cairo`

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct LastAttempt {
    #[key]
    pub player: ContractAddress,
    pub timestamp: u64,
}
```

**Usage**:
```cairo
// Write
let last_attempt = LastAttempt {
    player: get_caller_address(),
    timestamp: get_block_timestamp(),
};
world.write_model(@last_attempt);

// Read
let last: LastAttempt = world.read_model(player_address);
```

### Complex Model - Chest

**Source**: `examples/chest/src/app.cairo`

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Chest {
    #[key]
    pub position: Position,
    pub placed_by: ContractAddress,
    pub placed_at: u64,
    pub is_collected: bool,
    pub last_collected_at: u64,
}
```

**Pattern**: Position as key for location-based models

```cairo
// Check if chest exists at position
let chest: Chest = world.read_model(position);
if chest.placed_by.is_zero() {
    // No chest here
} else {
    // Chest exists
}
```

## CRITICAL: Enums with Default Trait (Dojo 1.7.1)

**BREAKING CHANGE**: All enums in models MUST derive `Default` and have `#[default]` attribute on one variant.

### Correct Enum Pattern

**Source**: `examples/rps/src/app.cairo`

```cairo
#[derive(Serde, Copy, Drop, PartialEq, Introspect, Default)]
pub enum State {
    #[default]  // REQUIRED - marks default variant
    None: (),
    Created: (),
    Joined: (),
    Finished: (),
}
```

### Using Enums in Models

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: u32,
    pub state: State,  // Enum field
    pub player1: ContractAddress,
    pub player2: ContractAddress,
}
```

### Common Enum Patterns

**GameState**:
```cairo
#[derive(Serde, Copy, Drop, PartialEq, Introspect, Default)]
pub enum GameState {
    #[default]
    Pending: (),
    Active: (),
    Finished: (),
}
```

**CellState** (TicTacToe):
```cairo
#[derive(Serde, Copy, Drop, PartialEq, Introspect, Default)]
pub enum CellState {
    #[default]
    Empty: (),
    X: (),
    O: (),
}
```

## Model Storage Patterns

### WorldStorage Trait

```cairo
use dojo::world::storage::WorldStorage;
use dojo::model::ModelStorage;
```

### Reading Models

```cairo
// Single namespace
let mut world = self.world(@"pixelaw");
let pixel: Pixel = world.read_model(position);

// Composite key
let chest: Chest = world.read_model(position);

// Contract address key
let app: App = world.read_model(system_address);
```

### Writing Models

```cairo
// Create and write
let pixel = Pixel {
    position,
    app: get_contract_address(),
    color: 0xFF0000,
    created_at: timestamp,
    updated_at: timestamp,
    timestamp,
    owner: player,
    text: 0,
    action: 0,
};
world.write_model(@pixel);

// Update existing
let mut pixel: Pixel = world.read_model(position);
pixel.color = 0x00FF00;
world.write_model(@pixel);
```

### Erasing Models

```cairo
let pixel: Pixel = world.read_model(position);
world.erase_model(@pixel);
```

## Multi-Namespace Pattern

Apps use dual namespaces: `pixelaw` (core) and app-specific:

```cairo
fn interact(ref self: ContractState, params: DefaultParameters) {
    // Access PixeLAW core namespace
    let mut world = self.world(@"pixelaw");
    let pixel: Pixel = world.read_model(position);

    // Access app namespace
    let mut app_world = self.world(@"chest");
    let chest: Chest = app_world.read_model(position);

    // Update in both namespaces
    world.write_model(@updated_pixel);
    app_world.write_model(@updated_chest);
}
```

## Model Validation Patterns

### Position Validation

```cairo
use pixelaw::core::utils::MAX_DIMENSION;

impl PixelUpdateTraitImpl of PixelUpdateTrait<PixelUpdate> {
    fn validate(self: PixelUpdate) {
        assert(
            self.position.x <= MAX_DIMENSION && self.position.y <= MAX_DIMENSION,
            'position overflow'
        );
    }
}
```

### Timestamp Validation

```cairo
const COOLDOWN_SECONDS: u64 = 86400; // 24 hours

let last: LastAttempt = world.read_model(player);
let current_time = get_block_timestamp();

assert(
    current_time >= last.timestamp + COOLDOWN_SECONDS,
    'Cooldown not finished'
);
```

### Owner Validation

```cairo
let pixel: Pixel = world.read_model(position);
let caller = get_caller_address();

assert(pixel.owner == caller || pixel.owner.is_zero(), 'Not owner');
```

## Common Patterns

### Checking Model Existence

```cairo
use core::num::traits::Zero;

let model: MyModel = world.read_model(key);
if model.some_contract_address.is_zero() {
    // Model doesn't exist or hasn't been initialized
} else {
    // Model exists
}
```

### Composite Keys

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct AppUser {
    #[key]
    pub system: ContractAddress,
    #[key]
    pub player: ContractAddress,
    pub action: felt252,
}

// Read with composite key
let app_user: AppUser = world.read_model((system, player));
```

### Optional Data Pattern

```cairo
// Using felt252 as "optional" (0 = none)
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct GameData {
    #[key]
    pub id: u32,
    pub extra_data: felt252,  // 0 means no data
}

// Check if has extra data
if game.extra_data != 0 {
    // Process extra data
}
```

## Common Pitfalls

### 1. Missing Default Trait on Enums

L **Wrong**:
```cairo
#[derive(Serde, Copy, Drop, PartialEq)]
pub enum State {  // Missing Default!
    None: (),
    Active: (),
}
```

 **Correct**:
```cairo
#[derive(Serde, Copy, Drop, PartialEq, Introspect, Default)]
pub enum State {
    #[default]
    None: (),
    Active: (),
}
```

### 2. Wrong Key Type

L **Wrong**:
```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Pixel {
    pub position: Position,  // Missing #[key]!
    pub color: u32,
}
```

 **Correct**:
```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Pixel {
    #[key]
    pub position: Position,
    pub color: u32,
}
```

### 3. Not Using WorldStorage

L **Wrong**:
```cairo
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

let pixel = get!(world, position, (Pixel));  // Old Dojo pattern!
```

 **Correct**:
```cairo
use dojo::world::storage::WorldStorage;
use dojo::model::ModelStorage;

let pixel: Pixel = world.read_model(position);
```

### 4. Modifying Read-Only Copy

L **Wrong**:
```cairo
let pixel: Pixel = world.read_model(position);
pixel.color = 0xFF0000;  // This only modifies the copy!
// No write_model call - changes lost
```

 **Correct**:
```cairo
let mut pixel: Pixel = world.read_model(position);
pixel.color = 0xFF0000;
world.write_model(@pixel);  // Must write back!
```

## Best Practices

1. **Use Position as Key for Spatial Models**: Location-based data should use Position
2. **Validate Bounds**: Always check MAX_DIMENSION for positions
3. **Use Zero Check for Existence**: `contract_address.is_zero()` checks if model exists
4. **Namespace Separation**: Core models in `pixelaw`, app models in app namespace
5. **Always Derive Default for Enums**: Required in Dojo 1.7.1
6. **Use Option Pattern in Updates**: `Option::Some(x)` updates, `Option::None` preserves
7. **Reference When Writing**: Always use `@model` when calling `write_model`

## Model Checklist

When creating a new model:

- [ ] Add `#[dojo::model]` attribute
- [ ] Derive: `Copy, Drop, Serde`
- [ ] Mark key field(s) with `#[key]`
- [ ] If using enums, derive `Default` and mark one variant with `#[default]`
- [ ] Choose appropriate key type (Position, ContractAddress, u32, etc.)
- [ ] Add to build-external-contracts in Scarb.toml if needed

## Next Steps

- **Understand Systems**: See `pixelaw_systems` guide
- **Learn Hooks**: Check `pixelaw_hooks` guide
- **Test Models**: Review `pixelaw_testing` guide
- **Advanced Patterns**: Explore `pixelaw_patterns` guide

## Resources

- **Core Models**: `contract_development/core/contracts/src/core/models/`
- **Example Models**: `contract_development/examples/*/src/app.cairo`
- **Dojo Book**: https://book.dojoengine.org/framework/models
