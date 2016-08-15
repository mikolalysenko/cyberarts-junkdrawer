const regl = require('regl')()
const camera = require('../regl-camera')(regl, {
  center: [0, 0, 0]
})
const mat4 = require('gl-mat4')
const moai = require('../data/moai.json')

const drawMoai = regl({
  vert: `
  precision highp float;

  attribute vec3 position;
  uniform mat4 projection, view, model;

  void main () {
    gl_Position = projection * view * model * vec4(position, 1);
  }
  `,

  frag: `
  precision highp float;

  void main () {
    gl_FragColor = vec4(1, 1, 1, 1);
  }
  `,

  attributes: {
    position: moai.positions,
    model: () =>
      mat4.scale(new Float32Array(16),
        mat4.identity(new Float32Array(16)),
        [0.01, 0.01, 0.01])
  },

  elements: moai.cells
})

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
  camera(() => {
    drawMoai()
  })
})
