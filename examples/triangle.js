const regl = require('regl')()
const bunny = require('bunny')
const mat4 = require('gl-mat4')

const drawBunny = regl({
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
    gl_FragColor = vec4(0, 1, 0, 1);
  }
  `,

  attributes: {
    position: bunny.positions
  },

  elements: bunny.cells,

  uniforms: {
    model: regl.prop('model'),
    view: () => mat4.lookAt([],
      [0, 2.5, 30],
      [0, 2.5, 0],
      [0, 1, 0]),
    projection: ({viewportWidth, viewportHeight}) =>
      mat4.perspective(
        [],
        Math.PI / 4.0,
        viewportWidth / viewportHeight,
        0.1,
        1000)
  }
})

regl.frame(({tick}) => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })

  drawBunny({
    model: mat4.rotate([],
      mat4.identity([]),
      0.01 * tick,
      [0, 1, 0])
  })
})
