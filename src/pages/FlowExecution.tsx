import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle, XCircle, Eye, RefreshCw, Mail, Workflow } from 'lucide-react'
import { motion } from 'framer-motion'
import EmailComposer from '../components/EmailComposer'

interface Execution {
  executionId: string
  flowId: string
  flowName: string
  submittedBy: string
  currentStep: number
  status: string
  formData: Record<string, any>
  startedAt: string
  completedAt: string
  notes: string
}

export default function FlowExecution() {
  const { user } = useAuthStore()
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [detailMode, setDetailMode] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null)
  const [actionDialog, setActionDialog] = useState(false)
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [actionComment, setActionComment] = useState('')
  const [emailDialog, setEmailDialog] = useState(false)

  useEffect(() => { loadExecutions() }, [])

  const loadExecutions = async () => {
    setLoading(true)
    try {
      const result = await callGAS<{ success: boolean; executions: Execution[] }>('getExecutions', { token: user?.token })
      if (result && result.success) setExecutions(result.executions || [])
    } catch (e) { console.error('Load executions error:', e) }
    finally { setLoading(false) }
  }

  const handleAction = async () => {
    if (!selectedExecution) return
    try {
      await callGAS('processApproval', {
        token: user?.token,
        executionId: selectedExecution.executionId,
        action: actionType,
        comment: actionComment,
      })
      setActionDialog(false)
      setActionComment('')
      loadExecutions()
      setDetailMode(false)
      setSelectedExecution(null)
    } catch (e) { console.error('Action error:', e) }
  }

  const openDetail = async (exec: Execution) => {
    try {
      const result = await callGAS<{ success: boolean; execution: Execution }>('getExecutionDetail', {
        token: user?.token, executionId: exec.executionId,
      })
      if (result && result.success && result.execution) {
        setSelectedExecution(result.execution)
        setDetailMode(true)
      }
    } catch (e) {
      setSelectedExecution(exec)
      setDetailMode(true)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      Pending: 'outline', Approved: 'default', Rejected: 'destructive', Completed: 'default',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const columns: ColumnDef<Execution>[] = [
    { accessorKey: 'executionId', header: 'ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.executionId}</span> },
    { accessorKey: 'flowName', header: 'Flow' },
    { accessorKey: 'submittedBy', header: 'Submitted By' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => getStatusBadge(row.original.status) },
    { accessorKey: 'startedAt', header: 'Started', cell: ({ row }) => new Date(row.original.startedAt).toLocaleString() },
    {
      id: 'actions', header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(row.original)}><Eye className="h-4 w-4" /></Button>
          {row.original.status === 'Pending' && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedExecution(row.original); setActionType('APPROVE'); setActionDialog(true) }}><CheckCircle className="h-4 w-4 text-green-500" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedExecution(row.original); setActionType('REJECT'); setActionDialog(true) }}><XCircle className="h-4 w-4 text-destructive" /></Button>
            </>
          )}
        </div>
      ),
    },
  ]

  // DETAIL VIEW
  if (detailMode && selectedExecution) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Button variant="ghost" onClick={() => { setDetailMode(false); setSelectedExecution(null) }} className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Execution: {selectedExecution.executionId}</CardTitle>
              {getStatusBadge(selectedExecution.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><Label className="text-xs text-muted-foreground">Flow</Label><p className="text-sm font-medium">{selectedExecution.flowName}</p></div>
              <div><Label className="text-xs text-muted-foreground">Submitted By</Label><p className="text-sm font-medium">{selectedExecution.submittedBy}</p></div>
              <div><Label className="text-xs text-muted-foreground">Started</Label><p className="text-sm font-medium">{new Date(selectedExecution.startedAt).toLocaleString()}</p></div>
              {selectedExecution.completedAt && (
                <div><Label className="text-xs text-muted-foreground">Completed</Label><p className="text-sm font-medium">{new Date(selectedExecution.completedAt).toLocaleString()}</p></div>
              )}
            </div>
            {selectedExecution.formData && Object.keys(selectedExecution.formData).length > 0 && (
              <div><Label className="text-xs text-muted-foreground mb-2 block">Form Data</Label>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {Object.entries(selectedExecution.formData).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {selectedExecution.status === 'Pending' && (
                <>
                  <Button onClick={() => { setActionType('APPROVE'); setActionDialog(true) }}><CheckCircle className="h-4 w-4 mr-2" /> Approve</Button>
                  <Button variant="destructive" onClick={() => { setActionType('REJECT'); setActionDialog(true) }}><XCircle className="h-4 w-4 mr-2" /> Reject</Button>
                </>
              )}
              <Button variant="secondary" onClick={() => setEmailDialog(true)}><Mail className="h-4 w-4 mr-2" /> Compose Email</Button>
            </div>
          </CardContent>
        </Card>

        {selectedExecution && (
          <EmailComposer 
            open={emailDialog} 
            onOpenChange={setEmailDialog} 
            execution={selectedExecution} 
          />
        )}

        <Dialog open={actionDialog} onOpenChange={setActionDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{actionType === 'APPROVE' ? 'Approve' : 'Reject'}</DialogTitle></DialogHeader>
            <div><Label>Comment</Label><Textarea value={actionComment} onChange={e => setActionComment(e.target.value)} placeholder="Add comment..." /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(false)}>Cancel</Button>
              <Button variant={actionType === 'REJECT' ? 'destructive' : 'default'} onClick={handleAction}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    )
  }

  // LIST VIEW
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Available Workflows</h2>
          <p className="text-sm text-muted-foreground font-medium">Select a workflow to view its history or start a new execution</p>
        </div>
        <Button variant="outline" onClick={loadExecutions} className="bg-card hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Card key={i} className="animate-pulse h-40 bg-muted/50 border-none shadow-none" />)}
        </div>
      ) : executions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 bg-muted/20">
          <Workflow className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No active workflows found</h3>
          <p className="text-sm text-muted-foreground">Start by creating your first process in the Flows tab.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from(new Set(executions.map(e => e.flowId))).map(flowId => {
            const flowExecs = executions.filter(e => e.flowId === flowId);
            const latest = flowExecs[0];
            return (
              <motion.div 
                key={flowId} 
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-xl transition-all duration-300 border-l-4 border-l-primary overflow-hidden group"
                  onClick={() => openDetail(latest)}
                >
                  <CardHeader className="pb-3 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <Workflow className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">
                        {flowExecs.length} total
                      </Badge>
                    </div>
                    <CardTitle className="mt-3 text-lg">{latest.flowName}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        <span className="text-xs text-muted-foreground font-medium">Latest: {latest.status}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Last activity</p>
                        <p className="text-xs font-semibold">{new Date(latest.startedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                         <Button size="sm" className="w-full text-xs h-8">View History</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {executions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">All Recent Executions</h3>
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <DataTable columns={columns} data={executions} searchKey="flowName" searchPlaceholder="Filter executions..." />
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  )
}