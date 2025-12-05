# PixeLAW Patterns Guide

## Overview

Common patterns and best practices for building advanced PixeLAW applications.

## Queue System

Schedule actions for future execution.

### Basic Queue Pattern

```cairo
use pixelaw::core::utils::selector;

fn schedule_action(
    ref self: ContractState,
    position: Position,
    delay_seconds: u64
) {
    let mut world = self.world(@"pixelaw");
    let core_actions = get_core_actions(ref world);

    let mut calldata = ArrayTrait::new();
    position.add_to_calldata(ref calldata);

    core_actions.schedule_queue(
        get_block_timestamp() + delay_seconds,
        get_contract_address(),
        selector!("callback_function"),
        calldata.span()
    );
}

fn callback_function(
    ref self: ContractState,
    position: Position
) {
    // Executed after delay
}
```

### Fading Color Pattern

**Source**: `core/contracts/src/apps/paint.cairo`

```cairo
fn fade(ref self: ContractState, default_params: DefaultParameters) {
    let mut world = self.world(@"pixelaw");
    let core_actions = get_core_actions(ref world);
    let position = default_params.position;
    let pixel: Pixel = world.read_model(position);

    let (r, g, b, a) = decode_rgba(pixel.color);
    let new_a = subu8(a, 5);  // Reduce alpha

    if new_a > 0 {
        // Schedule next fade
        let mut calldata = ArrayTrait::new();
        position.add_to_calldata(ref calldata);

        core_actions.schedule_queue(
            get_block_timestamp() + 2,  // Fade every 2 seconds
            get_contract_address(),
            selector!("fade"),
            calldata.span()
        );

        // Update color
        let pixel_update = PixelUpdate {
            position,
            color: Option::Some(encode_rgba(r, g, b, new_a)),
            // ...
        };
        core_actions.update_pixel(/* ... */, pixel_update, /* ... */);
    }
}
```

## Cooldown Pattern

Prevent rapid repeated actions.

### Basic Cooldown

**Source**: `examples/chest/src/app.cairo`

```cairo
const COOLDOWN_SECONDS: u64 = 86400;  // 24 hours

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct LastAction {
    #[key]
    pub player: ContractAddress,
    pub timestamp: u64,
}

fn action_with_cooldown(
    ref self: ContractState,
    params: DefaultParameters
) {
    let mut world = self.world(@"my_app");
    let player = get_caller_address();
    let current_time = get_block_timestamp();

    // Check cooldown
    let last: LastAction = world.read_model(player);
    assert(
        current_time >= last.timestamp + COOLDOWN_SECONDS,
        'Cooldown not finished'
    );

    // Perform action
    // ...

    // Update timestamp
    world.write_model(@LastAction {
        player,
        timestamp: current_time,
    });
}
```

### Per-Pixel Cooldown

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct PixelCooldown {
    #[key]
    pub position: Position,
    #[key]
    pub player: ContractAddress,
    pub last_interaction: u64,
}
```

## Area Management

Using R-Tree for spatial queries.

### Creating an Area

```cairo
fn create_area(
    ref self: ContractState,
    top_left: Position,
    width: u32,
    height: u32
) {
    let mut world = self.world(@"pixelaw");
    let core_actions = get_core_actions(ref world);
    let player = get_caller_address();

    let area = Area {
        id: 0,  // Auto-assigned
        position: top_left,
        width,
        height,
        color: 0xFFFFFF,
        owner: player,
    };

    world.write_model(@area);
}
```

### Area Ownership Check

```cairo
fn requires_area_ownership(
    ref self: ContractState,
    position: Position
) {
    let mut world = self.world(@"pixelaw");
    let player = get_caller_address();

    // Query areas at position
    let areas = world.query_areas(position);

    let mut owned = false;
    for area in areas {
        if area.owner == player {
            owned = true;
            break;
        }
    }

    assert(owned, 'Must own area');
}
```

### House Building Pattern

**Source**: `core/contracts/src/apps/house.cairo`

```cairo
fn build_house(
    ref self: ContractState,
    params: DefaultParameters,
    width: u32,
    height: u32
) {
    // 1. Claim area
    let area = create_area(params.position, width, height);

    // 2. Paint pixels in area
    for x in 0..width {
        for y in 0..height {
            let pos = Position {
                x: params.position.x + x,
                y: params.position.y + y,
            };
            paint_pixel(pos, HOUSE_COLOR);
        }
    }
}
```

## Commit-Reveal Pattern

For cryptographic randomness.

**Source**: `examples/rps/src/app.cairo`

### Commit Phase

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Commitment {
    #[key]
    pub game_id: u32,
    #[key]
    pub player: ContractAddress,
    pub hash: felt252,
}

fn commit_move(
    ref self: ContractState,
    game_id: u32,
    move_hash: felt252  // hash(move, salt)
) {
    let mut world = self.world(@"rps");
    let player = get_caller_address();

    world.write_model(@Commitment {
        game_id,
        player,
        hash: move_hash,
    });
}
```

### Reveal Phase

```cairo
fn reveal_move(
    ref self: ContractState,
    game_id: u32,
    move_value: Move,
    salt: felt252
) {
    let mut world = self.world(@"rps");
    let player = get_caller_address();

    // Verify hash
    let commitment: Commitment = world.read_model((game_id, player));
    let computed_hash = poseidon_hash_span(
        array![move_value.into(), salt].span()
    );

    assert(commitment.hash == computed_hash, 'Invalid reveal');

    // Process move
    // ...
}
```

## Cryptographic Randomness

Using Poseidon hash for deterministic randomness.

**Source**: `examples/hunter/src/app.cairo`

### Random Chance Pattern

```cairo
use core::poseidon::poseidon_hash_span;

fn random_action(ref self: ContractState, position: Position) {
    let timestamp = get_block_timestamp();
    let player = get_caller_address();

    // Generate pseudo-random number
    let random = poseidon_hash_span(
        array![
            timestamp.into(),
            player.into(),
            position.x.into(),
            position.y.into(),
        ].span()
    );

    // Convert to percentage (0-99)
    let chance = (random.low % 100).try_into().unwrap();

    if chance < 30 {  // 30% chance
        // Success
    } else {
        // Failure
    }
}
```

## Multi-Pixel Coordination

Managing multiple pixels as a single entity.

### Grid Pattern (2048)

**Source**: `examples/pix2048/src/app.cairo`

```cairo
const GRID_SIZE: u32 = 4;

fn setup_grid(ref self: ContractState, top_left: Position) {
    for x in 0..GRID_SIZE {
        for y in 0..GRID_SIZE {
            let pos = Position {
                x: top_left.x + x,
                y: top_left.y + y,
            };

            initialize_cell(pos, 0);  // Empty cell
        }
    }
}

fn move_tiles(ref self: ContractState, direction: Direction) {
    // Read all grid cells
    let mut grid = read_grid();

    // Apply move logic
    grid = apply_direction(grid, direction);

    // Write back
    write_grid(grid);
}
```

### Maze Pattern

**Source**: `examples/maze/src/app.cairo`

```cairo
fn create_maze(ref self: ContractState, layout: Span<u32>) {
    let width = MAZE_WIDTH;

    for i in 0..layout.len() {
        let value = *layout[i];
        let x = i % width;
        let y = i / width;

        let pos = Position { x, y };
        let cell_type = get_cell_type(value);

        setup_maze_cell(pos, cell_type);
    }
}
```

## State Machine Pattern

Managing game states.

```cairo
#[derive(Serde, Copy, Drop, PartialEq, Introspect, Default)]
pub enum GameState {
    #[default]
    Waiting: (),
    Active: (),
    Finished: (),
}

fn advance_state(ref self: ContractState, game_id: u32) {
    let mut world = self.world(@"my_app");
    let mut game: Game = world.read_model(game_id);

    match game.state {
        GameState::Waiting => {
            if can_start(game) {
                game.state = GameState::Active;
            }
        },
        GameState::Active => {
            if is_finished(game) {
                game.state = GameState::Finished;
                distribute_rewards(game);
            }
        },
        GameState::Finished => {
            // Game over
        },
    }

    world.write_model(@game);
}
```

## Resource Management

### Limited Supply Pattern

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Supply {
    #[key]
    pub resource_type: felt252,
    pub remaining: u32,
    pub max_supply: u32,
}

fn consume_resource(
    ref self: ContractState,
    resource_type: felt252,
    amount: u32
) {
    let mut world = self.world(@"my_app");
    let mut supply: Supply = world.read_model(resource_type);

    assert(supply.remaining >= amount, 'Insufficient supply');

    supply.remaining -= amount;
    world.write_model(@supply);
}
```

## Leaderboard Pattern

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Score {
    #[key]
    pub player: ContractAddress,
    pub points: u64,
    pub rank: u32,
}

fn update_score(
    ref self: ContractState,
    player: ContractAddress,
    points_earned: u64
) {
    let mut world = self.world(@"my_app");
    let mut score: Score = world.read_model(player);

    score.points += points_earned;
    world.write_model(@score);

    // Recalculate ranks (expensive - consider off-chain)
    update_rankings();
}
```

## Event Emission

```cairo
#[derive(Copy, Drop, Serde)]
#[dojo::event]
pub struct GameWon {
    #[key]
    pub game_id: u32,
    pub winner: ContractAddress,
    pub score: u64,
}

fn emit_victory(
    ref self: ContractState,
    game_id: u32,
    winner: ContractAddress,
    score: u64
) {
    let mut world = self.world(@"my_app");

    world.emit_event(@GameWon {
        game_id,
        winner,
        score,
    });
}
```

## Best Practices

1. **Use Queue for Delays**: Don't rely on block timestamps alone
2. **Validate Randomness Sources**: Poseidon hash is deterministic
3. **Gas Optimization**: Batch pixel updates when possible
4. **Area Queries**: Use R-Tree for efficient spatial lookups
5. **State Machines**: Clear state transitions prevent bugs
6. **Cooldowns**: Prevent spam and resource exhaustion
7. **Commit-Reveal**: Essential for PvP with hidden information

## Anti-Patterns

### L Don't Store Large Arrays

```cairo
// Bad: On-chain storage is expensive
pub struct GameBoard {
    #[key]
    pub id: u32,
    pub cells: Array<u32>,  // Expensive!
}
```

 **Better**: Store individual cells

```cairo
pub struct Cell {
    #[key]
    pub game_id: u32,
    #[key]
    pub index: u32,
    pub value: u32,
}
```

### L Don't Poll for Changes

Use events and queue system instead.

### L Don't Rely on Block Hash

Use Poseidon hash of multiple inputs for randomness.

## Resources

- **Queue**: `core/contracts/src/core/actions/queue.cairo`
- **Areas**: `core/contracts/src/core/models/area.cairo`
- **RPS**: `examples/rps/src/app.cairo`
- **Hunter**: `examples/hunter/src/app.cairo`
- **Pix2048**: `examples/pix2048/src/app.cairo`
- **Maze**: `examples/maze/src/app.cairo`
