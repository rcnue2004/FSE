'use client'
import { useState } from 'react'
import { importPlayersFromExcel } from '@/lib/importExcel'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ImportSection() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)
    try {
      const res = await importPlayersFromExcel(file)
      setResult(res)
      toast.success(`Imported ${res.imported} players!`)
    } catch (err: any) {
      toast.error('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-2">Import from Excel</h2>
      <p className="text-sm text-muted mb-4">
        Upload your Excel file to bulk-import players. Required columns: <code className="text-accent">Name</code>, <code className="text-accent">Team</code> (optional: Position)
      </p>

      <label className={`
        flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors
        ${importing ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-surface'}
      `}>
        <Upload className="w-8 h-8 text-muted mb-2" />
        <span className="text-sm text-muted">{importing ? 'Importing...' : 'Click to upload .xlsx file'}</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" disabled={importing} />
      </label>

      {result && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-green text-sm">
            <CheckCircle className="w-4 h-4" />
            {result.imported} players imported successfully
          </div>
          {result.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red text-sm">
              <AlertCircle className="w-4 h-4" />
              {err}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
