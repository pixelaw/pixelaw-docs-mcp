# PixeLAW Systems Guide

## Overview

Systems in PixeLAW are smart contracts that implement game logic and pixel interactions. This guide covers contract implementation patterns, WorldStorage usage, and core actions integration.

## Current Versions
- **Dojo Framework**: v1.7.1
- **Cairo**: v2.12.2
- **PixeLAW Core**: v0.8.0-dev

## Contract Structure

### Basic Contract Pattern

```cairo
#[dojo::contract]
pub mod my_app_actions {
    use dojo::model::ModelStorage;
    use dojo::world::storage::WorldStorage;
    use pixelaw::core::actions::{IActionsDispatcher, IActionsDispatcherTrait};
    use pixelaw::core::models::pixel::{Pixel, PixelUpdate, PixelUpdateResultTrait};
    use pixelaw::core::utils::{get_core_actions, get_callers, DefaultParameters};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    fn dojo_init(ref self: ContractState) {
        // Initialization code
    }

    #[abi(embed_v0)]
    impl Actions of IMyAppActions<ContractState> {
        // Implementation functions
    }
}
```

### Contract Interface

Define your app's interface:

```cairo
#[starknet::interface]
pub trait IMyAppActions<T> {
    fn on_pre_update(
        ref self: T,
        pixel_update: PixelUpdate,
        app_caller: App,
        player_caller: ContractAddress,
    ) -> Option<PixelUpdate>;

    fn on_post_update(
        ref self: T,
        pixel_update: PixelUpdate,
        app_caller: App,
        player_caller: ContractAddress,
    );

    fn interact(ref self: T, default_params: DefaultParameters);
}
```

## Initialization (dojo_init)

**Pattern**: Register your app in the dojo_init function

```cairo
fn dojo_init(ref self: ContractState) {
    let mut world = self.world(@"pixelaw");
    let core_actions = get_core_actions(ref world);

    core_actions.new_app(
        0.try_into().unwrap(),  // system address (0 = use caller)
        'my_app',               // app name
        0xf09f93a6,            // icon (Unicode emoji)
    );
}
```

**Key Points**:
- Called automatically during deployment (Dojo 1.7.1+)
- Must access `pixelaw` namespace for core actions
- Registers app with name and icon

## WorldStorage Pattern

### Accessing Multiple Namespaces

```cairo
fn interact(ref self: ContractState, default_params: DefaultParameters) {
    // Access PixeLAW core namespace
    let mut world = self.world(@"pixelaw");

    // Access app-specific namespace
    let mut app_world = self.world(@"my_app");

    // Read from core
    let pixel: Pixel = world.read_model(position);

    // Read from app
    let my_data: MyModel = app_world.read_model(key);
}
```

### Core Actions Integration

```cairo
use pixelaw::core::utils::get_core_actions;

let mut world = self.world(@"pixelaw");
let core_actions = get_core_actions(ref world);

// Now use core_actions methods
core_actions.update_pixel(/* ... */);
```

## Core Actions Methods

### update_pixel

The primary method for modifying pixels:

```cairo
let pixel_update = PixelUpdate {
    position,
    color: Option::Some(0xFF0000),
    owner: Option::None,
    app: Option::Some(get_contract_address()),
    text: Option::None,
    timestamp: Option::None,
    action: Option::None,
};

let result = core_actions.update_pixel(
    player,                  // for_player
    get_contract_address(),  // for_system
    pixel_update,            // pixel_update
    Option::None,            // area_id_hint
    false                    // allow_modify
);

result.unwrap();  // Panics if update not allowed
```

**Parameters**:
- `for_player`: Player making the update
- `for_system`: System/app making the update
- `pixel_update`: Proposed changes
- `area_id_hint`: Optional area ownership check
- `allow_modify`: Whether to allow hook modifications

### schedule_queue

Schedule actions for future execution:

```cairo
use pixelaw::core::utils::selector;

let mut calldata = ArrayTrait::new();
position.add_to_calldata(ref calldata);
calldata.append(color.into());

core_actions.schedule_queue(
    timestamp + 100,         // When to execute (100 seconds from now)
    get_contract_address(),  // Which contract to call
    selector!("fade"),       // Which function to call
    calldata.span()          // Function parameters
);
```

### new_app

Register a new app (called in dojo_init):

```cairo
let app = core_actions.new_app(
    0.try_into().unwrap(),  // system (0 = use caller)
    'my_app',               // name
    0xf09f8ea8,            // icon
);
```

## Complete System Example: Chest

**Source**: `examples/chest/src/app.cairo`

```cairo
#[dojo::contract]
pub mod chest_actions {
    use dojo::model::ModelStorage;
    use pixelaw::core::actions::IActionsDispatcherTrait as ICoreActionsDispatcherTrait;
    use pixelaw::core::models::pixel::{Pixel, PixelUpdate, PixelUpdateResultTrait};
    use pixelaw::core::utils::{DefaultParameters, get_callers, get_core_actions};
    use starknet::{ContractAddress, get_block_timestamp, get_contract_address};
    use super::{Chest, IChestActions};

    fn dojo_init(ref self: ContractState) {
        let mut world = self.world(@"pixelaw");
        let core_actions = get_core_actions(ref world);
        core_actions.new_app(0.try_into().unwrap(), 'chest', 0xf09f93a6);
    }

    #[abi(embed_v0)]
    impl Actions of IChestActions<ContractState> {
        fn interact(ref self: ContractState, default_params: DefaultParameters) {
            let mut world = self.world(@"pixelaw");
            let mut app_world = self.world(@"chest");
            let position = default_params.position;

            // Get caller info
            let (player, system) = get_callers(ref world, default_params);

            // Read pixel state
            let pixel: Pixel = world.read_model(position);

            // Read chest state
            let chest: Chest = app_world.read_model(position);

            if chest.placed_by.is_zero() {
                // No chest - place one
                self.place_chest(default_params);
            } else {
                // Chest exists - collect it
                self.collect_chest(default_params);
            }
        }

        fn place_chest(ref self: ContractState, default_params: DefaultParameters) {
            let mut world = self.world(@"pixelaw");
            let mut app_world = self.world(@"chest");
            let position = default_params.position;
            let (player, system) = get_callers(ref world, default_params);
            let timestamp = get_block_timestamp();

            // Create chest model
            let chest = Chest {
                position,
                placed_by: player,
                placed_at: timestamp,
                is_collected: false,
                last_collected_at: 0,
            };
            app_world.write_model(@chest);

            // Update pixel
            let pixel_update = PixelUpdate {
                position,
                color: Option::Some(0xf09f93a6),  // Chest color
                owner: Option::Some(player),
                app: Option::Some(system),
                text: Option::Some('chest'),
                timestamp: Option::None,
                action: Option::None,
            };

            let core_actions = get_core_actions(ref world);
            core_actions
                .update_pixel(player, system, pixel_update, Option::None, false)
                .unwrap();
        }
    }
}
```

## Helper Functions

### get_callers

Gets player and system addresses:

```cairo
use pixelaw::core::utils::get_callers;

let (player, system) = get_callers(ref world, default_params);
```

**Returns**:
- `player`: The player making the call (from default_params or get_caller_address())
- `system`: The calling system contract (get_contract_address())

### get_core_actions

Gets the core actions dispatcher:

```cairo
use pixelaw::core::utils::get_core_actions;

let mut world = self.world(@"pixelaw");
let core_actions = get_core_actions(ref world);
```

## Reading and Writing State

### Reading Models

```cairo
// Read pixel
let pixel: Pixel = world.read_model(position);

// Read custom model
let chest: Chest = app_world.read_model(position);

// Read with composite key
let app_user: AppUser = world.read_model((system, player));
```

### Writing Models

```cairo
// Write pixel (use core actions!)
let pixel_update = PixelUpdate { /* ... */ };
core_actions.update_pixel(player, system, pixel_update, Option::None, false);

// Write custom model
let chest = Chest { /* ... */ };
app_world.write_model(@chest);
```

### Checking Existence

```cairo
use core::num::traits::Zero;

let chest: Chest = app_world.read_model(position);
if chest.placed_by.is_zero() {
    // Chest doesn't exist
} else {
    // Chest exists
}
```

## Common Patterns

### DefaultParameters

Standard input structure for most interactions:

```cairo
use pixelaw::core::utils::DefaultParameters;

fn interact(ref self: ContractState, default_params: DefaultParameters) {
    let position = default_params.position;
    let color = default_params.color;
    let player = default_params.for_player;
    let system = default_params.for_system;
}
```

### Timestamp Usage

```cairo
use starknet::get_block_timestamp;

let timestamp = get_block_timestamp();
let cooldown_end = timestamp + COOLDOWN_SECONDS;
```

### Cooldown Pattern

```cairo
const COOLDOWN_SECONDS: u64 = 86400;  // 24 hours

let chest: Chest = app_world.read_model(position);
let current_time = get_block_timestamp();

assert(
    current_time >= chest.last_collected_at + COOLDOWN_SECONDS,
    'Cooldown not finished'
);
```

### Multi-Pixel Operations

```cairo
// Update multiple pixels
for i in 0..width {
    let pos = Position { x: start_x + i, y };
    let pixel_update = PixelUpdate {
        position: pos,
        color: Option::Some(colors[i]),
        // ...
    };
    core_actions.update_pixel(player, system, pixel_update, Option::None, false);
}
```

## Error Handling

### Using assert

```cairo
assert(pixel.owner == player || pixel.owner.is_zero(), 'Not pixel owner');
assert(chest.is_collected == false, 'Already collected');
assert(timestamp >= cooldown_end, 'Cooldown active');
```

### Using panic!

```cairo
use pixelaw::core::utils::panic_at_position;

if pixel.owner != player {
    panic_at_position(position, 'Not owner');
}
```

### Unwrapping Results

```cairo
let result = core_actions.update_pixel(/* ... */);
result.unwrap();  // Panics with descriptive message if failed
```

## Common Pitfalls

### 1. Bypassing Core Actions

L **Wrong**:
```cairo
let mut pixel: Pixel = world.read_model(position);
pixel.color = 0xFF0000;
world.write_model(@pixel);  // Bypasses permissions!
```

 **Correct**:
```cairo
let pixel_update = PixelUpdate {
    position,
    color: Option::Some(0xFF0000),
    // ...
};
core_actions.update_pixel(player, system, pixel_update, Option::None, false);
```

### 2. Wrong Namespace

L **Wrong**:
```cairo
let mut world = self.world(@"my_app");
let pixel: Pixel = world.read_model(position);  // Won't find it!
```

 **Correct**:
```cairo
let mut world = self.world(@"pixelaw");  // Core models in pixelaw namespace
let pixel: Pixel = world.read_model(position);
```

### 3. Not Using ref for WorldStorage

L **Wrong**:
```cairo
let mut world = self.world(@"pixelaw");
let core_actions = get_core_actions(world);  // Missing ref!
```

 **Correct**:
```cairo
let mut world = self.world(@"pixelaw");
let core_actions = get_core_actions(ref world);
```

## Best Practices

1. **Always Use Core Actions**: Never modify pixels directly
2. **Separate Namespaces**: Core models in `pixelaw`, app models in app namespace
3. **Validate Inputs**: Check ownership, cooldowns, existence before operations
4. **Use Helper Functions**: `get_callers`, `get_core_actions`, `panic_at_position`
5. **Handle Errors Gracefully**: Use descriptive error messages
6. **Test Thoroughly**: Write comprehensive tests for all code paths

## System Implementation Checklist

When implementing a new system:

- [ ] Define interface with `#[starknet::interface]`
- [ ] Implement contract with `#[dojo::contract]`
- [ ] Add `dojo_init` to register app
- [ ] Implement required hooks (`on_pre_update`, `on_post_update`)
- [ ] Implement `interact` function
- [ ] Use `WorldStorage` for model access
- [ ] Access correct namespaces (`pixelaw` for core, app name for custom)
- [ ] Always use core actions for pixel updates
- [ ] Validate all inputs and permissions
- [ ] Write comprehensive tests

## Next Steps

- **Learn Hooks**: See `pixelaw_hooks` guide
- **Write Tests**: Review `pixelaw_testing` guide
- **Deploy**: Follow `pixelaw_deployment` guide
- **Advanced Patterns**: Explore `pixelaw_patterns` guide

## Resources

- **Core Actions**: `core/contracts/src/core/actions.cairo`
- **Example Systems**: `examples/*/src/app.cairo`
- **Paint App**: `core/contracts/src/apps/paint.cairo`
- **Chest App**: `examples/chest/src/app.cairo`
