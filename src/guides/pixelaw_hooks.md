# PixeLAW Hooks Guide

## Overview

The hook system enables App2App interactions in PixeLAW. Apps can control how other apps interact with their pixels through pre and post-update hooks.

## Hook Methods

### on_pre_update

Called **before** a pixel update. Can modify or block the update.

**Signature**:
```cairo
fn on_pre_update(
    ref self: T,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate>;
```

**Return Values**:
- `Option::None` - Block the update entirely
- `Option::Some(modified_update)` - Allow with modifications
- `Option::Some(pixel_update)` - Allow unchanged

### on_post_update

Called **after** a successful pixel update. Cannot modify or block.

**Signature**:
```cairo
fn on_post_update(
    ref self: T,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
);
```

## Hook Patterns

### Block All Updates (Default)

```cairo
fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    Option::None  // Block everything
}
```

### Allow Specific App (Paint + Snake)

**Source**: `core/contracts/src/apps/paint.cairo`

```cairo
fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    let mut result = Option::None;

    if app_caller.name == 'snake' {
        if pixel_update.owner.is_some() || pixel_update.app.is_some() {
            // Block ownership changes
            result = Option::None;
        } else {
            // Allow color changes only
            result = Option::Some(pixel_update);
        }
    }

    result
}
```

### Allow All Updates

```cairo
fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    Option::Some(pixel_update)  // Allow everything
}
```

### Modify Update

```cairo
fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    let mut modified = pixel_update;

    // Force specific color
    modified.color = Option::Some(0x00FF00);

    // Block ownership change
    modified.owner = Option::None;

    Option::Some(modified)
}
```

## Post-Hook Patterns

### Track Statistics

```cairo
fn on_post_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) {
    let mut world = self.world(@"my_app");

    // Update stats
    let mut stats: Stats = world.read_model(player_caller);
    stats.interactions += 1;
    world.write_model(@stats);
}
```

### Trigger Side Effects

```cairo
fn on_post_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) {
    // Schedule future action
    let mut world = self.world(@"pixelaw");
    let core_actions = get_core_actions(ref world);

    let mut calldata = ArrayTrait::new();
    pixel_update.position.add_to_calldata(ref calldata);

    core_actions.schedule_queue(
        get_block_timestamp() + 100,
        get_contract_address(),
        selector!("cleanup"),
        calldata.span()
    );
}
```

## Permission System

### Field-Level Permissions

Control which fields can be modified:

```cairo
fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    let mut allowed = pixel_update;

    // Allow color changes only
    allowed.owner = Option::None;
    allowed.app = Option::None;
    allowed.text = Option::None;
    allowed.timestamp = Option::None;
    allowed.action = Option::None;

    Option::Some(allowed)
}
```

### Owner-Based Permissions

```cairo
fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    let mut world = self.world(@"pixelaw");
    let pixel: Pixel = world.read_model(pixel_update.position);

    // Only owner can update
    if pixel.owner == player_caller || pixel.owner.is_zero() {
        Option::Some(pixel_update)
    } else {
        Option::None
    }
}
```

### App-Based Permissions

```cairo
fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    // Whitelist specific apps
    if app_caller.name == 'paint' || app_caller.name == 'snake' {
        Option::Some(pixel_update)
    } else {
        Option::None
    }
}
```

## Best Practices

1. **Default to Block**: Return `Option::None` by default for security
2. **Validate Callers**: Check `app_caller` and `player_caller` before allowing
3. **Minimal Modifications**: Only modify what's necessary in pre-hooks
4. **Avoid Heavy Logic**: Keep hooks lightweight to save gas
5. **Use Post-Hooks for Effects**: Side effects go in `on_post_update`

## Common Patterns

### Cooldown Check (Pre-Hook)

```cairo
const COOLDOWN: u64 = 60;

fn on_pre_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) -> Option<PixelUpdate> {
    let mut world = self.world(@"my_app");
    let last: LastAction = world.read_model(player_caller);

    if get_block_timestamp() >= last.timestamp + COOLDOWN {
        Option::Some(pixel_update)
    } else {
        Option::None  // Cooldown active
    }
}
```

### Update Tracking (Post-Hook)

```cairo
fn on_post_update(
    ref self: ContractState,
    pixel_update: PixelUpdate,
    app_caller: App,
    player_caller: ContractAddress,
) {
    let mut world = self.world(@"my_app");

    let last = LastAction {
        player: player_caller,
        timestamp: get_block_timestamp(),
        position: pixel_update.position,
    };
    world.write_model(@last);
}
```

## Resources

- **Paint Hooks**: `core/contracts/src/apps/paint.cairo`
- **Chest Hooks**: `examples/chest/src/app.cairo`
- **Core Actions**: `core/contracts/src/core/actions/pixel.cairo`
