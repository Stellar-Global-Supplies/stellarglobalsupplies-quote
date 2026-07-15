import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import QuoteEditor from '@/pages/QuoteEditor'
import QuotesList from '@/pages/QuotesList'
import CustomersList from '@/pages/CustomersList'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/quotes" element={
            <ProtectedRoute><QuotesList /></ProtectedRoute>
          } />
          <Route path="/quotes/new" element={
            <ProtectedRoute><QuoteEditor /></ProtectedRoute>
          } />
          <Route path="/quotes/:id" element={
            <ProtectedRoute><QuoteEditor /></ProtectedRoute>
          } />
          <Route path="/customers" element={
            <ProtectedRoute><CustomersList /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#00B98E', secondary: '#fff' } },
        }}
      />
    </AuthProvider>
  )
}
