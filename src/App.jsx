import ChatUI from './components/ChatUI'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]"></div>
      <div className="relative min-h-screen p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Nebula Chat</h1>
          <a href="/test" className="text-blue-300 hover:text-blue-200 text-sm">System Test</a>
        </header>
        <ChatUI />
      </div>
    </div>
  )
}

export default App
