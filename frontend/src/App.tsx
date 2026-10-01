import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Risk from './pages/Risk'
import Reports from './pages/Reports'
import Copilot from './pages/Copilot'
import { CustomerProvider } from './context/CustomerContext'

// HashRouter is used (rather than BrowserRouter) so client-side routes work
// out of the box on GitHub Pages static hosting without needing a custom
// 404-redirect workaround.
export default function App() {
  return (
    <CustomerProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="risk" element={<Risk />} />
            <Route path="reports" element={<Reports />} />
            {/* Insights now live on the Risk page; keep old links working. */}
            <Route path="insights" element={<Navigate to="/risk" replace />} />
            <Route path="copilot" element={<Copilot />} />
          </Route>
        </Routes>
      </HashRouter>
    </CustomerProvider>
  )
}
