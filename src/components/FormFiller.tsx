import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Send, X } from 'lucide-react'
import type { FormField } from './form-builder'

interface FormFillerProps {
  fields: FormField[]
  initialData?: Record<string, any>
  onSubmit: (data: Record<string, any>) => void
  onCancel: () => void
  disabled?: boolean
}

export default function FormFiller({ fields, initialData = {}, onSubmit, onCancel, disabled = false }: FormFillerProps) {
  const [values, setValues] = useState<Record<string, any>>(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateValue = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    for (const field of fields) {
      if (field.required) {
        const val = values[field.id]
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.id] = 'This field is required'
        }
      }
      if (field.type === 'email' && values[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(values[field.id])) {
          newErrors[field.id] = 'Invalid email format'
        }
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSubmit(values)
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No form fields defined.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fields.map(field => (
        <div key={field.id} className="space-y-1.5">
          <Label className="text-sm">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {field.type === 'text' && (
            <Input
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'textarea' && (
            <Textarea
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              disabled={disabled}
              rows={3}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'number' && (
            <Input
              type="number"
              value={values[field.id] ?? ''}
              onChange={e => updateValue(field.id, e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={field.placeholder || ''}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'date' && (
            <Input
              type="date"
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'email' && (
            <Input
              type="email"
              value={values[field.id] || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || 'email@example.com'}
              disabled={disabled}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {field.type === 'select' && (
            <Select
              value={values[field.id] || ''}
              onValueChange={v => updateValue(field.id, v)}
              disabled={disabled}
            >
              <SelectTrigger className={errors[field.id] ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === 'checkbox' && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={!!values[field.id]}
                onCheckedChange={v => updateValue(field.id, v)}
                disabled={disabled}
              />
              <span className="text-sm text-muted-foreground">{field.placeholder || 'Check this option'}</span>
            </div>
          )}

          {field.type === 'file' && (
            <Input
              type="file"
              disabled={disabled}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    updateValue(field.id, {
                      name: file.name,
                      mimeType: file.type,
                      base64: (reader.result as string).split(',')[1],
                    })
                  }
                  reader.readAsDataURL(file)
                }
              }}
              className={errors[field.id] ? 'border-destructive' : ''}
            />
          )}

          {errors[field.id] && (
            <p className="text-xs text-destructive">{errors[field.id]}</p>
          )}
        </div>
      ))}

      {!disabled && (
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSubmit} className="flex-1">
            <Send className="h-4 w-4 mr-2" /> Submit
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
