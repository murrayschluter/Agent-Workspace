import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import AuthGate from './components/auth/AuthGate'
import ViewAsBanner from './components/admin/ViewAsBanner'
import { AdminOverrideProvider } from './contexts/AdminOverrideContext'
import { useListings } from './hooks/useListings'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ListingDetail = lazy(() => import('./pages/ListingDetail'))
const Login = lazy(() => import('./pages/Login'))
const AwaitingAccess = lazy(() => import('./pages/AwaitingAccess'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const VaultPicker = lazy(() => import('./pages/VaultPicker'))

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-navy-900/50">
      Loading workspace…
    </div>
  )
}

function Page({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

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
          <Route path="/login" element={<Page><Login /></Page>} />
          <Route path="/awaiting-access" element={<Page><AwaitingAccess /></Page>} />
          <Route element={<AuthGate><Layout /></AuthGate>}>
            <Route path="/" element={<Page><Dashboard /></Page>} />
            <Route path="/vault" element={<Page><VaultPicker /></Page>} />
            <Route path="/listings/:id" element={<Page><ListingDetail /></Page>} />
            <Route path="/admin/audit-log" element={<Page><AuditLog /></Page>} />
            <Route path="/admin/users" element={<Page><UserManagement /></Page>} />
          </Route>
        </Routes>
      </AdminOverrideProvider>
    </BrowserRouter>
  )
}
