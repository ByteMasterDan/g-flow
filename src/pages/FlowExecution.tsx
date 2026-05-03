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
import { ArrowLeft, CheckCircle, XCircle, Eye, RefreshCw, Mail } from 'lucide-react'
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Flow Executions</h2>
        <Button variant="outline" onClick={loadExecutions}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <DataTable columns={columns} data={executions} searchKey="flowName" searchPlaceholder="Search executions..." />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}