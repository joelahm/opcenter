import test from 'node:test'
import assert from 'node:assert/strict'
import { clientGroupKey, clientGroupName, countUniqueClients, sharedClientGroupName } from '../lib/client-group'

test('location suffixes after the final separator share one client group', () => {
  const croydon = 'Flawless Feet Podiatry & Laser Clinic - Croydon'
  const sydenham = 'Flawless Feet Podiatry & Laser Clinic - Sydenham'

  assert.equal(clientGroupName(croydon), 'Flawless Feet Podiatry & Laser Clinic')
  assert.equal(clientGroupKey(croydon), clientGroupKey(sydenham))
})

test('client names without a location suffix remain unchanged', () => {
  assert.equal(clientGroupName('Hampstead Clinic'), 'Hampstead Clinic')
})

test('personal titles do not create separate client groups', () => {
  assert.equal(clientGroupName('Mr sam Gidwani'), 'sam Gidwani')
  assert.equal(clientGroupKey('Mr sam Gidwani'), clientGroupKey('Sam gidwani'))
  assert.equal(clientGroupKey('Dr. Jane Smith'), clientGroupKey('Jane Smith'))
})

test('a complete shared client name groups longer name variants', () => {
  const names = ['Sam Gidwani', 'Mr Sam Gidwani Podiatry']

  assert.equal(sharedClientGroupName(names[0], names), 'Sam Gidwani')
  assert.equal(sharedClientGroupName(names[1], names), 'Sam Gidwani')
})

test('isolated shared words do not group unrelated clients', () => {
  const names = ['Hampstead Clinic', 'Croydon Clinic']

  assert.equal(sharedClientGroupName(names[0], names), 'Hampstead Clinic')
  assert.equal(sharedClientGroupName(names[1], names), 'Croydon Clinic')
})

test('unique client count does not count multiple locations separately', () => {
  const names = [
    'Flawless Feet Podiatry & Laser Clinic - Croydon',
    'Flawless Feet Podiatry & Laser Clinic - Sydenham',
    'Hampstead Clinic',
  ]

  assert.equal(countUniqueClients(names), 2)
})
