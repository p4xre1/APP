import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'

export default function Estimates() {
  const { estimates, customers } = useFatorati()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
        <p className="text-sm text-gray-600 mt-1">{estimates.length} estimates • 100% offline</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {estimates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No estimates yet</p>
            <p className="text-xs text-gray-400 mt-1">Estimates will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {estimates.map((est) => {
              const customer = customers.find(c => c.id === est.customerId)
              return (
                <div key={est.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{est.number}</p>
                    <p className="text-xs text-gray-600">{customer?.name} • {est.status}</p>
                  </div>
                  <p className="font-bold text-sm">{money(est.total)}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
