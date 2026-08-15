# SLM - Simple Logo Maker

A simple, fast, and modern web application to create clean text logos with customizable gradients, backgrounds, and any Google Font. Export your creations directly to SVG or high-resolution PNG.

## Features

- **Custom Canvas Sizing**: Flexible presets (Social, Favicon, Banner, App Icon) or custom dimensions.
- **Rich Text Elements**: Add multiple text layers with custom positioning, font sizes, weights, letter spacing, and rotation.
- **Gradients & Colors**: Support for solid colors, linear gradients, and radial gradients with customizable angle and stops.
- **Google Fonts Integration**: Browse and use fonts directly from the Google Fonts library with real-time preview and loading.
- **Flexible Backgrounds**: Solid color, linear/radial gradients, or transparent background.
- **Vector & Raster Exports**: Export lossless SVG or high-resolution PNG with custom scaling multipliers.
- **Undo / Redo & History**: Full state history support for seamless editing.
- **Mobile Friendly & Responsive**: Clean and modern UI tailored for both desktop and mobile screens.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) / [TanStack Router](https://tanstack.com/router)
- **Runtime & Package Manager**: [Bun](https://bun.sh)
- **UI & Styling**: [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com)
- **Build Tool**: [Vite](https://vitejs.dev)

## Getting Started

### Prerequisites

Make sure you have [Bun](https://bun.sh) installed:

```bash
# macOS & Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/SLM.git
cd SLM

# Install dependencies
bun install
```

### Development

Start the local development server:

```bash
bun dev
```

The application will be available at `http://localhost:3000`.

### Production Build

Build and run for production:

```bash
# Build the project
bun run build

# Preview the build
bun run preview
```

### Code Quality

```bash
# Run ESLint
bun run lint

# Format code with Prettier
bun run format
```

## License

Distributed under the [MIT License](LICENSE).
