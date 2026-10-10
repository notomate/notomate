import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import 'react-photo-view/dist/react-photo-view.css';
import 'leaflet/dist/leaflet.css';
import './i18n'
import './lib/axios'
import { Toast, Tooltip } from "radix-ui";
import App from './App.tsx'
import { UploadPanel } from './components/upload/UploadPanel'
import { SidebarProvider } from './components/sidebar/SidebarProvider.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './providers/Theme.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Toast.Provider>
    <Tooltip.Provider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <React.StrictMode>
            <BrowserRouter>
              <SidebarProvider>
                <App />
              </SidebarProvider>
            </BrowserRouter>
          </React.StrictMode>
        </ThemeProvider>
      </QueryClientProvider>
    </Tooltip.Provider>
    {/* Below md the upload panel and toasts share one full-width stack pinned
        to the top so they never overlap each other; from md up the wrapper
        dissolves and each keeps its own floating corner. */}
    <div className="fixed inset-x-0 top-0 z-[10000] flex flex-col pointer-events-none md:contents">
      <UploadPanel />
      <Toast.Viewport className="pointer-events-auto flex flex-col w-full outline-none md:fixed md:bottom-4 md:right-4 md:w-80 md:gap-2 md:z-[10000]" />
    </div>
  </Toast.Provider>,
)