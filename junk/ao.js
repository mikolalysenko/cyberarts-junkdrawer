const regl = require('regl')()
const bunny = require('bunny')
const computeNormals = require('angle-normals')
const computeAO = require('../mesh-ao')

const camera = require('../regl-camera')(regl, {
  center: [0, 2.5, 0]
})

const bunnyNormals = computeNormals(bunny.cells, bunny.positions)
const bunnyAO = computeAO(bunny.cells, bunny.positions, bunnyNormals, 0.5)

console.log(bunnyAO)

const drawBunny = regl({
  frag: `
    precision mediump float;
    varying vec3 vnormal;
    varying float vao;
    void main () {
      gl_FragColor = vec4(vao, vao, vao, 1.0);
    }`,
  vert: `
    precision mediump float;
    uniform mat4 projection, view;
    attribute vec3 position, normal;
    attribute float ao;
    varying vec3 vnormal;
    varying float vao;
    void main () {
      vnormal = normal;
      vao = 1.0 - ao;
      gl_Position = projection * view * vec4(position, 1.0);
    }`,
  attributes: {
    position: bunny.positions,
    normal: bunnyNormals,
    ao: bunnyAO
  },
  elements: bunny.cells
})

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1]
  })
  camera(() => {
    drawBunny()
  })
})
