// Load .env for local development. In production (Docker/Railway) the
// variables come from the platform and there is no .env file.
try {
  process.loadEnvFile()
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}
