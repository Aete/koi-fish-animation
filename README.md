# Koi Fish Pond - Interactive Art

An interactive ink wash / watercolor style koi fish pond built with p5.js.

## Project Structure

```
koi-fish-animation/
├── src/
│   ├── agent/          # Fish agent (IK skeleton + autonomous behavior)
│   │   ├── Fish.ts     # Fish class (rendering, wander, scatter)
│   │   └── Segment.ts  # IK chain segment
│   ├── world/          # World physics
│   │   └── Physics.ts  # Physics engine (boundary, drag, flow field)
│   ├── material/       # Material properties
│   │   └── Water.ts    # Water density, viscosity, drag
│   ├── effects/        # Visual & audio effects
│   │   ├── Ripple.ts   # Ripple wave (distortion + scatter force)
│   │   └── DropSound.ts # Water drop sound effect
│   ├── gui/            # Tuning parameters
│   │   ├── FinParams.ts    # Fin rendering constants
│   │   └── RippleParams.ts # Ripple behavior constants
│   ├── types/          # TypeScript type definitions
│   │   ├── QualitySettings.ts # Desktop / mobile quality presets
│   │   └── p5.brush.d.ts
│   └── main.ts         # Main simulation entry point
├── index.html
├── package.json
└── tsconfig.json
```

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build
```

## Interaction

- **Click / Tap**: Creates a ripple that scatters nearby fish
- Haptic feedback on mobile (Android)
- Water drop sound effect on each click

## Features

- **Ink wash rendering**: Layered semi-transparent strokes that mimic traditional ink painting
- **IK-based fish skeleton**: 8-segment inverse kinematics with sine-wave swim animation
- **Autonomous wander**: Each fish roams freely using Nature of Code wander behavior
- **Ripple interaction**: Click to create ripples that distort the water and scatter fish
- **Screen wraparound**: Fish that swim off one edge reappear on the opposite side
- **Accent spots & fins**: Randomized vermilion or blue color accents per fish
- **Mobile optimized**: Reduced fish count, lower subdivisions, capped frame rate on mobile
- **Responsive canvas**: Automatically resizes to fit the browser window

## Tech Stack

- **Vite** - Fast dev server & build tool
- **TypeScript** - Type safety
- **p5.js** - Creative coding library
