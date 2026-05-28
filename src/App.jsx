import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import ListingDetail from './pages/ListingDetail'
import Login from './pages/Login'
import AwaitingAccess from './pages/AwaitingAccess'
import AuditLog from './pages/AuditLog'
import UserManagement from './pages/UserManagement'
import AuthGate from './components/auth/AuthGate'
import ViewAsBanner from './components/admin/ViewAsBanner'
import { AdminOverrideProvider } from './contexts/AdminOverrideContext'
import { useListings } from './hooks/useListings'

function Layout() {
  const { listings, loading, error, refetch } = useListings()

  const counts = loading || error
    ? { offMarket: null, onTheMarket: null, underContract: null, archived: null }
    : {
        offMarket: listings.filter((l) =>
          ['listed', 'photos_taken', 'tenants_contacted'].includes(l.stage)
        ).length,
        onTheMarket: listings.filter((l) => l.stage === 'launched_online').length,
        underContract: listings.filter((l) => l.stage === 'under_contract').length,
        archived: listings.filter((l) =>
          ['settlement', 'archived'].includes(l.stage)
        ).length,
      }

  return (
    <div className="min-h-screen bg-cream-50 text-navy-900">
      <Sidebar counts={counts} onRefresh={refetch} />
      <main className="ml-60 px-10 py-8">
        <Outlet context={{ listings, loading, error, refetch }} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminOverrideProvider>
        <ViewAsBanner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/awaiting-access" element={<AwaitingAccess />} />
          <Route element={<AuthGate><Layout /></AuthGate>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/listings/:id" element={<ListingDetail />} />
            <Route path="/admin/audit-log" element={<AuditLog />} />
            <Route path="/admin/users" element={<UserManagement />} />
          </Route>
        </Routes>
      </AdminOverrideProvider>
    </BrowserRouter>
  )
}
