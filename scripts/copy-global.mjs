// tsc does not emit .d.ts inputs, so the generated ambient global is copied into dist beside the
// declarations that reference it.
import { copyFileSync, mkdirSync } from 'node:fs'
mkdirSync('dist/generated', { recursive: true })
copyFileSync('src/generated/global.d.ts', 'dist/generated/global.d.ts')
