# PixeLAW Testing Guide

## Overview

Comprehensive testing strategies for PixeLAW applications using Dojo 1.7.1 test utilities.

## Test Setup

### Basic Test Structure

```cairo
#[cfg(test)]
mod tests {
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, world};
    use dojo_cairo_test::{spawn_test_world, TestResource, NamespaceDef, ContractDef};
    use pixelaw_test_utils::{setup_core, deploy_app, set_caller, set_block_timestamp};
    use pixelaw::core::models::pixel::Pixel;
    use starknet::ContractAddress;

    #[test]
    fn test_my_feature() {
        // Setup
        let (world, core_actions, player, my_app) = setup();

        // Test logic
        // ...

        // Assertions
        assert(condition, 'Error message');
    }
}
```

### Setup Helper Pattern

```cairo
fn setup() -> (WorldStorage, IActionsDispatcher, ContractAddress, IMyAppDispatcher) {
    // 1. Spawn test world
    let namespace_def = NamespaceDef {
        namespace: "pixelaw", resources: [
            TestResource::Model(m_Pixel::TEST_CLASS_HASH),
            TestResource::Model(m_App::TEST_CLASS_HASH),
            TestResource::Event(e_QueueScheduled::TEST_CLASS_HASH),
            TestResource::Contract(actions::TEST_CLASS_HASH),
        ].span()
    };

    let mut world = spawn_test_world([namespace_def].span());

    // 2. Setup core
    world.sync_perms_and_inits([
        ContractDef {
            namespace: "pixelaw",
            name: "actions",
            address: core_actions_address,
        }
    ].span());

    setup_core(world);

    // 3. Deploy app
    let my_app = deploy_app(
        world,
        "my_app",
        my_app_actions::TEST_CLASS_HASH
    );

    // 4. Get player
    let player: ContractAddress = 0x1337.try_into().unwrap();
    set_caller(player);

    let core_actions = IActionsDispatcher {
        contract_address: world.dns(@"actions").unwrap()
    };

    (world, core_actions, player, my_app)
}
```

## Helper Functions

### setup_core

Initializes PixeLAW core (paint, snake, player, house apps):

```cairo
use pixelaw_test_utils::setup_core;

setup_core(world);
```

### deploy_app

Deploys your app to the test world:

```cairo
use pixelaw_test_utils::deploy_app;

let my_app = deploy_app(
    world,
    "my_app",               // namespace
    my_app_actions::TEST_CLASS_HASH
);
```

### set_caller

Sets the caller address for subsequent calls:

```cairo
use pixelaw_test_utils::set_caller;

let player: ContractAddress = 0x1337.try_into().unwrap();
set_caller(player);
```

### set_block_timestamp

Sets the block timestamp for testing time-based logic:

```cairo
use pixelaw_test_utils::set_block_timestamp;

set_block_timestamp(1000);

// Fast forward
set_block_timestamp(2000);
```

## Testing Patterns

### Testing Pixel Updates

```cairo
#[test]
fn test_pixel_update() {
    let (world, core_actions, player, app) = setup();
    let position = Position { x: 10, y: 20 };

    // Interact
    app.interact(DefaultParameters {
        for_player: player,
        for_system: app.contract_address,
        position,
        color: 0xFF0000,
    });

    // Verify pixel state
    let pixel: Pixel = world.read_model(position);
    assert(pixel.color == 0xFF0000, 'Wrong color');
    assert(pixel.owner == player, 'Wrong owner');
    assert(pixel.app == app.contract_address, 'Wrong app');
}
```

### Testing Cooldowns

```cairo
#[test]
fn test_cooldown() {
    let (world, core_actions, player, app) = setup();
    let position = Position { x: 10, y: 20 };

    // First interaction
    set_block_timestamp(1000);
    app.collect_chest(DefaultParameters { position, /* ... */ });

    // Try immediate second interaction (should fail)
    set_block_timestamp(1001);
    // This should panic

    // Fast forward past cooldown
    set_block_timestamp(1000 + COOLDOWN_SECONDS + 1);
    app.collect_chest(DefaultParameters { position, /* ... */ });  // Should succeed
}
```

### Testing with should_panic

```cairo
#[test]
#[should_panic(expected: ('Cooldown not finished',))]
fn test_cooldown_blocks() {
    let (world, core_actions, player, app) = setup();
    let position = Position { x: 10, y: 20 };

    app.collect_chest(DefaultParameters { position, /* ... */ });

    // Immediate second attempt should panic
    app.collect_chest(DefaultParameters { position, /* ... */ });
}
```

### Testing Hooks

```cairo
#[test]
fn test_hook_allows_snake() {
    let (world, core_actions, player, paint_app) = setup();
    let position = Position { x: 10, y: 20 };

    // Place paint pixel
    paint_app.put_color(DefaultParameters { position, color: 0xFF0000, /* ... */ });

    // Snake should be able to change color
    let snake_app = world.dns(@"snake").unwrap();
    set_caller(snake_app);

    let pixel_update = PixelUpdate {
        position,
        color: Option::Some(0x00FF00),  // Change color
        owner: Option::None,             // Don't change owner
        app: Option::None,
        text: Option::None,
        timestamp: Option::None,
        action: Option::None,
    };

    let result = core_actions.update_pixel(
        player, snake_app, pixel_update, Option::None, false
    );

    assert(result.is_ok(), 'Update should succeed');
}

#[test]
#[should_panic]
fn test_hook_blocks_ownership_change() {
    // Similar but try to change owner - should fail
}
```

### Testing Custom Models

```cairo
#[test]
fn test_custom_model() {
    let (world, core_actions, player, app) = setup();
    let position = Position { x: 10, y: 20 };

    // Place chest
    app.place_chest(DefaultParameters { position, /* ... */ });

    // Verify custom model
    let mut app_world = world;  // Already has access to app namespace
    let chest: Chest = app_world.read_model(position);

    assert(chest.placed_by == player, 'Wrong placer');
    assert(chest.is_collected == false, 'Should not be collected');
}
```

### Testing Queue System

```cairo
#[test]
fn test_queue() {
    let (world, core_actions, player, app) = setup();
    let position = Position { x: 10, y: 20 };

    set_block_timestamp(1000);

    // Trigger action that schedules queue
    app.start_fading(DefaultParameters { position, /* ... */ });

    // Verify queue item exists
    let queue_id = poseidon::poseidon_hash_span(
        array![timestamp.into(), system.into(), selector].span()
    );
    let queue_item: QueueItem = world.read_model(queue_id);
    assert(queue_item.timestamp == 1100, 'Wrong timestamp');

    // Fast forward and process
    set_block_timestamp(1100);
    core_actions.process_queue(
        queue_id,
        1100,
        app.contract_address,
        selector!("fade"),
        calldata.span()
    );
}
```

## Complete Test Example

**Source**: `examples/chest/src/tests.cairo`

```cairo
#[cfg(test)]
mod tests {
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, world};
    use pixelaw_test_utils::{setup_core, deploy_app, set_caller, set_block_timestamp};
    use super::{Chest, chest_actions, IChestActionsDispatcher, IChestActionsDispatcherTrait};
    use pixelaw::core::utils::{DefaultParameters, Position};

    const COOLDOWN: u64 = 86400;

    fn setup() -> (WorldStorage, ContractAddress, IChestActionsDispatcher) {
        let mut world = spawn_test_world(/* ... */);
        setup_core(world);

        let chest_app = deploy_app(world, "chest", chest_actions::TEST_CLASS_HASH);
        let player: ContractAddress = 0x1337.try_into().unwrap();
        set_caller(player);

        (world, player, chest_app)
    }

    #[test]
    fn test_place_and_collect() {
        let (world, player, app) = setup();
        let position = Position { x: 10, y: 20 };

        set_block_timestamp(1000);

        // Place chest
        app.place_chest(DefaultParameters {
            for_player: player,
            for_system: app.contract_address,
            position,
            color: 0,
        });

        let chest: Chest = world.read_model(position);
        assert(chest.placed_by == player, 'Wrong placer');

        // Collect
        set_block_timestamp(1001);
        app.collect_chest(DefaultParameters { position, /* ... */ });

        let chest: Chest = world.read_model(position);
        assert(chest.is_collected, 'Not collected');
    }

    #[test]
    #[should_panic(expected: ('Cooldown not finished',))]
    fn test_cooldown_enforced() {
        let (world, player, app) = setup();
        let position = Position { x: 10, y: 20 };

        set_block_timestamp(1000);

        app.place_chest(DefaultParameters { position, /* ... */ });
        app.collect_chest(DefaultParameters { position, /* ... */ });

        // Too soon!
        set_block_timestamp(1001);
        app.collect_chest(DefaultParameters { position, /* ... */ });
    }
}
```

## Namespace Testing

```cairo
#[test]
fn test_multi_namespace() {
    let (world, core_actions, player, app) = setup();

    // Access pixelaw namespace
    let pixel: Pixel = world.read_model(position);

    // Access app namespace (automatically available in test world)
    let chest: Chest = world.read_model(position);

    assert(pixel.app == app.contract_address, 'Wrong app');
    assert(chest.placed_by == player, 'Wrong placer');
}
```

## Best Practices

1. **Use Helper Functions**: `setup_core`, `deploy_app`, `set_caller`
2. **Test Both Success and Failure**: Use `#[should_panic]` for error cases
3. **Test Cooldowns**: Use `set_block_timestamp` to simulate time passage
4. **Verify All State**: Check pixels, custom models, and events
5. **Test Hooks**: Verify permission system works correctly
6. **Use Descriptive Messages**: Clear panic messages aid debugging

## Common Assertions

```cairo
// Equality
assert(actual == expected, 'Values not equal');

// Pixel state
assert(pixel.color == expected_color, 'Wrong color');
assert(pixel.owner == expected_owner, 'Wrong owner');

// Model existence
use core::num::traits::Zero;
assert(!chest.placed_by.is_zero(), 'Chest should exist');

// Timestamps
assert(current >= last + COOLDOWN, 'Cooldown active');
```

## Running Tests

```bash
# Run all tests
sozo test

# Run specific test
sozo test --filter test_place_and_collect

# Run tests for specific file
sozo test --filter chest

# Run in core directory
just test
just test_filtered "pixel"
```

## Resources

- **Test Utils**: `pixelaw_test_utils` package
- **Example Tests**: `examples/*/src/tests.cairo`
- **Core Tests**: `core/contracts/src/tests/`
