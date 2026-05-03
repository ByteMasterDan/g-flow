import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { callGAS } from '../components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Hand, RotateCcw, Eye, FileText, Loader2 } from 'lucide-react'
import FormFiller from '../components/FormFiller'
import type { FormField } from '../components/form-builder'

interface MyForm {
  executionId: string
  flowId: string
  flowName: string
  submittedBy: string
  status: string
  formData: Record<string, any>
  startedAt: string
  completedAt: string
  assignedTo: string[]
  claimedBy: string
  claimedAt: string
}

type TabType = 'pending' | 'completed'

export default function MyForms() {
  const { user } = useAuthStore()
  const [forms, setForms] = useState<MyForm[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [fillModal, setFillModal] = useState(false)
  const [selectedForm, setSelectedForm] = useState<MyForm | null>(null)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => { loadForms() }, [])

  const loadForms = async () => {
    setLoading(true)
    try {
      const result = await callGAS<{ success: boolean; forms: MyForm[] }>('getMyAssignedForms', { token: user?.token })
      if (result && result.success) setForms(result.forms || [])
    } catch (e) { console.error('Load my forms error:', e) }
    finally { setLoading(false) }
  }

  const isClaimedByMe = (form: MyForm) => {
    return form.claimedBy && form.claimedBy.toLowerCase() === user?.email?.toLowerCase()
  }

  const isClaimedByOther = (form: MyForm) => {
    return form.claimedBy && !isClaimedByMe(form)
  }

  const getStatusInfo = (form: MyForm) => {
    if (form.status === 'Submitted' || form.status === 'Approved' || form.status === 'Rejected') {
      return { label: form.status, variant: form.status === 'Submitted' ? 'secondary' : form.status === 'Approved' ? 'default' : 'destructive' as const, color: 'text-blue-500' }
    }
    if (isClaimedByMe(form)) {
      return { label: 'Claimed by me', variant: 'default' as const, color: 'text-yellow-500' }
    }
    if (isClaimedByOther(form)) {
      return { label: 'Claimed by ' + form.claimedBy, variant: 'outline' as const, color: 'text-muted-foreground' }
    }
    return { label: 'Available', variant: 'default' as const, color: 'text-green-500' }
  }

  const pendingForms = forms.filter(f =>
    f.status === 'Pending' && !isClaimedByOther(f)
  )

  const completedForms = forms.filter(f =>
    f.status === 'Submitted' || f.status === 'Approved' || f.status === 'Rejected'
  )

  const handleTake = async (form: MyForm) => {
    setActionLoading(form.executionId)
    try {
      const result = await callGAS<{ success: boolean; error?: string }>('claimForm', {
        token: user?.token,
        executionId: form.executionId,
      })
      if (result && !result.success) {
        alert(result.error || 'Failed to take form')
      }
      await loadForms()
    } catch (e) { console.error('Take error:', e) }
    finally { setActionLoading('') }
  }

  const handleRelease = async (form: MyForm) => {
    setActionLoading(form.executionId)
    try {
      const result = await callGAS<{ success: boolean; error?: string }>('releaseForm', {
        token: user?.token,
        executionId: form.executionId,
      })
      if (result && !result.success) {
        alert(result.error || 'Failed to release form')
      }
      await loadForms()
    } catch (e) { console.error('Release error:', e) }
    finally { setActionLoading('') }
  }

  const openFillForm = async (form: MyForm) => {
    setSelectedForm(form)
    try {
      const flowResult = await callGAS<{ success: boolean; flow: any }>('getFlowById', {
        token: user?.token,
        flowId: form.flowId,
      })
      if (flowResult && flowResult.success && flowResult.flow) {
        const steps = flowResult.flow.steps || []
        const formStep = steps.find((s: any) => s.type === 'form' && s.fields && s.fields.length > 0)
        if (formStep) {
          setFormFields(formStep.fields)
        } else {
          setFormFields([])
        }
      }
    } catch (e) {
      console.error('Load flow fields error:', e)
      setFormFields([])
    }
    setFillModal(true)
  }

  const handleSubmitForm = async (data: Record<string, any>) => {
    if (!selectedForm) return
    try {
      const result = await callGAS<{ success: boolean; error?: string }>('submitFormData', {
        token: user?.token,
        executionId: selectedForm.executionId,
        formData: data,
      })
      if (result && !result.success) {
        alert(result.error || 'Failed to submit form')
        return
      }
      setFillModal(false)
      setSelectedForm(null)
      await loadForms()
    } catch (e) { console.error('Submit error:', e) }
  }

  const openViewForm = async (form: MyForm) => {
    setSelectedForm(form)
    try {
      const flowResult = await callGAS<{ success: boolean; flow: any }>('getFlowById', {
        token: user?.token,
        flowId: form.flowId,
      })
      if (flowResult && flowResult.success && flowResult.flow) {
        const steps = flowResult.flow.steps || []
        const formStep = steps.find((s: any) => s.type === 'form' && s.fields && s.fields.length > 0)
        if (formStep) {
          setFormFields(formStep.fields)
        } else {
          setFormFields([])
        }
      }
    } catch (e) {
      console.error('Load flow fields error:', e)
      setFormFields([])
    }
    setFillModal(true)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> My Forms
        </h2>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === 'pending' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingForms.length})
        </Button>
        <Button
          variant={activeTab === 'completed' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('completed')}
        >
          Completed ({completedForms.length})
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'pending' && (
          <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {pendingForms.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No pending forms assigned to you.</CardContent></Card>
            )}
            {pendingForms.map(form => {
              const status = getStatusInfo(form)
              const claimed = isClaimedByMe(form)
              const isLoading = actionLoading === form.executionId
              return (
                <Card key={form.executionId} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-sm truncate">{form.flowName || form.flowId}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>Started: {formatDate(form.startedAt)}</div>
                          <div>By: {form.submittedBy}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        {claimed ? (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => openFillForm(form)} disabled={isLoading}>
                              <Eye className="h-3 w-3 mr-1" /> Fill
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRelease(form)} disabled={isLoading}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Release
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => handleTake(form)} disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Hand className="h-3 w-3 mr-1" />} Take
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        )}

        {activeTab === 'completed' && (
          <motion.div key="completed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {completedForms.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No completed forms yet.</CardContent></Card>
            )}
            {completedForms.map(form => {
              const status = getStatusInfo(form)
              return (
                <Card key={form.executionId} className="opacity-80">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{form.flowName || form.flowId}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>Started: {formatDate(form.startedAt)}</div>
                          <div>Completed: {formatDate(form.completedAt)}</div>
                          <div>By: {form.submittedBy}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={status.variant as any} className="text-xs">{status.label}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => openViewForm(form)}>
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={fillModal} onOpenChange={open => { if (!open) { setFillModal(false); setSelectedForm(null) } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedForm?.status === 'Submitted' || selectedForm?.status === 'Approved' || selectedForm?.status === 'Rejected'
                ? 'Form Details'
                : 'Fill Form'}
              {' - '}
              {selectedForm?.flowName || selectedForm?.flowId}
            </DialogTitle>
          </DialogHeader>
          {formFields.length > 0 ? (
            <FormFiller
              fields={formFields}
              initialData={selectedForm?.formData || {}}
              onSubmit={handleSubmitForm}
              onCancel={() => { setFillModal(false); setSelectedForm(null) }}
              disabled={selectedForm?.status === 'Submitted' || selectedForm?.status === 'Approved' || selectedForm?.status === 'Rejected'}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No form fields available.</p>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
