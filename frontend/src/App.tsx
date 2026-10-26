// src/App.tsx — Nilesh — Personal Coding Assistant
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import SettingsModal from './components/SettingsModal';
import { useChat } from './hooks/useChat';
import { api } from './api/client';
import type { AppView, SystemStatus, AppSettings, Project } from './types';

// Lazy-load heavy views
const DashboardView       = lazy(() => import('./views/DashboardView'));
const LearningView        = lazy(() => import('./views/LearningView'));
const ProjectsView        = lazy(() => import('./views/ProjectsView'));
const ProjectManagerView  = lazy(() => import('./views/ProjectManagerView'));
const BuilderView         = lazy(() => import('./views/BuilderView'));
const FilesView           = lazy(() => import('./views/FilesView'));
const ResearchView        = lazy(() => import('./views/ResearchView'));
const KnowledgeView       = lazy(() => import('./views/KnowledgeView'));
const SettingsView        = lazy(() => import('./views/SettingsView'));
const SpeakView           = lazy(() => import('./views/SpeakView'));
const CorrectEnglishView  = lazy(() => import('./views/CorrectEnglishView'));
const WriteMessageView    = lazy(() => import('./views/WriteMessageView'));
const WishesView          = lazy(() => import('./views/WishesView'));
const TeacherMessagesView = lazy(() => import('./views/TeacherMessagesView'));
const TranslateView       = lazy(() => import('./views/TranslateView'));
const EnglishPracticeView = lazy(() => import('./views/EnglishPracticeView'));
const SavedTemplatesView  = lazy(() => import('./views/SavedTemplatesView'));

function ViewLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
      <span className="spin">◌</span> Loading…
    </div>
  );
}

export default function App() {
  const [activeView,     setActiveView]     = useState<AppView>('chat');
  const [activeConvId,   setActiveConvId]   = useState<string | null>(null);
  const [activeProject,  setActiveProject]  = useState<Project | null>(null);
  const [systemStatus,   setSystemStatus]   = useState<SystemStatus | null>(null);
  const [appSettings,    setAppSettings]    = useState<AppSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nilesh_theme') as 'dark' | 'light') || 'dark';
  });

  // ── Theme ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nilesh_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // ── Status & Settings polling ──────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const st = await api.get<SystemStatus>('/api/status');
      setSystemStatus(st);
    } catch { /* backend offline / starting */ }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await api.get<AppSettings>('/api/settings');
      setAppSettings(s);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadSettings();
    pollStatus();
    const timer = setInterval(pollStatus, 15_000);
    return () => clearInterval(timer);
  }, [loadSettings, pollStatus]);

  const [selectedProvider, setSelectedProvider] = useState<string>(() => {
    return localStorage.getItem('nilesh_provider') || 'ollama';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('nilesh_model') || 'qwen2.5-coder:1.5b';
  });

  // Sync if settings load and nothing in localStorage
  useEffect(() => {
    if (appSettings?.ai_model && !localStorage.getItem('nilesh_model')) {
      setSelectedModel(appSettings.ai_model);
    }
    if (appSettings?.ai_provider && !localStorage.getItem('nilesh_provider')) {
      setSelectedProvider(appSettings.ai_provider);
    }
  }, [appSettings]);

  // ── Chat engine ───────────────────────────────────────────────────────────
  const { messages, isThinking, sendMessage, regenerateResponse, stopGeneration, clearMessages, loadConversation } = useChat(
    selectedModel,
    selectedProvider,
    activeConvId,
    (newId) => setActiveConvId(newId)
  );

  const handleModelChange = useCallback(async (newModel: string, newProvider?: string) => {
    stopGeneration();
    const prov = newProvider || (newModel.startsWith('gemini') ? 'gemini' : 'ollama');
    setSelectedModel(newModel);
    setSelectedProvider(prov);
    localStorage.setItem('nilesh_model', newModel);
    localStorage.setItem('nilesh_provider', prov);

    try {
      await api.post('/api/settings', { key: 'ai_model', value: newModel });
      await api.post('/api/settings', { key: 'ai_provider', value: prov });
      pollStatus();
    } catch { /* ignore */ }
  }, [stopGeneration, pollStatus]);

  const handleNewChat = useCallback(() => {
    setActiveConvId(null);
    clearMessages();
    setActiveView('chat');
  }, [clearMessages]);

  const handleSelectConv = useCallback((id: string) => {
    setActiveConvId(id);
    loadConversation(id);
    setActiveView('chat');
  }, [loadConversation]);

  const handleViewChange = useCallback((view: AppView) => {
    setActiveView(view);
  }, []);

  // ── View routing ──────────────────────────────────────────────────────────
  const renderView = () => {
    if (activeView === 'chat') {
      return (
        <ChatPanel
          messages={messages}
          isThinking={isThinking}
          onSend={sendMessage}
          onRegenerate={regenerateResponse}
          onStop={stopGeneration}
          onClear={clearMessages}
          onNewChat={handleNewChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          systemStatus={systemStatus}
          activeModel={selectedModel}
          activeProvider={selectedProvider}
          onModelChange={handleModelChange}
        />
      );
    }

    return (
      <Suspense fallback={<ViewLoading />}>
        {/* Communication & Language Assistant Views */}
        {activeView === 'speak' && <SpeakView />}
        {activeView === 'correct-english' && <CorrectEnglishView />}
        {activeView === 'write-message' && <WriteMessageView />}
        {activeView === 'special-wishes' && <WishesView />}
        {activeView === 'teacher-messages' && <TeacherMessagesView />}
        {activeView === 'translate' && <TranslateView />}
        {activeView === 'english-practice' && <EnglishPracticeView />}
        {activeView === 'saved-templates' && <SavedTemplatesView />}

        {/* Existing Coding & Learning Views */}
        {activeView === 'dashboard' && (
          <DashboardView
            onViewChange={handleViewChange}
            onNewChat={handleNewChat}
          />
        )}
        {activeView === 'learning' && <LearningView />}
        {activeView === 'builder' && (
          <BuilderView
            activeProject={activeProject}
            onProjectSelect={(p) => { setActiveProject(p); }}
            onViewChange={handleViewChange}
          />
        )}
        {activeView === 'projects' && (
          <ProjectsView
            onProjectSelect={(p) => setActiveProject(p)}
            onViewChange={handleViewChange}
            activeProject={activeProject}
          />
        )}
        {activeView === 'project-manager' && (
          <ProjectManagerView
            onViewChange={handleViewChange}
          />
        )}
        {activeView === 'files' && (
          <FilesView
            activeProject={activeProject}
            onProjectSelect={(p) => setActiveProject(p)}
            onViewChange={handleViewChange}
          />
        )}
        {activeView === 'research' && <ResearchView />}
        {activeView === 'knowledge' && <KnowledgeView />}
        {activeView === 'settings' && (
          <SettingsView
            onSettingsUpdated={() => { loadSettings(); pollStatus(); }}
          />
        )}
      </Suspense>
    );
  };

  return (
    <div className="app-layout">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        activeConvId={activeConvId}
        onViewChange={handleViewChange}
        onSelectConv={handleSelectConv}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        systemStatus={systemStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(prev => !prev)}
      />

      {/* Main Content Area */}
      <main className="main-viewport">
        {renderView()}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSaved={() => { loadSettings(); pollStatus(); }}
        />
      )}
    </div>
  );
}
