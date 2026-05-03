import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface Entity {
  entityId: string
  entityType: string
  displayName: string
  verifiedEmail: string
  isActive: boolean
  createdAt: string
}

export default function Entities() {
  const { user } = useAuthStore()
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [formData, setFormData] = useState({ type: 'Client', name: '', email: '' })

  useEffect(() => { loadEntities() }, [])

  const loadEntities = async () => {
    try {
      const result = await callGAS<{ success: boolean; entities: Entity[] }>('getEntities', { token: user?.token })
      if (result.success) setEntities(result.entities)
    } catch (e) {
      console.error('Load entities error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (editingEntity) {
        await callGAS('updateEntity', {
          token: user?.token,
          entityId: editingEntity.entityId,
          entityData: { type: formData.type, name: formData.name, email: formData.email },
        })
      } else {
        await callGAS('createEntity', {
          token: user?.token,
          entityData: { type: formData.type, name: formData.name, email: formData.email },
        })
      }
      setDialogOpen(false)
      setEditingEntity(null)
      setFormData({ type: 'Client', name: '', email: '' })
      loadEntities()
    } catch (e) {
      console.error('Save entity error:', e)
    }
  }

  const handleDelete = async (entityId: string) => {
    if (!confirm('Are you sure you want to deactivate this entity?')) return
    try {
      await callGAS('deleteEntity', { token: user?.token, entityId })
      loadEntities()
    } catch (e) {
      console.error('Delete entity error:', e)
    }
  }

  const openEdit = (entity: Entity) => {
    setEditingEntity(entity)
    setFormData({ type: entity.entityType, name: entity.displayName, email: entity.verifiedEmail })
    setDialogOpen(true)
  }

  const columns: ColumnDef<Entity>[] = [
    { accessorKey: 'entityId', header: 'ID' },
    {
      accessorKey: 'entityType',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.entityType}</Badge>,
    },
    { accessorKey: 'displayName', header: 'Name' },
    { accessorKey: 'verifiedEmail', header: 'Verified Email' },
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
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.entityId)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Entity Directory (DLP)</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingEntity(null); setFormData({ type: 'Client', name: '', email: '' }) }}>
              <Plus className="h-4 w-4 mr-2" /> New Entity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEntity ? 'Edit Entity' : 'Add New Entity'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Client">Client</SelectItem>
                    <SelectItem value="Vendor">Vendor</SelectItem>
                    <SelectItem value="Partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Company or Person Name" />
              </div>
              <div>
                <Label>Verified Email</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contact@company.com" />
                <p className="text-xs text-muted-foreground mt-1">This email will be used for DLP-enforced communications</p>
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
          <DataTable columns={columns} data={entities} searchKey="displayName" searchPlaceholder="Search entities..." />
        </CardContent>
      </Card>
    </motion.div>
  )
}