import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import { motion } from 'framer-motion'

interface Flow {
  flowId: string
  flowName: string
  description: string
  steps: Array<{ id: string; name: string; assigneeType: string; assigneeValue: string }>
  createdBy: string
  createdAt: string
  isActive: boolean
}

export default function Flows() {
  const { user } = useAuthStore()
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '', steps: '' })

  useEffect(() => { loadFlows() }, [])

  const loadFlows = async () => {
    try {
      const result = await callGAS<{ success: boolean; flows: Flow[] }>('getFlows', { token: user?.token })
      if (result.success) setFlows(result.flows)
    } catch (e) {
      console.error('Load flows error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      let steps = []
      try { steps = JSON.parse(formData.steps) } catch { steps = [] }

      if (editingFlow) {
        await callGAS('updateFlow', {
          token: user?.token,
          flowId: editingFlow.flowId,
          flowData: { name: formData.name, description: formData.description, steps },
        })
      } else {
        await callGAS('createFlow', {
          token: user?.token,
          flowData: { name: formData.name, description: formData.description, steps },
        })
      }
      setDialogOpen(false)
      setEditingFlow(null)
      setFormData({ name: '', description: '', steps: '' })
      loadFlows()
    } catch (e) {
      console.error('Save flow error:', e)
    }
  }

  const handleDelete = async (flowId: string) => {
    if (!confirm('Are you sure you want to deactivate this flow?')) return
    try {
      await callGAS('deleteFlow', { token: user?.token, flowId })
      loadFlows()
    } catch (e) {
      console.error('Delete flow error:', e)
    }
  }

  const openEdit = (flow: Flow) => {
    setEditingFlow(flow)
    setFormData({
      name: flow.flowName,
      description: flow.description,
      steps: JSON.stringify(flow.steps, null, 2),
    })
    setDialogOpen(true)
  }

  const columns: ColumnDef<Flow>[] = [
    { accessorKey: 'flowName', header: 'Name' },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'steps',
      header: 'Steps',
      cell: ({ row }) => <Badge variant="secondary">{row.original.steps.length} steps</Badge>,
    },
    { accessorKey: 'createdBy', header: 'Created By' },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'destructive'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.flowId)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Workflow Flows</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingFlow(null); setFormData({ name: '', description: '', steps: '[]' }) }}>
              <Plus className="h-4 w-4 mr-2" /> New Flow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFlow ? 'Edit Flow' : 'Create New Flow'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Flow Name</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Invoice Approval" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the flow..." />
              </div>
              <div>
                <Label>Steps (JSON)</Label>
                <Textarea value={formData.steps} onChange={e => setFormData({ ...formData, steps: e.target.value })} rows={6} className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground mt-1">JSON array of step objects</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={flows} searchKey="flowName" searchPlaceholder="Search flows..." />
        </CardContent>
      </Card>
    </motion.div>
  )
}