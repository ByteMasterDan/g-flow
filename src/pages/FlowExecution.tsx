import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CheckCircle, XCircle, RotateCcw, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

interface Approval {
  approvalId: string
  flowId: string
  currentStep: number
  status: string
  submittedBy: string
  entityTag: string
  files: Array<{ name: string; driveUrl: string; mimeType: string }>
  submittedAt: string
  completedAt: string
}

export default function FlowExecution() {
  const { user } = useAuthStore()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_REVISION'>('APPROVE')
  const [comment, setComment] = useState('')

  useEffect(() => { loadApprovals() }, [])

  const loadApprovals = async () => {
    try {
      const result = await callGAS<{ success: boolean; approvals: Approval[] }>('getApprovals', { token: user?.token })
      if (result.success) setApprovals(result.approvals || [])
    } catch (e) {
      console.error('Load approvals error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!selectedApproval) return

    try {
      await callGAS('processApproval', {
        token: user?.token,
        approvalId: selectedApproval.approvalId,
        action: actionType,
        comment,
      })
      setActionDialogOpen(false)
      setComment('')
      loadApprovals()
    } catch (e) {
      console.error('Action error:', e)
    }
  }

  const openAction = (approval: Approval, action: typeof actionType) => {
    setSelectedApproval(approval)
    setActionType(action)
    setActionDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      Pending: 'outline',
      Approved: 'default',
      Rejected: 'destructive',
      RevisionsRequested: 'secondary',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h2 className="text-lg font-semibold">Pending Approvals</h2>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No pending approvals
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {approvals.filter(a => a.status === 'Pending').map((approval) => (
            <Card key={approval.approvalId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Approval #{approval.approvalId}</CardTitle>
                  {getStatusBadge(approval.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Flow</p>
                    <p className="text-sm font-medium">{approval.flowId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Submitted By</p>
                    <p className="text-sm font-medium">{approval.submittedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Step</p>
                    <p className="text-sm font-medium">{approval.currentStep}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Entity</p>
                    <p className="text-sm font-medium">{approval.entityTag || 'N/A'}</p>
                  </div>
                </div>

                {approval.files && approval.files.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Attached Files</p>
                    <div className="flex gap-2 flex-wrap">
                      {approval.files.map((file, i) => (
                        <a
                          key={i}
                          href={file.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80"
                        >
                          <FileText className="h-3 w-3" />
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openAction(approval, 'APPROVE')}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => openAction(approval, 'REJECT')}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openAction(approval, 'REQUEST_REVISION')}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Request Revision
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'APPROVE' ? 'Approve' : actionType === 'REJECT' ? 'Reject' : 'Request Revision'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Comment (optional)</Label>
              <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
            <Button
              variant={actionType === 'REJECT' ? 'destructive' : 'default'}
              onClick={handleAction}
            >
              Confirm {actionType === 'APPROVE' ? 'Approval' : actionType === 'REJECT' ? 'Rejection' : 'Revision Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}