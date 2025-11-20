import { useEffect, useRef, useState } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function ChatUI() {
  const [roomId, setRoomId] = useState('demo-room')
  const [name, setName] = useState('Guest')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('Idle')

  const wsRef = useRef(null)
  const pcRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)

  useEffect(() => {
    fetch(`${BACKEND_URL}/messages?room_id=${encodeURIComponent(roomId)}`)
      .then(r => r.json())
      .then(setMessages)
      .catch(() => {})
  }, [roomId])

  const connectWS = () => {
    if (wsRef.current) wsRef.current.close()
    const ws = new WebSocket(`${BACKEND_URL.replace('http', 'ws')}/ws/${roomId}`)
    ws.onopen = () => setStatus('Connected')
    ws.onclose = () => setStatus('Disconnected')
    ws.onmessage = async (evt) => {
      const data = JSON.parse(evt.data)
      if (data.type === 'chat') {
        setMessages(prev => [...prev, data.payload])
      }
      // WebRTC signaling
      if (data.type === 'offer') {
        await ensurePeer()
        await pcRef.current.setRemoteDescription(data.sdp)
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
        ws.send(JSON.stringify({ type: 'answer', sdp: answer }))
      } else if (data.type === 'answer') {
        await pcRef.current?.setRemoteDescription(data.sdp)
      } else if (data.type === 'ice') {
        try { await pcRef.current?.addIceCandidate(data.candidate) } catch {}
      }
    }
    wsRef.current = ws
  }

  const sendMessage = async () => {
    if (!input.trim()) return
    const payload = { room_id: roomId, sender: name, content: input, message_type: 'text' }
    setMessages(prev => [...prev, { ...payload, created_at: new Date().toISOString() }])
    setInput('')
    try {
      await fetch(`${BACKEND_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch {}
    wsRef.current?.send(JSON.stringify({ type: 'chat', payload }))
  }

  const ensurePeer = async () => {
    if (pcRef.current) return pcRef.current
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.onicecandidate = (e) => {
      if (e.candidate) wsRef.current?.send(JSON.stringify({ type: 'ice', candidate: e.candidate }))
    }
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }
    pcRef.current = pc
    return pc
  }

  const startCall = async () => {
    await ensurePeer()
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream
    stream.getTracks().forEach(t => pcRef.current.addTrack(t, stream))

    const offer = await pcRef.current.createOffer()
    await pcRef.current.setLocalDescription(offer)
    wsRef.current?.send(JSON.stringify({ type: 'offer', sdp: offer }))
  }

  const stopCall = () => {
    pcRef.current?.getSenders().forEach(s => s.track && s.track.stop())
    pcRef.current?.close()
    pcRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-6">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input value={roomId} onChange={e=>setRoomId(e.target.value)} className="px-3 py-2 rounded bg-slate-800/60 text-white border border-slate-700" placeholder="Room ID"/>
        <input value={name} onChange={e=>setName(e.target.value)} className="px-3 py-2 rounded bg-slate-800/60 text-white border border-slate-700" placeholder="Your name"/>
        <div className="flex gap-2">
          <button onClick={connectWS} className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600">Connect</button>
          <span className="text-blue-200 self-center text-sm">{status}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-slate-800/40 border border-slate-700 rounded-xl p-4 h-96 overflow-auto">
          <div className="text-blue-200 mb-2">Messages</div>
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`p-2 rounded ${m.sender===name? 'bg-blue-600/30' : 'bg-slate-700/50'}`}>
                <div className="text-xs text-blue-200/70">{m.sender}</div>
                <div className="text-white">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 px-3 py-2 rounded bg-slate-900/60 text-white border border-slate-700" placeholder="Type a message"/>
            <button onClick={sendMessage} className="px-3 py-2 rounded bg-blue-500 text-white hover:bg-blue-600">Send</button>
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-xl border border-slate-700 bg-black aspect-video"/>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-xl border border-slate-700 bg-black aspect-video"/>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={startCall} className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600">Start Video</button>
            <button onClick={stopCall} className="px-4 py-2 rounded bg-rose-500 text-white hover:bg-rose-600">End</button>
          </div>
        </div>
      </div>
    </div>
  )
}
