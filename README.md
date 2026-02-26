# 𝐒𝐨𝐧𝐚𝐧𝐜𝐞🦇

An open-source, web-based **guitar tuner** that uses the [YIN algorithm]( [http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf)) and your device's microphone to detect pitch in real time.

## Standard Tuning

Currently Sonance only supports standard tuning. More tunings will be added in the future!


| String | Note | Frequency |
| ------ | ---- | --------- |
| 6th    | E2   | 82.41 Hz  |
| 5th    | A2   | 110.00 Hz |
| 4th    | D3   | 146.83 Hz |
| 3rd    | G3   | 196.00 Hz |
| 2nd    | B3   | 246.94 Hz |
| 1st    | E4   | 329.63 Hz |


## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS v4** (styling)
- **pitchfinder** (YIN algorithm for pitch detection)
- **Web Audio API** (microphone input + audio analysis)

## Prerequisites

- Node.js 22+
- Docker (optional, for containerized hosting)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **Start Tuning**.

### Available Scripts


| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start dev server with HMR           |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Preview the production build        |
| `npm run lint`    | Run ESLint                          |


## Docker

Build and serve the production app via nginx:

```bash
docker compose up
```

Open [http://localhost:3000](http://localhost:3000).

To rebuild after code changes:

```bash
docker compose up --build
```

## Project Structure

```
src/
  main.tsx                  Entry point
  App.tsx                   Root component (start/stop + tuner display)
  index.css                 Tailwind CSS import
  lib/
    pitch.ts                YIN detector, frequency-to-note mapping, cents calculation
  hooks/
    use-tuner.ts            Microphone access, AudioContext, real-time detection loop
  components/
    tuner-display.tsx       Note display, needle gauge, cents bar, tuning status
```

## How It Works

1. User clicks **Start Tuning** -- microphone permission is requested
2. Audio streams into an `AudioContext` via `getUserMedia`
3. An `AnalyserNode` (fftSize 4096) extracts time-domain samples as a `Float32Array`
4. The **YIN** pitch detection algorithm identifies the fundamental frequency
5. The closest standard tuning note is found using cents offset: `1200 * log2(detected / reference)`
6. The UI displays the note, frequency, cents deviation, and whether the string is flat, sharp, or in tune

### Tuning Thresholds

- **In tune**: within +/- 5 cents
- **Close**: within +/- 15 cents (yellow)
- **Off**: beyond +/- 15 cents (red)

## Contributing

Contributions are welcome. Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run lint and build checks: `npm run lint && npm run build`
5. Push to your fork and open a pull request

### Guidelines

- Keep PRs focused on a single change
- Ensure `npm run build` passes before submitting
- Follow the existing code style (ESLint config is included)
- No unused imports, variables, or dead code

## License

MIT