import path from 'node:path'
import { NodePackageImporter } from 'sass-embedded'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import { defineConfig, UserConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import sassDts from 'vite-plugin-sass-dts'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
// import tailwindPlugin from '@tailwindcss/vite'
// import react from "@vitejs/plugin-react";
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react-swc'

const IS_NIGHTLY = process.env.NIGHTLY?.toLowerCase() === 'true'

const builtinVars = () => {
  return {
    name: 'built-in-vars',
    transformIndexHtml(html: string) {
      return html.replace(
        /<\/head>/,
        `<script>window.__IS_NIGHTLY__ = ${IS_NIGHTLY ? 'true' : 'false'}</script></head>`,
      )
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'

  const config = {
    // root: "/",
    server: {
      port: 3000,
      watch: {
        ignored: ['**/*.scss.d.ts'],
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          // @ts-expect-error fucking vite why embedded their own sass types definition????
          importer: [
            new NodePackageImporter(),
            // Custom importer for @/styles alias - workaround for vite-sass-dts limitation
            ((...args: Parameters<Parameters<typeof sass.compile>[1]['importer']>) => {
              const url = args[0] as string
              if (url.startsWith('@/styles')) {
                const relativePath = url.replace('@/styles', './src/assets/styles')
                return {
                  file: path.resolve(__dirname, relativePath),
                }
              }
              return null
            }) as any, // Type assertion needed for sass importer compatibility
          ],
        },
      },
    },
    plugins: [
      // tailwindPlugin(),
      tsconfigPaths(),
      legacy({
        renderLegacyChunks: false,
        modernTargets: ['edge>=109', 'safari>=13'],
        modernPolyfills: true,
        additionalModernPolyfills: [
          'core-js/modules/es.object.has-own.js',
          'core-js/modules/web.structured-clone.js',
          'core-js/modules/es.array.at.js',
        ],
      }),
      createHtmlPlugin({
        inject: {
          data: {
            title: 'Clash Nyanpasu',
            injectScript:
              mode === 'development'
                ? '<script src="https://unpkg.com/react-scan/dist/auto.global.js"></script>'
                : '',
          },
        },
      }),
      builtinVars(),
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: `src/pages`,
        generatedRouteTree: `src/route-tree.gen.ts`,
        routeFileIgnorePattern: '_modules',
      }),
      svgr(),
      react({
        // babel: {
        //   plugins: ["@emotion/babel-plugin"],
        // },
      }),
      AutoImport({
        resolvers: [
          IconsResolver({
            prefix: 'Icon',
            extension: 'jsx',
          }),
        ],
      }),
      Icons({
        compiler: 'jsx', // or 'solid'
      }),
      sassDts({ esmExport: true }),
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        strategy: ['custom-extension'],
      }),
    ],
    resolve: {
      alias: {
        '@repo': path.resolve('../../'),
        '@nyanpasu/ui': path.resolve('../ui/src'),
        '@nyanpasu/interface': path.resolve('../interface/src'),
      },
    },
    optimizeDeps: {
      entries: ['./src/main.tsx'],
      include: ['@emotion/styled'],
    },
    esbuild: {
      drop: isDev ? undefined : ['debugger'],
      pure: isDev || IS_NIGHTLY ? [] : ['console.log'],
    },
    build: {
      outDir: '../../backend/tauri/tmp/dist',
      // 多线程构建优化 - 利用24线程CPU
      target: 'es2022',
      minify: 'esbuild', // 使用更快的esbuild压缩
      cssMinify: 'esbuild',
      rollupOptions: {
        // 并行处理优化
        maxParallelFileOps: 20,
        output: {
          manualChunks: {
            // 更激进的代码分割提升并行构建
            vendor: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@mui/icons-material', '@mui/lab'],
            utils: ['lodash-es', 'dayjs', 'ahooks'],
            jsonWorker: [`monaco-editor/esm/vs/language/json/json.worker`],
            tsWorker: [`monaco-editor/esm/vs/language/typescript/ts.worker`],
            editorWorker: [`monaco-editor/esm/vs/editor/editor.worker`],
            yamlWorker: [`monaco-yaml/yaml.worker`],
          },
        },
      },
      emptyOutDir: true,
      sourcemap: isDev || IS_NIGHTLY ? 'inline' : false,
      // 增大chunk警告阈值，避免不必要的警告
      chunkSizeWarningLimit: 1000,
    },
    define: {
      OS_PLATFORM: `"${process.platform}"`,
      WIN_PORTABLE: !!process.env.VITE_WIN_PORTABLE,
    },
    html: {},
  } satisfies UserConfig
  // fucking vite why embedded their own sass types definition????
  return config as UserConfig
})
