# World Sim Weather Iteration Handoff

> Scope: `src/world_sim/` pure data engine. This handoff describes the next weather-system iteration after the current terrain-aware temperature model. It is meant for a follow-up Agent to implement without re-opening the broader design debate.

## 1. Current State

The current climate layer lives in `src/world_sim/climate_layer.js`.

It currently does:

- terrain-weighted heat diffusion between neighboring cells;
- weak mantle-driven target temperature;
- local temperature-gradient advection, using an upwind-style sample;
- radiation cooling toward a fixed ambient temperature;
- slope-boosted thunderstorm generation.

This produces temperature movement, but not a true weather circulation. The key limitation is that wind is not stored as world state. It is temporarily inferred from local temperature gradient inside `updateClimateLayer()`, then discarded. As a result:

- no stable wind loops can persist across ticks;
- terrain cannot meaningfully redirect an existing wind field;
- crystal weather effects can only work through temperature or thunderstorm flags;
- mantle heat still has too much structural authority over climate shape;
- there is no explicit climate pressure / potential field to drive circulation.

## 2. Design Goal

The weather system does not need Earth realism. The goal is an abstract fantasy-climate model that reliably creates readable cycles:

```
temperature contrast
    -> climate potential
    -> wind field
    -> heat transport
    -> crystal / terrain feedback
    -> new temperature contrast
```

Weather should feel like an energy fluid shaped by terrain and crystals, not a direct Earth atmosphere simulation.

The intended player-facing fantasy:

- Alpha crystal zones behave like unstable weather cores.
- Beta crystal zones behave like stabilizing anchors.
- mountain ridges, basins, and passes redirect weather flow.
- mantle heat is a deep background disturbance, not the main surface climate author.
- storms form at energy boundaries, wind convergence zones, and terrain lift zones.

## 3. Proposed Cell Fields

Add these fields to `createCell()` in `src/world_sim/cell.js`:

| Field | Meaning | Default |
| --- | --- | --- |
| `climatePotential` | scalar weather potential that drives wind | `0` |
| `windX` | persistent local wind x component | `0` |
| `windY` | persistent local wind y component | `0` |
| `verticalMotion` | uplift / sinking proxy for storm logic | `0` |
| `crystalClimateCharge` | crystal-induced local climate anomaly | `0` |

Optional later fields:

| Field | Meaning |
| --- | --- |
| `humidity` | moisture / storm fuel |
| `rainfall` | last-tick precipitation output |
| `climateStability` | local damping / volatility accumulator |

Do not introduce humidity in the first implementation unless the wind/potential loop is already stable.

## 4. Proposed Parameters

Add to the climate section of `src/world_sim/params.js`:

```js
climateBaseTemp: -40,
climateBaseReturnRate: 0.006,
mantleClimateAnomalyScale: 12,
mantleClimateAnomalyRate: 0.004,

climatePotentialHeatScale: 0.06,
climatePotentialCrystalScale: 1.0,
climatePotentialElevationBias: 0.8,
climatePotentialBasinBias: 0.35,

windAcceleration: 0.08,
windInertia: 0.82,
windFriction: 0.06,
windMaxSpeed: 2.4,
windCirculationBias: 0.08,

terrainWindSlopeResistance: 4,
terrainWindBarrierThreshold: 0.32,
terrainWindChannelBoost: 0.35,
terrainWindBasinDamping: 0.3,

alphaClimateThermalBias: 8,
alphaClimatePotentialBias: -18,
alphaClimateStormBoost: 0.28,
alphaClimateWindTwist: 0.12,

betaClimateThermalBias: -3,
betaClimatePotentialBias: 4,
betaClimateStormDamping: 0.12,
```

Notes:

- `mantleClimateAnomalyScale` should be much lower than the current effective mantle temperature authority.
- The sign of `alphaClimatePotentialBias` defines whether Alpha pulls wind inward or pushes weather outward. Recommended first pass: Alpha is a low-potential sink that draws wind and triggers convergence storms.
- `windCirculationBias` is the abstraction that helps avoid purely radial diffusion. It is not Earth Coriolis; it is a fantasy-world circulation bias.

## 5. Suggested Climate Pipeline

Refactor `updateClimateLayer()` into internal helper sections, still inside `climate_layer.js` unless it approaches 500 lines. If it gets close to the limit, split into `climate_wind.js` or `climate_utils.js`.

Recommended order:

### 5.1 Crystal Climate Charge

Before potential/wind calculation, derive per-cell crystal weather charge:

```js
if (cell.crystalState === CELL_TYPE.ALPHA) {
    cell.crystalClimateCharge = alphaClimatePotentialBias +
        Math.min(alphaClimateStormBoost * cell.storedEnergy, someCap);
} else if (cell.crystalState === CELL_TYPE.BETA) {
    cell.crystalClimateCharge = betaClimatePotentialBias;
} else {
    cell.crystalClimateCharge *= 0.9;
}
```

Keep this as a pure climate interpretation of crystal state. Do not move crystal energy logic into the climate layer.

### 5.2 Base Temperature

Replace the direct mantle target with a gentler base-temperature model:

```js
baseTemp =
    climateBaseTemp
    - terrainElevation * terrainElevationCooling
    + basinRetention
    + weakMantleAnomaly
    + crystalThermalBias;
```

Temperature should drift toward this base, not snap toward mantle energy.

### 5.3 Climate Potential

Compute potential from heat, crystal charge, elevation, and basin terms:

```js
cell.climatePotential =
    cell.temperature * climatePotentialHeatScale
    + cell.crystalClimateCharge * climatePotentialCrystalScale
    - cell.terrainElevation * climatePotentialElevationBias
    + cell.terrainBasinDepth * climatePotentialBasinBias;
```

Interpretation:

- hot / unstable zones raise or lower potential depending on chosen sign;
- Alpha injects abnormal potential;
- high terrain and basins alter flow without rewriting temperature directly.

### 5.4 Wind Update

Use neighboring potential gradient to accelerate persistent wind:

```js
forceX = -gradientX(climatePotential);
forceY = -gradientY(climatePotential);

windX = windX * windInertia + forceX * windAcceleration;
windY = windY * windInertia + forceY * windAcceleration;
```

Then apply:

- terrain blocking across steep height steps;
- valley/pass channel boost;
- basin damping;
- optional twist / circulation bias:

```js
twistX = -windY * windCirculationBias;
twistY = windX * windCirculationBias;
```

Clamp final speed to `windMaxSpeed`.

### 5.5 Heat Advection

Reuse the existing upwind sampling idea, but read persistent `cell.windX / cell.windY` instead of deriving wind from temperature gradient.

The current temperature-gradient advection should be removed or reduced to a minor local turbulence term.

### 5.6 Storms

Storms should be driven by a combination of:

- high local `verticalMotion`;
- wind convergence;
- strong temperature difference;
- Alpha storm boost;
- terrain orographic lift.

Suggested storm score:

```js
stormScore =
    tempContrast * tempStormScale
    + convergence * convergenceStormScale
    + verticalMotion * upliftStormScale
    + alphaNeighborBoost
    - betaNeighborDamping;
```

Then compare to `thunderstormThreshold`.

## 6. Terrain Rules

Terrain should shape wind, not directly decide the final weather result.

Implement these rules:

- steep height steps reduce cross-slope wind transfer;
- wind aligned with a valley / pass gets a modest speed boost;
- basin cells damp wind and retain temperature longer;
- wind hitting an upslope creates positive `verticalMotion`;
- descending wind creates negative `verticalMotion` and lowers storm chance.

Do not:

- make mountains absolute walls;
- hard-code one route for tests;
- let climate write terrain fields;
- make terrain affect Alpha mantle absorption.

## 7. Crystal Weather Rules

Crystal should materially affect climate, but through clear knobs:

### Alpha

Alpha should:

- bias local climate potential;
- increase storm chance;
- twist or destabilize wind;
- heat or destabilize nearby temperature slightly;
- receive energy from thunderstorms as it already does in crystal layer.

Alpha should not:

- directly rewrite wind everywhere;
- instantly override regional terrain flow;
- set temperature to an extreme value in one tick.

### Beta

Beta should:

- stabilize local potential;
- slightly cool or damp temperature volatility;
- reduce storm chance;
- make nearby climate more predictable.

Beta should not:

- become a stronger climate tool than Alpha;
- shut down all weather on its own.

## 8. Implementation Plan

### Phase W1: State and Parameters

Files:

- `src/world_sim/cell.js`
- `src/world_sim/params.js`
- `.cursor/rules/world_sim.md`
- `tests/validate_world_sim.mjs`

Work:

- add climate fields to `createCell()`;
- add parameter docs and defaults;
- assert all new climate fields remain finite during runtime smoke test.

### Phase W2: Persistent Wind Field

Files:

- `src/world_sim/climate_layer.js`
- optionally `src/world_sim/climate_utils.js` if line count grows too high.

Work:

- compute `climatePotential`;
- compute persistent wind from potential gradient;
- apply terrain friction/channeling/basin damping;
- replace temperature-gradient advection with persistent wind advection.

### Phase W3: Crystal Climate Feedback

Files:

- `src/world_sim/climate_layer.js`
- `src/world_sim/params.js`
- `tests/validate_world_sim.mjs`

Work:

- add Alpha/Beta climate charge;
- make Alpha increase storm score and Beta damp it;
- preserve existing crystal-layer thunderstorm charging behavior.

### Phase W4: Tests and Balancing

Add deterministic tests:

1. Wind Persistence
   - create a stable potential gradient;
   - run several ticks;
   - assert wind keeps direction and decays smoothly when gradient is removed.

2. Terrain Deflection
   - create ridge + pass;
   - assert cross-ridge wind is weaker than pass-aligned wind.

3. Crystal Storm Core
   - place Alpha cluster in otherwise stable terrain;
   - assert `crystalClimateCharge` and storm score rise near Alpha.

4. Beta Stabilizer
   - place Beta near an unstable zone;
   - assert storm score or climate charge is reduced relative to no-Beta baseline.

5. Mantle Weakness
   - equal terrain with high mantle energy should warm slowly;
   - mantle should not dominate temperature in fewer than several dozen ticks.

Keep `node tests/validate_world_sim.mjs` as the required first validation command.

## 9. Acceptance Criteria

The iteration is successful when:

- `temperature`, `climatePotential`, `windX`, `windY`, `verticalMotion`, and `crystalClimateCharge` remain finite for 200 ticks.
- wind persists across ticks and is not recomputed solely from temperature gradient.
- terrain can visibly weaken or redirect wind in deterministic tests.
- Alpha produces local climate instability without hard-overwriting temperature.
- Beta produces local stabilization without freezing the whole map.
- mantle influence is visibly weaker than before.
- all `src/world_sim/*.js` files remain below 500 lines.
- no DOM, Canvas, EventBus, or `Game` dependency is introduced.

## 10. Risks

- Too much `windCirculationBias` can make the whole world spin and erase local terrain logic.
- Too much Alpha potential can make every Alpha zone become the same storm disk.
- Too much Beta damping can make climate dead and remove the loop.
- If mantle anomaly remains too high, the model will still feel like mantle temperature diffusion.
- If advection strength is too high, temperature may smear out and reduce biome diversity.

## 11. Recommended Starting Values

Use conservative defaults first:

```js
mantleClimateAnomalyScale: 8,
mantleClimateAnomalyRate: 0.003,
windAcceleration: 0.05,
windInertia: 0.82,
windFriction: 0.08,
windMaxSpeed: 1.6,
windCirculationBias: 0.04,
alphaClimatePotentialBias: -10,
alphaClimateStormBoost: 0.18,
alphaClimateWindTwist: 0.06,
betaClimatePotentialBias: 3,
betaClimateStormDamping: 0.08,
```

After tests pass, tune upward until circulation becomes visible in data snapshots.

## 12. Handoff Summary

The next Agent should not try to make an Earth weather simulator. Build a small fantasy weather engine:

```text
weak base climate + crystal anomaly
    -> climate potential
    -> persistent terrain-shaped wind
    -> heat transport and storm score
    -> crystal charging / stabilization feedback
```

The most important architectural change is persistent wind state. Once `windX/windY` exist and are driven by `climatePotential`, the system can start producing real weather cycles instead of one-tick temperature-gradient drift.
