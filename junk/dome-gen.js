const polytope = require('conway-hart')('tI')
const vec3 = require('gl-vec3')

const HEIGHT = 14.8

const bounds = require('bound-points')(polytope.positions)
const radius = Math.max(
  bounds[1][0] - bounds[0][0],
  bounds[1][1] - bounds[0][1],
  bounds[1][2] - bounds[0][2])

const scale = HEIGHT / radius

const edges = []

const areas = []
polytope.cells.forEach((c) => {
  for (let i = 0; i < c.length; ++i) {
    edges.push([c[i], c[(i + 1) % c.length]])
  }

  if (c.length === 6) {
    let normal = vec3.create()
    for (let i = 2; i < c.length; ++i) {
      const x = vec3.cross(
        vec3.create(),
        vec3.subtract([], polytope.positions[c[i]], polytope.positions[c[0]]),
        vec3.subtract([], polytope.positions[c[i - 1]], polytope.positions[c[0]]))
      vec3.add(normal, normal, x)
    }
    areas.push(vec3.length(normal) / 2.0)
  }
})

const lengths = edges.map(([i, j]) =>
  vec3.length(vec3.subtract([], polytope.positions[i], polytope.positions[j])))
lengths.sort(function (a, b) {
  return a - b
})

const histogram = {}
let total = 0

lengths.forEach((l) => {
  const x = Math.round(scale * l * 100.0) / 100.0
  histogram[x] = (histogram[x] | 0) + 1
  total += x
})

const areahistogram = {}
let areatotal = 0

areas.forEach((a) => {
  const x = Math.round(scale * scale * a * 10.0) / 10.0
  areahistogram[x] = (areahistogram[x] | 0) + 1
  areatotal += x
})

Object.keys(histogram).forEach(function (l) {
  histogram[l] /= 2
})

if (typeof document !== 'undefined') {
  document.body.appendChild(document.createTextNode(
    `dome height: ${HEIGHT} lengths: ${JSON.stringify(histogram)}  total: ${total / 2}`))
}

console.log('dome height: ', HEIGHT)
console.log('lengths: ', histogram)
console.log('area', areahistogram)
console.log('area: ', areatotal)
console.log('face count: ', polytope.cells.length)
console.log('vert count: ', polytope.positions.length)
console.log('total: ', total / 2)

var numPieces = 1
var remainingLength = 10
for (var i = 0; i < lengths.length; i += 2) {
  var l = lengths[i] * scale
  if (remainingLength < l) {
    remainingLength = 10 - l
    numPieces += 1
  } else {
    remainingLength -= l
  }
}
console.log(numPieces)
