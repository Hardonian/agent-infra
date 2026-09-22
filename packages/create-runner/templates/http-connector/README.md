# {{name}}

{{description}}

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env with your external API credentials

# Start development server
pnpm run dev
```

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `EXTERNAL_API_URL` | URL of external API | Yes |
| `EXTERNAL_API_KEY` | API key for external service | Yes |
| `JOBFORGE_URL` | JobForge API URL | No (default: http://localhost:8080) |
| `PORT` | Server port | No (default: 3000) |

## Available Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run test` - Run tests
- `pnpm run contract:test` - Run contract validation tests
- `pnpm run health` - Check health endpoint

## Documentation

- [Runner Guide](./docs/RUNNER.md)
- [Capability Metadata](./CAPABILITY.md)

## License

Apache-2.0
