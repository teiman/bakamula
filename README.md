# BAKAMULA

A mod development tool for Quake. Runs a dedicated FTEQW server in the background and controls it through an Electron graphical interface.

## Features

- **Configuration**: Set Quake path and select mod
- **Server Control**: Start/Stop FTEQW dedicated server
- **Status Monitor**: Periodic polling showing current map and player count
- **Web Console**: Send arbitrary commands and view responses

## Requirements

- Node.js 18+
- FTEQW dedicated server executable
- Quake installation

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

## Tech Stack

- **Frontend**: Electron + Vue 3 (Composition API) + Pinia
- **Persistence**: electron-store
- **Communication**: RCON for commands, stdout for responses
- **Server**: FTEQW dedicated as child process
- **UI**: Dark theme

## License

MIT
