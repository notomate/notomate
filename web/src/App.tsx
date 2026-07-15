import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import SignIn from './pages/auth/SignInPage';
import SignUp from './pages/auth/SignUpPage';
import ExplorePage from './pages/explore/ExplorePage';
import NotFound from './pages/errors/NotFoundPage';
import RequireAuth from './components/requireauth/RequireAuth';
import NotesLayout from './pages/workspace/notes/NotesLayout';
import NotesPage from './pages/workspace/notes/NotesPage';
import Setup from './pages/workspacesetup/WorkspaceSetupPage';
import NoteDetailPage from './pages/workspace/notes/NoteDetailPage';
import FilesPage from './pages/workspace/files/FilesPage';
import SearchPage from './pages/workspace/notes/SearchPage';
import Settings from './pages/workspace/settings/SettingsPage';
import WorkflowsPage from './pages/workspace/workflows/WorkflowsPage';
import WorkflowEditPage from './pages/workspace/workflows/WorkflowEditPage';
import WorkflowSettingsPage from './pages/workspace/workflows/WorkflowSettingsPage';
import RunsPage from './pages/workspace/workflows/RunsPage';
import RunDetailPage from './pages/workspace/workflows/RunDetailPage';
import { Toast } from './components/toast/Toast'
import { useToastStore } from './stores/toast';
import WorkspaceLayout from './components/workspacelayout/WorkspaceLayout';
import WorkspaceLoader from './components/workspaceloader/WorkspaceLoader';
import WorkspacePageLayout from './components/workspacepagelayout/WorkspacePageLayout';
import CalendarPage from './pages/workspace/calendar/CalendarPage';
import CalendarSlotDetailPage from './pages/workspace/calendar/CalendarSlotDetailPage';
import MapPage from './pages/workspace/map/MapPage';
import MapMarkerDetailPage from './pages/workspace/map/MapMarkerDetailPage';
import KanbanPage from './pages/workspace/kanban/KanbanPage';
import WhiteboardPage from './pages/workspace/whiteboard/WhiteboardPage';
import SpreadsheetPage from './pages/workspace/spreadsheet/SpreadsheetPage';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useScrollToTop from '@/hooks/use-scrolltotop';
import { useAuth } from '@/hooks/use-auth';
import { LoaderCircle } from 'lucide-react';

function App() {
  const location = useLocation();
  const toasts = useToastStore((s) => s.toasts);
  const { i18n } = useTranslation();

  const { isLoading } = useAuth();

  useScrollToTop();

  useEffect(() => {
    const rtlLanguages = ['ar'];
    const currentLang = i18n.language;
    const direction = rtlLanguages.includes(currentLang) ? 'rtl' : 'ltr';

    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', currentLang);
  }, [i18n.language]);

  if (isLoading) {
    return (
      <div className='w-screen h-dvh flex justify-center items-center'>
        <LoaderCircle className='animate-spin' />
      </div>
    );
  }

  return (
    <>
      <Routes location={location}>
        <Route path='signin' element={<SignIn />}></Route>
        <Route path='signup' element={<SignUp />}></Route>
        <Route path='explore' element={<ExplorePage />}></Route>
        <Route path='/' element={<RequireAuth />}>
          <Route index element={<Navigate to="/workspaces" replace />} />
          <Route path='/workspace-setup' element={<Setup />} />
          <Route path='workspaces' element={<WorkspaceLoader />} />
          <Route path='workspaces/:workspaceId' element={<WorkspaceLayout />}>
            <Route index element={<Navigate to="notes" replace />} />
            <Route path='notes/:noteId' element={<NotesLayout />}>
              <Route index element={<NoteDetailPage />} />
            </Route>
            <Route element={<WorkspacePageLayout />}>
              <Route path='notes' element={<NotesPage />} />
              <Route path='notes/search' element={<SearchPage />} />
              <Route path='files' element={<FilesPage />} />
              <Route path='settings' element={<Settings />} />
              <Route path='workflows' element={<WorkflowsPage />} />
              <Route path='workflows/new' element={<WorkflowEditPage />} />
              <Route path='workflows/settings' element={<WorkflowSettingsPage />} />
              <Route path='workflows/:workflowId' element={<WorkflowEditPage />} />
              <Route path='workflows/:workflowId/runs' element={<RunsPage />} />
              <Route path='workflows/:workflowId/runs/:runId' element={<RunDetailPage />} />
              <Route path='calendar/:calendarId' element={<CalendarPage />}>
                <Route path='slot/:slotId' element={<CalendarSlotDetailPage />} />
              </Route>
              <Route path='map/:mapId' element={<MapPage />}>
                <Route path='marker/:markerId' element={<MapMarkerDetailPage />} />
              </Route>
              <Route path='kanban/:kanbanId' element={<KanbanPage />} />
              <Route path='whiteboard/:whiteboardId' element={<WhiteboardPage />} />
              <Route path='spreadsheet/:spreadsheetId' element={<SpreadsheetPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      {
        toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))
      }
    </>
  )
}

export default App
