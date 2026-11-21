import test from 'node:test'
import assert from 'node:assert/strict'

import { isPermanentAdmin, requireUser, roles } from '../middleware/rbac.js'

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  },
})

test('only admin and user access roles remain', () => {
  assert.deepEqual(roles, { ADMIN: 'admin', USER: 'user' })
})

test('authenticated user middleware accepts users and admins only', () => {
  for (const role of ['user', 'admin']) {
    const response = makeResponse()
    let nextCalled = false

    requireUser({ user: { role } }, response, () => {
      nextCalled = true
    })

    assert.equal(nextCalled, true)
  }

  for (const role of ['employee', 'Leader']) {
    const response = makeResponse()
    let nextCalled = false

    requireUser({ user: { role } }, response, () => {
      nextCalled = true
    })

    assert.equal(response.statusCode, 403)
    assert.equal(nextCalled, false)
  }
})

test('recognizes the designated permanent admin email without case sensitivity', () => {
  assert.equal(isPermanentAdmin(' MayeshaAfrooz@Gmail.com '), true)
  assert.equal(isPermanentAdmin('someone@example.com'), false)
})
