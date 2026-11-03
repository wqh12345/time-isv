import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
// import Login from './pages/login/login';
import MainLayout from './pages/MainLayout'
import LogPage from './pages/log/index.jsx'
import ResourcePage from './pages/resource/index.jsx'
import ApprovalPage from './pages/approval/index.jsx'
import ManagementPage from './pages/management/index.jsx'
import SettingPage from './pages/setting/index.jsx'
import PayPage from './pages/pay/index.jsx'
import AdminPage from './pages/admin/index.jsx'
import SpaceCascaderDemo from './pages/space-cascader-demo/index.jsx'
import CrossSpaceUpgradeModalDemo from './pages/cross-space-upgrade-demo/index.jsx'
import WelcomePage from './pages/welcome/index.jsx'
import TaskWorkHourPage from './pages/task/index.jsx'
import ModalFlowDemo from './pages/modal-flow-demo/index.jsx'
import ModalFlowRealDemo from './pages/modal-flow-real-demo/index.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/resource" replace />} />
        <Route path="resource" element={<ResourcePage />} />
        <Route path="log" element={<LogPage />} />
        <Route path="approval" element={<ApprovalPage />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="setting" element={<SettingPage />} />
        <Route path="task" element={<TaskWorkHourPage />} />
        <Route path="pay" element={<PayPage />} />
        <Route path="admin/*" element={<AdminPage />} />
        <Route path="space-cascader-demo" element={<SpaceCascaderDemo />} />
        <Route path="cross-space-upgrade-demo" element={<CrossSpaceUpgradeModalDemo />} />
        <Route path="modal-flow-demo" element={<ModalFlowDemo />} />
        <Route path="modal-flow-real-demo" element={<ModalFlowRealDemo />} />
      </Route>
    </Routes>
  )
}
