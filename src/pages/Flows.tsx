import { useState, useEffect, useCallback, useRef, DragEvent } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { motion, AnimatePresence } from 'framer-motion'
import FormNode from '../components/workflow/FormNode'
import SaveToSheetNode from '../components/workflow/SaveToSheetNode'
import EmailNode from '../components/workflow/EmailNode'
import ApprovalNode from '../components/workflow/ApprovalNode'
import ArchiveNode from '../components/workflow/ArchiveNode'
import {
  Plus, Edit, Trash2, ArrowLeft, Save, GripVertical,
  Copy, LayoutList, Play
} from 'lucide-react'
import ReactFlow, {
  Node, Edge, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Connection, MarkerType,
  Handle, Position, NodeProps, ReactFlowProvider, ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

function StartNode() {
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-green-600 text-white rounded-full w-20 h-20 flex items-center justify-center text-sm font-bold shadow-lg cursor-grab">
      <div className="text-center"><div className="text-lg">▶</div><div className="text-xs">START</div></div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-3 !h-3" />
    </motion.div>
  )
}

function EndNode() {
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-red-600 text-white rounded-full w-20 h-20 flex items-center justify-center text-sm font-bold shadow-lg cursor-grab">
      <Handle type="target" position={Position.Top} className="!bg-red-400 !w-3 !h-3" />
      <div className="text-center"><div className="text-lg">⬛</div><div className="text-xs">END</div></div>
    </motion.div>
  )
}

const nodeTypes = {
  start: StartNode, end: EndNode,
  form: FormNode, saveToSheet: SaveToSheetNode,
  email: EmailNode, approval: ApprovalNode, archive: ArchiveNode,
}

const catalogItems = [
  { type: 'start', label: 'Start', icon: '▶', color: 'bg-green-600', desc: 'Start point' },
  { type: 'form', label: 'Form', icon: '📋', color: 'bg-violet-600', desc: 'User fills form' },
  { type: 'saveToSheet', label: 'Save Data', icon: '💾', color: 'bg-cyan-600', desc: 'Save to sheet' },
  { type: 'email', label: 'Email', icon: '✉', color: 'bg-blue-600', desc: 'Send email' },
  { type: 'approval', label: 'Approval', icon: '✓', color: 'bg-primary', desc: 'Approval step' },
  { type: 'archive', label: 'Archive', icon: '📁', color: 'bg-yellow-600', desc: 'Save to Drive' },
  { type: 'end', label: 'End', icon: '⬛', color: 'bg-red-600', desc: 'End point' },
]

export default function Flows() {
  const { user } = useAuthStore()
  const [mode, setMode] = useState<'list' | 'edit'>('list')
  const [flows, setFlows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFlow, setSelectedFlow] = useState<any>(null)
  const [flowName, setFlowName] = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [startFlowId, setStartFlowId] = useState('')

  useEffect(() => { loadFlows() }, [])

  const loadFlows = async () => {
    try {
      const result = await callGAS<{ success: boolean; flows: any[] }>('getFlows', { token: user?.token })
      if (result && result.success) setFlows(result.flows || [])
    } catch (e) { console.error('Load flows error:', e) }
    finally { setLoading(false) }
  }

  const openCreateMode = () => {
    setSelectedFlow(null)
    setFlowName('')
    setFlowDescription('')
    setNodes([{ id: 'start', type: 'start', position: { x: 400, y: 50 }, data: {} }])
    setEdges([])
    setSelectedNode(null)
    setMode('edit')
  }

  const openEditMode = async (flow: any) => {
    setSelectedFlow(flow)
    setFlowName(flow.flowName)
    setFlowDescription(flow.description)

    if (flow.steps && flow.steps.length > 0) {
      const loadedNodes: Node[] = flow.steps.map((s: any) => ({
        id: s.id, type: s.type, position: s.position || { x: 400, y: 200 },
        data: { label: s.name, assignee: s.assigneeValue, skills: s.skills, recipient: s.recipient,
                to: s.to, cc: s.cc, bcc: s.bcc, from: s.from, fields: s.fields,
                spreadsheetId: s.spreadsheetId, sheetName: s.sheetName, folderPath: s.folderPath,
                subject: s.subject, body: s.body },
      }))
      if (!loadedNodes.find(n => n.id === 'start')) loadedNodes.unshift({ id: 'start', type: 'start', position: { x: 400, y: 50 }, data: {} })
      if (!loadedNodes.find(n => n.id === 'end')) loadedNodes.push({ id: 'end', type: 'end', position: { x: 400, y: 550 }, data: {} })
      setNodes(loadedNodes)
    } else {
      setNodes([{ id: 'start', type: 'start', position: { x: 400, y: 50 }, data: {} }])
    }
    setEdges([])
    setSelectedNode(null)
    setMode('edit')
  }

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' } }, eds))
  }, [setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNode(node) }, [])
  const onPaneClick = useCallback(() => { setSelectedNode(null) }, [])

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow')
    if (!type || !rfInstance || !reactFlowWrapper.current) return
    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const item = catalogItems.find(c => c.type === type)
    const newNode: Node = {
      id: `${type}-${Date.now()}`, type, position,
      data: {
        label: item?.label || type, assignee: '', skills: [], recipient: '',
        to: [], cc: [], bcc: [], from: '', fields: [],
        spreadsheetId: '', sheetName: '', folderPath: '',
        subject: '', body: '',
      },
    }
    setNodes(nds => nds.concat(newNode))
  }, [rfInstance, setNodes])

  const onDragOver = useCallback((event: DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }, [])

  const deleteSelectedNode = () => {
    if (!selectedNode || selectedNode.id === 'start' || selectedNode.id === 'end') return
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id))
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }

  const updateNodeData = (key: string, value: unknown) => {
    if (!selectedNode) return
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n))
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null)
  }

  const handleSave = async () => {
    if (!flowName.trim()) return alert('Flow name required')
    setSaving(true)
    try {
      const steps = nodes.map(n => ({
        id: n.id, type: n.type, name: n.data.label,
        assigneeType: n.type === 'approval' ? 'user' : undefined,
        assigneeValue: n.data.assignee, skills: n.data.skills, position: n.position,
        to: n.data.to, cc: n.data.cc, bcc: n.data.bcc, from: n.data.from,
        fields: n.data.fields, spreadsheetId: n.data.spreadsheetId, sheetName: n.data.sheetName,
        folderPath: n.data.folderPath, subject: n.data.subject, body: n.data.body,
      }))
      if (selectedFlow) {
        await callGAS('updateFlow', { token: user?.token, flowId: selectedFlow.flowId, flowData: { name: flowName, description: flowDescription, steps } })
      } else {
        await callGAS('createFlow', { token: user?.token, flowData: { name: flowName, description: flowDescription, steps } })
      }
      await loadFlows()
      setMode('list')
    } catch (e) { console.error('Save error:', e); alert('Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async (flowId: string) => {
    if (!confirm('Deactivate this flow?')) return
    try { await callGAS('deleteFlow', { token: user?.token, flowId }); loadFlows() }
    catch (e) { console.error('Delete error:', e) }
  }

  const handleCopyLink = (flow: any) => {
    const link = flow.formLink || (typeof ScriptApp !== 'undefined' ? ScriptApp.getService().getUrl() + '?form=' + flow.flowId : '')
    navigator.clipboard.writeText(link).then(() => alert('Link copied!'))
  }

  const handleStartExecution = async () => {
    try {
      const result = await callGAS<{ success: boolean; executionId: string }>('startExecution', {
        token: user?.token, flowId: startFlowId, formData: {}, files: [],
      })
      if (result && result.success) {
        alert('Execution started: ' + result.executionId)
        setShowStartDialog(false)
      }
    } catch (e) { console.error('Start execution error:', e) }
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'flowName', header: 'Name' },
    { accessorKey: 'description', header: 'Description', cell: ({ row }) => <span className="text-muted-foreground truncate max-w-[200px] block">{row.original.description}</span> },
    { accessorKey: 'steps', header: 'Steps', cell: ({ row }) => <Badge variant="secondary">{row.original.steps?.length || 0} nodes</Badge> },
    { accessorKey: 'createdBy', header: 'Created By' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'destructive'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMode(row.original)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyLink(row.original)}><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setStartFlowId(row.original.flowId); setShowStartDialog(true) }}><Play className="h-4 w-4 text-green-500" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.flowId)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  // LIST MODE
  if (mode === 'list') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Workflows</h2>
          <Button onClick={openCreateMode}><Plus className="h-4 w-4 mr-2" /> New Flow</Button>
        </div>
        <Card><CardContent className="p-0">
          <DataTable columns={columns} data={flows} searchKey="flowName" searchPlaceholder="Search flows..." />
        </CardContent></Card>

        <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Start Flow Execution</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will start a new execution of this flow. Continue?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancel</Button>
              <Button onClick={handleStartExecution}>Start Execution</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    )
  }

  // EDIT MODE
  return (
    <ReactFlowProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-7rem)] flex gap-4">
        <div className="w-64 shrink-0 space-y-4 overflow-y-auto">
          <Button variant="ghost" onClick={() => setMode('list')} className="w-full justify-start gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Flow Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">Name</Label><Input value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Flow name" className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Description</Label><Input value={flowDescription} onChange={e => setFlowDescription(e.target.value)} placeholder="Description" className="h-8 text-sm" /></div>
              <Button onClick={handleSave} disabled={saving} className="w-full h-8 text-sm"><Save className="h-3 w-3 mr-2" />{saving ? 'Saving...' : 'Save'}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Node Catalog</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Drag to canvas</p>
              {catalogItems.map(item => (
                <div key={item.type} draggable onDragStart={e => { e.dataTransfer.setData('application/reactflow', item.type); e.dataTransfer.effectAllowed = 'move' }}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/50 cursor-grab hover:bg-muted hover:border-primary/50 transition-all group">
                  <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center text-white text-sm shrink-0 group-hover:scale-110 transition-transform`}>{item.icon}</div>
                  <div className="flex-1"><div className="text-sm font-medium">{item.label}</div><div className="text-xs text-muted-foreground">{item.desc}</div></div>
                  <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 rounded-xl border border-border overflow-hidden bg-background" ref={reactFlowWrapper}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onInit={setRfInstance} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            onDrop={onDrop} onDragOver={onDragOver} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
            <Background gap={16} size={1} className="!bg-background" />
            <Controls className="!bg-card !border-border" />
            <MiniMap nodeColor="hsl(var(--muted))" className="!bg-card !border-border" maskColor="hsl(var(--background) / 0.8)" />
          </ReactFlow>
        </div>

        <div className="w-80 shrink-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedNode && (
              <motion.div key={selectedNode.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Node Config</CardTitle>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNode(null)}>✕</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label className="text-xs">Type</Label><Badge variant="outline" className="mt-1">{selectedNode.type}</Badge></div>
                    <div><Label className="text-xs">Label</Label><Input value={selectedNode.data.label || ''} onChange={e => updateNodeData('label', e.target.value)} className="h-8 text-sm" /></div>

                    {(selectedNode.type === 'approval') && (
                      <>
                        <div><Label className="text-xs">Assignee</Label><Input value={selectedNode.data.assignee || ''} onChange={e => updateNodeData('assignee', e.target.value)} placeholder="email" className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">Required Skills</Label><Input value={(selectedNode.data.skills || []).join(', ')} onChange={e => updateNodeData('skills', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="Finance, Legal" className="h-8 text-sm" /></div>
                      </>
                    )}

                    {selectedNode.type === 'email' && (
                      <>
                        <div><Label className="text-xs">From Alias</Label><Input value={selectedNode.data.from || ''} onChange={e => updateNodeData('from', e.target.value)} placeholder="noreply@company.com" className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">To (comma separated)</Label><Input value={(selectedNode.data.to || []).join(', ')} onChange={e => updateNodeData('to', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="user@company.com" className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">CC</Label><Input value={(selectedNode.data.cc || []).join(', ')} onChange={e => updateNodeData('cc', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">BCC</Label><Input value={(selectedNode.data.bcc || []).join(', ')} onChange={e => updateNodeData('bcc', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">Subject</Label><Input value={selectedNode.data.subject || ''} onChange={e => updateNodeData('subject', e.target.value)} placeholder="Subject {executionId}" className="h-8 text-sm" /></div>
                      </>
                    )}

                    {selectedNode.type === 'saveToSheet' && (
                      <>
                        <div><Label className="text-xs">Spreadsheet ID</Label><Input value={selectedNode.data.spreadsheetId || ''} onChange={e => updateNodeData('spreadsheetId', e.target.value)} placeholder="Sheet ID" className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">Sheet Name</Label><Input value={selectedNode.data.sheetName || ''} onChange={e => updateNodeData('sheetName', e.target.value)} placeholder="Submissions" className="h-8 text-sm" /></div>
                      </>
                    )}

                    {selectedNode.type === 'archive' && (
                      <div><Label className="text-xs">Folder Path</Label><Input value={selectedNode.data.folderPath || ''} onChange={e => updateNodeData('folderPath', e.target.value)} placeholder="Flow Name/Date" className="h-8 text-sm" /></div>
                    )}

                    {selectedNode.id !== 'start' && selectedNode.id !== 'end' && (
                      <Button variant="destructive" size="sm" className="w-full mt-2" onClick={deleteSelectedNode}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </ReactFlowProvider>
  )
}