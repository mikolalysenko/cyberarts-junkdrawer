const orient = require('robust-orientation')
const stars = require('stars')
const splitPolygon = require('split-polygon')
const boxIntersect = require('box-intersect')
const sub3 = require('gl-vec3/subtract')
const normalize3 = require('gl-vec3/normalize')
const dot = require('gl-vec3/dot')
const cross = require('gl-vec3/cross')

module.exports = calculateAmbientOcclusion

function calculateAmbientOcclusion (cells, positions, normals, radius) {
  var centers = cells.map(function (c) {
    const x = [0, 0, 0]
    for (let i = 0; i < 3; ++i) {
      var p = positions[c[i]]
      for (let j = 0; j < 3; ++j) {
        x[j] += p[j]
      }
    }
    for (let i = 0; i < 3; ++i) {
      x[i] /= 3
    }
    return x
  })

  var faceNormals = cells.map(function (c) {
    var v0 = positions[c[0]]
    var v1 = positions[c[1]]
    var v2 = positions[c[2]]

    var n = cross(
      [0, 0, 0],
      sub3([], v1, v0),
      sub3([], v2, v0))
    normalize3(n, n)

    return n
  })

  var sampleBoxes = centers.map(function (p) {
    return [
      p[0] - radius, p[1] - radius, p[2] - radius,
      p[0] + radius, p[1] + radius, p[2] + radius
    ]
  })

  var triBoxes = cells.map(function (c) {
    var lo = [Infinity, Infinity, Infinity]
    var hi = [-Infinity, -Infinity, -Infinity]
    for (var i = 0; i < 3; ++i) {
      var p = positions[c[i]]
      for (var j = 0; j < 3; ++j) {
        lo[j] = Math.min(lo[j], p[j])
        hi[j] = Math.max(hi[j], p[j])
      }
    }
    return [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]]
  })

  var cellAO = Array(cells.length).fill(0)

  function axisTo (out, p, q) {
    sub3(out, p, q)
    normalize3(out, out)
  }

  var A = [0, 0, 0]
  var B = [0, 0, 0]
  var AxB = [0, 0, 0]

  boxIntersect(sampleBoxes, triBoxes, function (i, j) {
    if (i === j) {
      return
    }
    var p = centers[i]
    var n = faceNormals[i]

    var c = cells[j]
    var v0 = positions[c[0]]
    var v1 = positions[c[1]]
    var v2 = positions[c[2]]

    if (orient(p, v0, v1, v2) < 0) {
      return
    }

    var poly = splitPolygon.positive(
      [v0, v1, v2],
      [n[0], n[1], n[2], -dot(n, p)])

    for (var k = 0; k < poly.length; ++k) {
      axisTo(A, poly[k], p)
      axisTo(B, poly[(k + 1) % poly.length], p)
      cross(AxB, A, B)
      normalize3(AxB, AxB)
      cellAO[i] += dot(n, AxB) * Math.acos(dot(A, B)) / (2.0 * Math.PI)
    }
  })

  return stars(cells).map(function (nbhd) {
    var ao = 0
    for (var i = 0; i < nbhd.length; ++i) {
      ao += cellAO[i]
    }
    if (nbhd.length > 0) {
      return ao / cellAO.length
    }
    return 0
  })
}
