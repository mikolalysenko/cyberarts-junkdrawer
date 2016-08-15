var stl = require('stl')
var fs = require('fs')

var data = fs.readFileSync('./Moai.stl').toString()
var facets = stl.toObject(data).facets.map(function (facet) {
  return facet.verts
})

var verts = []
var cells = []

var grid = {}
function pushVertex (v) {
  var id = v.map((x) => Math.floor(x * 10000)).join(':')

  if (id in grid) {
    return grid[id]
  }

  var r = grid[id] = verts.length
  verts.push(v)
  return r
}

facets.forEach(function (f) {
  for (var i = 2; i < f.length; ++i) {
    var v0 = pushVertex(f[0])
    var v1 = pushVertex(f[i - 1])
    var v2 = pushVertex(f[i])
    if (v0 === v1 || v1 === v2 || v2 === v0) {
      continue
    }
    cells.push([v0, v1, v2])
  }
})

var mesh = {
  positions: verts,
  cells: cells
}

console.log(JSON.stringify(mesh, null, '  '))
