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

interface User {
  email: string
  role: string
  displayName: string
  skills: string[]
  isActive: boolean
  createdAt: string
  lastLogin: string
}

export default function Users() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '', role: 'Operator', displayName: '', skills: '' })

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try {
      const result = await callGAS<{ success: boolean; users: User[] }>('getAllUsers', { token: user?.token })
      if (result && result.success && result.users) setUsers(result.users)
    } catch (e) {
      console.error('Load users error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (editingUser) {
        await callGAS('updateUser', {
          token: user?.token,
          email: editingUser.email,
          updates: { role: formData.role, displayName: formData.displayName, skills: formData.skills },
        })
      } else {
        await callGAS('createUser', {
          token: user?.token,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          displayName: formData.displayName,
        })
      }
      setDialogOpen(false)
      setEditingUser(null)
      setFormData({ email: '', password: '', role: 'Operator', displayName: '', skills: '' })
      await loadUsers()
    } catch (e) {
      console.error('Save user error:', e)
    }
  }

  const openEdit = (u: User) => {
    setEditingUser(u)
    setFormData({ email: u.email, password: '', role: u.role, displayName: u.displayName, skills: u.skills.join(', ') })
    setDialogOpen(true)
  }

  const columns: ColumnDef<User>[] = [
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'displayName', header: 'Name' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const roleColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
          Admin: 'destructive',
          SuperApprover: 'default',
          Approver: 'secondary',
          Operator: 'outline',
        }
        return <Badge variant={roleColors[row.original.role] || 'secondary'}>{row.original.role}</Badge>
      },
    },
    {
      accessorKey: 'skills',
      header: 'Skills',
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.skills.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>)}
        </div>
      ),
    },
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
        <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
          <Edit className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">User Management</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingUser(null); setFormData({ email: '', password: '', role: 'Operator', displayName: '', skills: '' }) }}>
              <Plus className="h-4 w-4 mr-2" /> New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!editingUser && (
                <>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="user@company.com" />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Password" />
                  </div>
                </>
              )}
              <div>
                <Label>Display Name</Label>
                <Input value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} placeholder="John Doe" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="SuperApprover">Super Approver</SelectItem>
                    <SelectItem value="Approver">Approver</SelectItem>
                    <SelectItem value="Operator">Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Skills (comma-separated)</Label>
                <Input value={formData.skills} onChange={e => setFormData({ ...formData, skills: e.target.value })} placeholder="Finance, Legal, IT" />
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
          <DataTable columns={columns} data={users} searchKey="email" searchPlaceholder="Search users..." />
        </CardContent>
      </Card>
    </motion.div>
  )
}