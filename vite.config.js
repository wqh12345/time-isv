import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'  // 这里已修复！！
import path from 'path'

// 构建版本号（时间戳格式），用于缓存控制
const buildVersion = Date.now().toString(36)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    base: '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          modifyVars: {},
        },
      },
    },
    server: {
      open: true,
      host: '0.0.0.0',
      port: 8000,
      proxy: {
        '/api': {
          target: 'https://timeplugintest.lundong.com.cn',
          changeOrigin: true,
        },
        '/noAuth': {
          target: 'https://timeplugintest.lundong.com.cn',
          changeOrigin: true,
        },
      },
      allowedHosts: ['.monkeycode-ai.online'],
    },
    build: {
      // 消除 chunk 体积警告
      chunkSizeWarningLimit: 1500,

      outDir: env.VITE_APP_ENV === 'production' 
        ? 'dist' 
        : env.VITE_APP_ENV === 'test' 
          ? 'dist-test' 
          : 'dist-dev',
      sourcemap: env.VITE_APP_ENV !== 'production',
      minify: env.VITE_APP_ENV === 'production' ? 'terser' : 'esbuild',
      terserOptions: env.VITE_APP_ENV === 'production' ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      } : undefined,

      rollupOptions: {
        // 屏蔽所有无关警告（react-virtualized + vconsole）
        onwarn(warning, warn) {
          if (warning.message?.includes('babel-plugin-flow-react-proptypes')) return
          if (warning.message?.includes('Use of eval')) return
          warn(warning)
        },

        output: {
          // 自动拆包，减小主包体积
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // 将大型依赖单独拆分
              if (id.includes('antd')) {
                return 'vendor-antd'
              }
              if (id.includes('dhtmlx-gantt')) {
                return 'vendor-gantt'
              }
              if (id.includes('vconsole')) {
                return 'vendor-vconsole'
              }
              if (id.includes('echarts')) {
                return 'vendor-echarts'
              }
              if (id.includes('lodash')) {
                return 'vendor-lodash'
              }
              return 'vendor'
            }
          },
          
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/\.(css)$/i.test(assetInfo.name)) {
              return `static/css/[name]-${buildVersion}-[hash][extname]`;
            } else if (/\.(js|mjs)$/i.test(assetInfo.name)) {
              return `static/js/[name]-${buildVersion}-[hash][extname]`;
            } else if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
              return `static/images/[name]-${buildVersion}-[hash][extname]`;
            } else if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
              return `static/fonts/[name]-${buildVersion}-[hash][extname]`;
            }
            return `static/[name]-${buildVersion}-[hash][extname]`;
          },
          chunkFileNames: `static/js/[name]-${buildVersion}-[hash].js`,
          entryFileNames: `static/js/[name]-${buildVersion}-[hash].js`,
        },
      },
    },
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV),
      __BUILD_VERSION__: JSON.stringify(buildVersion),
    },
  }
})