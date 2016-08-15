module.exports = generateMipMesh

function MipMesh (bounds, data, lod) {
  this.bounds = bounds
  this.data = data
  this.lod = lod
}

function LodLevel (scale, start, end, vis) {
  this.scale = scale
  this.start = start
  this.end = end
  this.vis = vis
}

function VisNode (lo, hi, start, end, c0, c1) {
  this.lo = lo
  this.hi = hi
  this.start = start
  this.end = end
  this.c0 = c0
  this.c1 = c1
}

function flattenCells (cells, positions) {
  var result = []
  for (var i = 0; i < cells.length; ++i) {
    result.push(cells[i].map((x) => positions[x]))
  }
  return result
}

function partition (array, start, end, pred) {
  var ptr = start
  for (var i = start; i < end; ++i) {
    var x = array[i]
    if (pred(x)) {
      var tmp = array[ptr]
      array[ptr] = x
      array[i] = tmp
      ptr++
    }
  }
  return ptr
}

function isDegenerate (triangle, scale) {
  for (var i = 1; i < 3; ++i) {
    var p = triangle[i]
    var px = Math.floor(p[0] / scale)
    var py = Math.floor(p[1] / scale)
    var pz = Math.floor(p[2] / scale)
    for (var j = 0; j < i; ++j) {
      var q = triangle[i]
      var qx = Math.floor(q[0] / scale)
      var qy = Math.floor(q[1] / scale)
      var qz = Math.floor(q[2] / scale)
      if (px === qx && py === qy && pz === qz) {
        return true
      }
    }
  }
  return false
}

function splitLOD (triangles, initScale, minCount) {
  var levels = [0]
  var offset = 0
  var scale = initScale
  while (triangles.length - offset > minCount) {
    offset = partition(
      triangles,
      offset,
      triangles.length,
      (tri) => !isDegenerate(tri, scale))
    scale *= 0.5
    levels.push(offset)
  }
  levels.push(triangles.length)
  return levels
}

function getBounds (triangles, start, end) {
  var bounds = [
    [Infinity, Infinity, Infinity],
    [-Infinity, -Infinity, -Infinity]
  ]

  for (var j = start; j < end; ++j) {
    var triangle = triangles[j]
    for (var k = 0; k < 3; ++k) {
      var p = triangle[k]
      for (var i = 0; i < 3; ++i) {
        bounds[0][i] = Math.min(bounds[0][i], p[i])
        bounds[1][i] = Math.max(bounds[1][i], p[i])
      }
    }
  }

  return bounds
}

function splitVis (triangles, start, end, minCount) {
  var bounds = getBounds(triangles)
  if (end - start <= minCount) {
    return new VisNode(bounds[0], bounds[1], start, end, null, null)
  }

  // Find longest axis
  var axis = -1
  var spread = -Infinity
  for (var i = 0; i < 3; ++i) {
    var d = bounds[1][i] - bounds[0][i]
    if (d > spread) {
      axis = i
      spread = d
    }
  }
  var x = 0.5 * (bounds[0][axis] + bounds[1][axis])
  var mid = partition(triangles, start, end, (tri) => tri[0][axis] < x)

  var c0 = splitVis(triangles, start, mid, minCount)
  var c1 = splitVis(triangles, mid, end, minCount)

  return new VisNode(
    bounds[0],
    bounds[1],
    start,
    end,
    c0,
    c1)
}

function unrollTriangles (triangles) {
  var data = []
  for (var i = 0; i < triangles.length; ++i) {
    var tri = triangles[i]
    for (var j = 0; j < 3; ++j) {
      var p = tri[j]
      data.push(p[0], p[1], p[2])
    }
  }
  return new Float32Array(triangles)
}

function generateMipMesh (cells, positions, minCount_, initScale) {
  var minCount = minCount_ || 1024
  var triangles = flattenCells(cells, positions)
  var bounds = getBounds(triangles)

  var scale = initScale || (Math.min(
    bounds[1][0] - bounds[0][0],
    bounds[1][1] - bounds[0][1],
    bounds[1][2] - bounds[0][2]
  ) / Math.pow(minCount, 1.0 / 3.0))

  var lodOffsets = splitLOD(triangles, scale, minCount)
  var levels = []

  for (var i = 1; i < lodOffsets.length; ++i) {
    var start = lodOffsets[i - 1]
    var end = lodOffsets[i]
    var vis = splitVis(triangles, start, end, minCount)
    levels.push(new LodLevel(scale, start, end, vis))
    scale *= 0.5
  }

  var data = unrollTriangles(triangles)

  return new MipMesh(bounds, data, levels)
}
