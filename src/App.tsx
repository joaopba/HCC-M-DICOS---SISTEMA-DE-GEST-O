import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Medicos from "./pages/Medicos";
import Pagamentos from "./pages/Pagamentos";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import Usuarios from "./pages/Usuarios";
import TesteWhatsApp from "./pages/TesteWhatsApp";
import TesteEmail from "./pages/TesteEmail";
import TestWhatsAppMessage from "./pages/TestWhatsAppMessage";
import TesteReenvioNotas from "./pages/TesteReenvioNotas";
import TesteEnvioGestor from "./pages/TesteEnvioGestor";
import UserProfile from "./pages/UserProfile";
import NotasMedicos from "./pages/NotasMedicos";
import DashboardMedicos from "./pages/DashboardMedicos";
import ChatAdmin from "./pages/ChatAdmin";
import AprovarNota from "./pages/AprovarNota";
import RejeitarNota from "./pages/RejeitarNota";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary pageName="Aplicação">
        <BrowserRouter>
          <Toaster />
          <Sonner />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/medicos" element={
            <ProtectedRoute>
              <Medicos />
            </ProtectedRoute>
          } />
          <Route path="/pagamentos" element={
            <ProtectedRoute>
              <ErrorBoundary pageName="Pagamentos">
                <Pagamentos />
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/configuracoes" element={
            <ProtectedRoute>
              <Configuracoes />
            </ProtectedRoute>
          } />
          <Route path="/relatorios" element={
            <ProtectedRoute>
              <Relatorios />
            </ProtectedRoute>
          } />
          <Route path="/teste-whatsapp" element={
            <ProtectedRoute>
              <TesteWhatsApp />
            </ProtectedRoute>
          } />
          <Route path="/teste-email" element={
            <ProtectedRoute>
              <TesteEmail />
            </ProtectedRoute>
          } />
          <Route path="/test-whatsapp-message" element={
            <ProtectedRoute>
              <TestWhatsAppMessage />
            </ProtectedRoute>
          } />
          <Route path="/teste-reenvio-notas" element={
            <ProtectedRoute>
              <TesteReenvioNotas />
            </ProtectedRoute>
          } />
          <Route path="/teste-envio-gestor" element={
            <ProtectedRoute>
              <TesteEnvioGestor />
            </ProtectedRoute>
          } />
          <Route path="/usuarios" element={
            <ProtectedRoute>
              <Usuarios />
            </ProtectedRoute>
          } />
          <Route path="/perfil" element={
            <ProtectedRoute>
              <UserProfile />
          </ProtectedRoute>
        } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <ChatAdmin />
            </ProtectedRoute>
          } />
          <Route path="/notas-medicos" element={<Navigate to="/dashboard-medicos" replace />} />
          <Route path="/dashboard-medicos" element={<DashboardMedicos />} />
          <Route path="/aprovar-nota" element={<AprovarNota />} />
          <Route path="/aprovar" element={<AprovarNota />} />
          <Route path="/rejeitar-nota" element={<RejeitarNota />} />
          <Route path="/rejeitar" element={<RejeitarNota />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
