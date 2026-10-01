import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Risk from './pages/Risk'
import ReportsLayout from './reports/ReportsLayout'
import { AskAi, MetricsLibrary, ReportsHome, SavedReportView, StandardReportView } from './reports/ReportsViews'
import Advisor from './pages/Advisor'
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
            <Route path="reports" element={<ReportsLayout />}>
              <Route index element={<ReportsHome tab="standard" />} />
              <Route path="mine" element={<ReportsHome tab="mine" />} />
              <Route path="mine/:savedId" element={<SavedReportView />} />
              <Route path="standard/:reportId" element={<StandardReportView />} />
              <Route path="metrics" element={<MetricsLibrary />} />
              <Route path="ask" element={<AskAi />} />
            </Route>
            {/* Insights now live on the Risk page; keep old links working. */}
            <Route path="insights" element={<Navigate to="/risk" replace />} />
            <Route path="copilot" element={<Copilot />} />
            <Route path="advisor" element={<Advisor />} />
          </Route>
        </Routes>
      </HashRouter>
    </CustomerProvider>
  )
}
