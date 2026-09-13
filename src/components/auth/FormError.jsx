import { AlertTriangle } from 'lucide-react'

export default function FormError({ message }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="mt-3 rounded-2xl p-3.5 flex items-start gap-2.5 warn-soft"
      style={{ border: '1px solid #C56B6B30' }}
    >
      <AlertTriangle className="w-[17px] h-[17px] text-[#C56B6B] shrink-0 mt-0.5" strokeWidth={2} />
      <p className="text-[12.5px] text-[#8A3A45] leading-relaxed font-500">{message}</p>
    </div>
  )
}
