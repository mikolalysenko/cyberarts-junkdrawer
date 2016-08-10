const regl = require('regl')()
const text = require('../regl-text')(regl)

const drawText = regl({
  vert: `
  precision highp float;

  uniform vec2 offset;
  attribute vec2 position;

  void main () {
    gl_Position = vec4(0.1 * (position + offset) - 1.0, 0, 1);
  }
  `,

  frag: `
  precision highp float;

  void main () {
    gl_FragColor = vec4(1, 1, 1, 1);
  }
  `,

  attributes: {
    position: regl.prop('position')
  },

  uniforms: {
    offset: regl.prop('offset')
  },

  count: regl.prop('count')
})

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
  drawText(text(`hello world!
this is a way to do text in regl!`))
})
