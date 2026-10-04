// The logo/stamp handoff. The target travels WITH the picked file, the same shape the
// backup picker uses, so the listener that runs when the Android file dialog closes
// never has to remember - in a closure - which button opened it. That closure was the
// bug: Settings reset its `imageTarget` state before the dialog resolved, so every
// chosen logo was consumed and silently dropped.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickLogo, subscribePickedBackup, subscribePickedLogo, takePickedLogo } from '../src/lib/backup-picker'

const file = { name: 'logo.png' } as File

test('a picked image carries the target it was chosen for, and is consumed once', () => {
  assert.equal(takePickedLogo(), null)
  pickLogo(file, 'stamp')
  assert.deepEqual(takePickedLogo(), { file, target: 'stamp' })
  assert.equal(takePickedLogo(), null, 'the handoff is taken once, never replayed')
  pickLogo(file, 'logo')
  assert.equal(takePickedLogo()?.target, 'logo')
  // An empty selection (no file) stores nothing: the next take finds nothing to apply.
  pickLogo(undefined, 'logo')
  assert.equal(takePickedLogo(), null)
})

test('a logo pick wakes the image listeners only, never the backup import ones', () => {
  let images = 0
  let backups = 0
  const offImage = subscribePickedLogo(() => { images++ })
  const offBackup = subscribePickedBackup(() => { backups++ })
  pickLogo(file, 'stamp')
  takePickedLogo()
  assert.equal(images, 1)
  assert.equal(backups, 0, 'a stamp or logo must never trigger the backup import path')
  offImage()
  offBackup()
  pickLogo(file, 'logo')
  takePickedLogo()
  assert.equal(images, 1, 'an unsubscribed listener is not called again')
})
