/**
 * Fatorati Offline - Analytics (100% Local, No Tracking)
 * Simple business metrics - no cloud, no tracking
 */

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function monthlyRevenue(invoices: any[], count = 6) {
  const now = new Date()
  const labels: string[] = []
  const revenue: number[] = []

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(MONTHS[d.getMonth()])
    
    const monthRevenue = invoices
      .filter(inv => {
        const invDate = new Date(inv.issueDate)
        return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear() && inv.status === 'paid'
      })
      .reduce((sum, inv) => sum + inv.total, 0)
    
    revenue.push(monthRevenue)
  }
  
  return { labels, revenue }
}

export function businessMetrics(customers: any[], invoices: any[], expenses: any[]) {
  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const pendingInvoices = invoices.filter(inv => inv.status === 'sent').length
  
  return {
    totalCustomers: customers.length,
    totalInvoices: invoices.length,
    totalRevenue,
    totalExpenses,
    pendingInvoices,
    profit: totalRevenue - totalExpenses,
  }
}
