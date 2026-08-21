import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function runGit(args: string[]) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
    }).trim()
  } catch {
    return ''
  }
}

function getAppVersion(command: 'build' | 'serve') {
  const commitDate = runGit([
    'show',
    '-s',
    '--format=%cs',
    'HEAD',
  ])
  const shortCommit = runGit([
    'rev-parse',
    '--short=7',
    'HEAD',
  ])
  const workingTreeStatus = runGit([
    'status',
    '--porcelain',
  ])

  if (!commitDate || !shortCommit) {
    return command === 'serve'
      ? 'unknown-dev'
      : 'unknown'
  }

  const formattedDate = commitDate.replaceAll('-', '.')
  const baseVersion = `${formattedDate}_${shortCommit}`

  if (workingTreeStatus) {
    return `${baseVersion}-dirty`
  }

  if (command === 'serve') {
    return `${baseVersion}-dev`
  }

  return baseVersion
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const appVersion = getAppVersion(command)

  return {
    base: '/mini-store-pos/',

    define: {
      'import.meta.env.VITE_APP_VERSION':
        JSON.stringify(appVersion),
    },

    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'Mini-Store POS',
          short_name: 'Mini POS',
          description:
            'Offline-first point-of-sale application for a family mini-store.',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'landscape',
        },
      }),
    ],
  }
})
