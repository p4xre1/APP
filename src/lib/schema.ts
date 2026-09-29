/** Records the user can create, edit and delete. */
export const RECORD_STORES = ['businesses', 'customers', 'projects', 'invoices', 'estimates', 'expenses', 'products', 'settings'] as const
export type RecordStore = typeof RECORD_STORES[number]
/** tombstones records deletions so merged backups cannot resurrect them. */
export const STORES = [...RECORD_STORES, 'tombstones'] as const
export type StoreName = typeof STORES[number]
export const isRecordStore = (name: string): name is RecordStore => (RECORD_STORES as readonly string[]).includes(name)
/** Deleted-record markers older than this are dropped when a backup is created. */
export const TOMBSTONE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000
